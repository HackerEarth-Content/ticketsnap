"""Dashboard JSON API: Oncall / Content Requests (public) and Engineering
Issues (Google-signin-gated) -- all 3 read the same `tickets` table, bucketed
by slack_workflow (see pipeline/models.py's bucket_for). Consumed by the React
frontend's src/api.ts."""

from __future__ import annotations

import statistics
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_session
from core.orm import FeatureComponent, Ticket
from core.users import current_active_user
from pipeline.models import CONTENT_REQUEST_PREFIX, ONCALL_WORKFLOW, PRIORITY_ORDER, extract_reported_by

router = APIRouter(prefix="/dashboard")

# Same period vocabulary and IST-midnight boundary convention as Ticket-Hub's
# dashboard/utils.py:resolve_period, ported verbatim so the frontend's period
# picker behaves identically across both dashboards.
_PERIODS = ("today", "yesterday", "week", "month")
_IST = ZoneInfo("Asia/Kolkata")
# Caps a custom:START:END range so one request can't force an unbounded
# table scan + full-JSON serialization (e.g. ?period=custom:2000-01-01:2026-12-31).
_MAX_CUSTOM_RANGE_DAYS = 366


def _ist_today_start(now: datetime) -> datetime:
    return (
        now.astimezone(_IST)
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .astimezone(timezone.utc)
    )


def resolve_period(period: str) -> tuple[datetime, datetime]:
    """Map a period name to a (period_start, period_end) UTC datetime range.
    Also accepts "custom:YYYY-MM-DD:YYYY-MM-DD" (both dates are IST calendar
    dates, inclusive) for user-picked ranges."""
    now = datetime.now(timezone.utc)

    if period.startswith("custom:"):
        parts = period.split(":")
        if len(parts) != 3:
            raise ValueError(f"Invalid custom period {period!r}, expected custom:YYYY-MM-DD:YYYY-MM-DD")
        try:
            start_date = datetime.strptime(parts[1], "%Y-%m-%d").replace(tzinfo=_IST)
            end_date = datetime.strptime(parts[2], "%Y-%m-%d").replace(tzinfo=_IST)
        except ValueError:
            raise ValueError(f"Invalid custom period {period!r}, expected custom:YYYY-MM-DD:YYYY-MM-DD")
        if (end_date - start_date).days > _MAX_CUSTOM_RANGE_DAYS:
            raise ValueError(
                f"Custom period {period!r} spans more than {_MAX_CUSTOM_RANGE_DAYS} days"
            )
        range_start = start_date.astimezone(timezone.utc)
        range_end = (end_date + timedelta(days=1)).astimezone(timezone.utc)
        return range_start, min(range_end, now)

    if period not in _PERIODS:
        raise ValueError(f"Unknown period {period!r}, expected one of {_PERIODS} or custom:START:END")

    today_start = _ist_today_start(now)
    if period == "today":
        return today_start, now
    if period == "yesterday":
        return today_start - timedelta(days=1), today_start
    if period == "week":
        return now - timedelta(days=7), now
    return now - timedelta(days=30), now  # month


def _priority_key(priority: str | None) -> int:
    try:
        return PRIORITY_ORDER.index(priority)
    except ValueError:
        return len(PRIORITY_ORDER)


def _days_open(t: Ticket) -> int | None:
    if t.created_at is None:
        return None
    end = t.closed_at or datetime.now(timezone.utc)
    start = t.created_at
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return (end - start).days


def _resolution_hours(t: Ticket) -> float | None:
    if t.created_at is None or t.closed_at is None:
        return None
    start, end = t.created_at, t.closed_at
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return (end - start).total_seconds() / 3600


async def _fetch_bucket(
    session: AsyncSession, period: str, *, oncall: bool = False, content_request: bool = False
) -> list[Ticket]:
    period_start, period_end = resolve_period(period)
    stmt = select(Ticket).where(Ticket.created_at.between(period_start, period_end))
    if oncall:
        stmt = stmt.where(Ticket.slack_workflow.ilike(ONCALL_WORKFLOW))
    if content_request:
        stmt = stmt.where(Ticket.slack_workflow.ilike(f"{CONTENT_REQUEST_PREFIX}%"))
    result = await session.execute(stmt)
    tickets = list(result.scalars().all())
    tickets.sort(key=lambda t: _priority_key(t.priority))
    return tickets


async def _feature_components(session: AsyncSession) -> list[str]:
    result = await session.execute(select(FeatureComponent.value).order_by(FeatureComponent.value))
    return list(result.scalars().all())


def _stats(tickets: list[Ticket]) -> dict:
    """Overview numbers for the dashboard's stat strip, breakdown bars, and
    resolution-time-by-priority card. Median (not mean) resolution time --
    a handful of old backlog tickets closing in-period can drag a mean up to
    a number no actual ticket resembles, same reasoning as Ticket-Hub's
    ResolutionByPriorityCard."""
    total = len(tickets)
    by_feature_component: dict[str, int] = {}
    by_priority: dict[str, int] = {}
    by_reporter: dict[str, int] = {}
    resolution_hours_by_priority: dict[str, list[float]] = {}
    all_resolution_hours: list[float] = []
    open_count = 0
    closed_count = 0

    for t in tickets:
        fc = t.feature_component or "Not set"
        by_feature_component[fc] = by_feature_component.get(fc, 0) + 1

        priority = t.priority or "Unknown"
        by_priority[priority] = by_priority.get(priority, 0) + 1

        reporter = extract_reported_by(t.content) or "Unknown"
        by_reporter[reporter] = by_reporter.get(reporter, 0) + 1

        if t.canonical_status == "Closed":
            closed_count += 1
        else:
            open_count += 1

        hours = _resolution_hours(t)
        if hours is not None:
            all_resolution_hours.append(hours)
            resolution_hours_by_priority.setdefault(priority, []).append(hours)

    return {
        "total": total,
        "open_count": open_count,
        "closed_count": closed_count,
        "by_feature_component": by_feature_component,
        "by_priority": by_priority,
        "by_reporter": by_reporter,
        "median_resolution_time_hours": (
            statistics.median(all_resolution_hours) if all_resolution_hours else None
        ),
        "resolved_median_hours_by_priority": {
            p: statistics.median(hours) for p, hours in resolution_hours_by_priority.items()
        },
        "resolved_count_by_priority": {p: len(hours) for p, hours in resolution_hours_by_priority.items()},
    }


def _serialize(tickets: list[Ticket], feature_components: list[str]) -> dict:
    return {
        "stats": _stats(tickets),
        "tickets": [
            {
                "ticket_id": t.ticket_id,
                "subject": t.subject,
                "created_at": t.created_at,
                "closed_at": t.closed_at,
                "customer_name": t.customer_name,
                "content": t.content,
                "feature_component": t.feature_component,
                "reporter_name": extract_reported_by(t.content),
                "canonical_status": t.canonical_status,
                "priority": t.priority,
                "days_open": _days_open(t),
            }
            for t in tickets
        ],
        "feature_components": feature_components,
    }


# The whole app -- not just Engineering Issues -- is gated behind Google
# sign-in, so every bucket route requires current_active_user.
@router.get("/oncall")
async def oncall(
    period: str = "week",
    session: AsyncSession = Depends(get_session),
    user=Depends(current_active_user),
):
    tickets = await _fetch_bucket(session, period, oncall=True)
    fcs = await _feature_components(session)
    return _serialize(tickets, fcs)


@router.get("/content-requests")
async def content_requests(
    period: str = "week",
    session: AsyncSession = Depends(get_session),
    user=Depends(current_active_user),
):
    tickets = await _fetch_bucket(session, period, content_request=True)
    fcs = await _feature_components(session)
    return _serialize(tickets, fcs)


@router.get("/engineering-issues")
async def engineering_issues(
    period: str = "week",
    session: AsyncSession = Depends(get_session),
    user=Depends(current_active_user),
):
    # Same bucket as Oncall -- this tab's only distinction from Oncall is
    # cosmetic now that the whole app requires sign-in.
    tickets = await _fetch_bucket(session, period, oncall=True)
    fcs = await _feature_components(session)
    return _serialize(tickets, fcs)
