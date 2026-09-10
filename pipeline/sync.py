"""Sync entrypoint: pull Slack-sourced tickets from HubSpot, normalize, upsert.

Run manually with `uv run python -m pipeline.sync`.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from core.config import settings
from core.database import db_manager
from pipeline.client import HubSpotClient
from pipeline.db_writer import get_cursor, set_cursor, upsert_tickets
from pipeline.models import NormalizedTicket

_SYNC_FLOOR_MS = int(datetime.fromisoformat(settings.SYNC_FLOOR).timestamp() * 1000)

# Serializes syncs so the 10-minute scheduled run (see main.py's _sync_forever)
# and a manual "sync now" request never race each other's DB writes.
_sync_lock = asyncio.Lock()


async def trigger_sync() -> dict:
    """Runs one incremental sync. Assumes db_manager is already initialized
    (true both inside the running FastAPI app and via run_incremental below)."""
    async with _sync_lock:
        async with db_manager.session_factory()() as session:
            cursor = await get_cursor(session)
        since_ms = max(
            int(cursor.timestamp() * 1000) if cursor else _SYNC_FLOOR_MS,
            _SYNC_FLOOR_MS,
        )
        started_at = datetime.now(timezone.utc)

        client = HubSpotClient()
        stages = await client.fetch_pipeline_stages()

        tickets: list[NormalizedTicket] = []
        async for raw in client.fetch_tickets(since_ms):
            tickets.append(NormalizedTicket.from_raw(raw, stages))

        async with db_manager.session_factory()() as session:
            await upsert_tickets(session, tickets)
            await set_cursor(session, started_at)

        return {"pulled": len(tickets), "since_ms": since_ms}


async def run_incremental() -> dict:
    """CLI entrypoint: initializes its own DB connection (the running app
    initializes db_manager itself, see main.py's lifespan)."""
    await db_manager.initialize()
    try:
        return await trigger_sync()
    finally:
        await db_manager.close()


if __name__ == "__main__":
    result = asyncio.run(run_incremental())
    print(result)
