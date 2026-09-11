"""Async HubSpot API client, trimmed from Ticket-Hub's hubspot_pipeline/client.py --
this only pulls what ticketsnap's 3 tabs need, from Support Pipeline only.
"""

from __future__ import annotations

import time
from typing import AsyncIterator

import aiohttp

from core.config import settings

_BASE = "https://api.hubapi.com"
_SUPPORT_PIPELINE_ID = "0"

TICKET_PROPERTIES = [
    "subject",
    "content",
    "hs_ticket_priority",
    "source_type",
    "createdate",
    "closed_date",
    "hs_lastmodifieddate",
    "hs_pipeline",
    "hs_pipeline_stage",
    "blackops_account_name",
    "other_blackops_account_name",
    "hs_primary_company_name",
    "slack_link",
]

# Same chunking rationale as Ticket-Hub's client.py: HubSpot search caps any
# single query at 10,000 results.
_CHUNK_DAYS = 20
_DAY_MS = 86_400_000
_SAFE_RESULT_CAP = 9500


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.HUBSPOT_SERVICE_KEY}",
        "Content-Type": "application/json",
    }


class HubSpotClient:
    async def fetch_pipeline_stages(self) -> dict[str, str]:
        """Returns {stage_id: label} for the Support Pipeline only."""
        url = f"{_BASE}/crm/v3/pipelines/tickets/{_SUPPORT_PIPELINE_ID}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=_headers()) as resp:
                resp.raise_for_status()
                data = await resp.json()
        return {s["id"]: s["label"] for s in data.get("stages", [])}

    async def fetch_tickets(self, since_ms: int) -> AsyncIterator[dict]:
        """Yield raw Slack-sourced ticket dicts modified since `since_ms`."""
        now_ms = int(time.time() * 1000)
        chunk_ms = _CHUNK_DAYS * _DAY_MS

        async with aiohttp.ClientSession() as session:
            cursor = since_ms
            while cursor < now_ms:
                window_end = min(cursor + chunk_ms, now_ms)
                async for ticket in self._fetch_window(session, cursor, window_end):
                    yield ticket
                cursor = window_end

    async def _fetch_window(
        self, session: aiohttp.ClientSession, from_ms: int, to_ms: int
    ) -> AsyncIterator[dict]:
        url = f"{_BASE}/crm/v3/objects/tickets/search"
        filters = [
            {"propertyName": "hs_lastmodifieddate", "operator": "GT", "value": str(from_ms)},
            {"propertyName": "hs_lastmodifieddate", "operator": "LTE", "value": str(to_ms)},
            {"propertyName": "hs_pipeline", "operator": "EQ", "value": _SUPPORT_PIPELINE_ID},
            {"propertyName": "source_type", "operator": "EQ", "value": "Slack"},
        ]
        body: dict = {
            "filterGroups": [{"filters": filters}],
            "properties": TICKET_PROPERTIES,
            "limit": settings.TICKET_PAGE_SIZE,
            "sorts": [{"propertyName": "hs_lastmodifieddate", "direction": "ASCENDING"}],
        }

        async with session.post(url, headers=_headers(), json=body) as resp:
            resp.raise_for_status()
            data = await resp.json()

        if data.get("total", 0) > _SAFE_RESULT_CAP and to_ms - from_ms > 1_000:
            mid_ms = from_ms + (to_ms - from_ms) // 2
            async for ticket in self._fetch_window(session, from_ms, mid_ms):
                yield ticket
            async for ticket in self._fetch_window(session, mid_ms, to_ms):
                yield ticket
            return

        for raw in data.get("results", []):
            yield raw

        after = data.get("paging", {}).get("next", {}).get("after")
        while after:
            body["after"] = after
            async with session.post(url, headers=_headers(), json=body) as resp:
                if resp.status == 400:
                    return
                resp.raise_for_status()
                data = await resp.json()
            for raw in data.get("results", []):
                yield raw
            after = data.get("paging", {}).get("next", {}).get("after")
