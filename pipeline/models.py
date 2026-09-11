"""Ticket normalization: parses the Workflow:/Feature/Component: lines out of
a Slack-sourced ticket's description. Regexes ported verbatim from Ticket-Hub's
hubspot_pipeline/models.py (verified there against live ticket content)."""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

_WORKFLOW_RE = re.compile(r"^Workflow:\s*(.+)$", re.IGNORECASE | re.MULTILINE)
_FEATURE_COMPONENT_RE = re.compile(
    r"^Feature/Component:\s*(.+)$", re.IGNORECASE | re.MULTILINE
)
# Slack-sourced tickets embed "Reported By: <name>" in the description --
# same convention Ticket-Hub's hubspot_pipeline/models.py parses.
_REPORTED_BY_RE = re.compile(r"^Reported By:\s*(.+)$", re.IGNORECASE | re.MULTILINE)

# Ticket-Hub's canonical bucketing: an "engg oncall" workflow is Oncall (and,
# gated, also shows on Engineering Issues); anything else with a Workflow
# line starting "Content Request" is a Content Request.
ONCALL_WORKFLOW = "engg oncall"
CONTENT_REQUEST_PREFIX = "content request"

PRIORITY_ORDER = ["URGENT", "HIGH", "MEDIUM", "LOW"]


def _unescape(value: str | None) -> str | None:
    return html.unescape(value) if value else value


def _extract(pattern: re.Pattern, content: str | None) -> str | None:
    if not content:
        return None
    match = pattern.search(content)
    if not match:
        return None
    return match.group(1).strip() or None


def extract_workflow(content: str | None) -> str | None:
    return _extract(_WORKFLOW_RE, content)


def extract_feature_component(content: str | None) -> str | None:
    return _extract(_FEATURE_COMPONENT_RE, content)


def extract_reported_by(content: str | None) -> str | None:
    return _extract(_REPORTED_BY_RE, content)


def resolve_customer_name(props: dict[str, Any]) -> str | None:
    return (
        props.get("blackops_account_name")
        or props.get("other_blackops_account_name")
        or props.get("hs_primary_company_name")
        or None
    )


def bucket_for(slack_workflow: str | None) -> str | None:
    """Returns "oncall", "content_request", or None (unbucketed)."""
    if not slack_workflow:
        return None
    normalized = slack_workflow.strip().lower()
    if normalized == ONCALL_WORKFLOW:
        return "oncall"
    if normalized.startswith(CONTENT_REQUEST_PREFIX):
        return "content_request"
    return None


@dataclass
class NormalizedTicket:
    ticket_id: str
    subject: str
    content: str | None
    customer_name: str | None
    slack_workflow: str | None
    slack_thread_url: str | None
    feature_component: str | None
    priority: str | None
    canonical_status: str
    stage_label: str | None
    created_at: datetime | None
    closed_at: datetime | None
    last_modified_at: datetime | None

    @classmethod
    def from_raw(cls, raw: dict[str, Any], stages: dict[str, str]) -> "NormalizedTicket":
        props = raw.get("properties", {})
        stage_id = props.get("hs_pipeline_stage") or ""
        stage_label = stages.get(stage_id)
        content = props.get("content")

        return cls(
            ticket_id=raw.get("id", ""),
            subject=_unescape(props.get("subject")) or "",
            content=_unescape(content),
            customer_name=_unescape(resolve_customer_name(props)),
            slack_workflow=extract_workflow(content),
            slack_thread_url=props.get("slack_link") or None,
            feature_component=extract_feature_component(content),
            priority=props.get("hs_ticket_priority") or None,
            canonical_status="Closed" if props.get("closed_date") else (stage_label or "Unknown"),
            stage_label=stage_label,
            created_at=_parse_iso(props.get("createdate")),
            closed_at=_parse_iso(props.get("closed_date")),
            last_modified_at=_parse_iso(props.get("hs_lastmodifieddate")),
        )


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
