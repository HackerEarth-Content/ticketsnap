"""Upserts normalized tickets and feature-component tags into Postgres."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from core.orm import FeatureComponent, SyncCursor, Ticket
from pipeline.models import NormalizedTicket


async def upsert_tickets(session: AsyncSession, tickets: list[NormalizedTicket]) -> None:
    for t in tickets:
        stmt = pg_insert(Ticket).values(
            ticket_id=t.ticket_id,
            subject=t.subject,
            content=t.content,
            customer_name=t.customer_name,
            slack_workflow=t.slack_workflow,
            slack_thread_url=t.slack_thread_url,
            feature_component=t.feature_component,
            priority=t.priority,
            canonical_status=t.canonical_status,
            stage_label=t.stage_label,
            created_at=t.created_at,
            closed_at=t.closed_at,
            last_modified_at=t.last_modified_at,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[Ticket.ticket_id],
            set_={
                "subject": stmt.excluded.subject,
                "content": stmt.excluded.content,
                "customer_name": stmt.excluded.customer_name,
                "slack_workflow": stmt.excluded.slack_workflow,
                "slack_thread_url": stmt.excluded.slack_thread_url,
                "feature_component": stmt.excluded.feature_component,
                "priority": stmt.excluded.priority,
                "canonical_status": stmt.excluded.canonical_status,
                "stage_label": stmt.excluded.stage_label,
                "created_at": stmt.excluded.created_at,
                "closed_at": stmt.excluded.closed_at,
                "last_modified_at": stmt.excluded.last_modified_at,
            },
        )
        await session.execute(stmt)

    await upsert_feature_components(session, {t.feature_component for t in tickets if t.feature_component})
    await session.commit()


async def upsert_feature_components(session: AsyncSession, values: set[str]) -> None:
    """Records any new Feature/Component value so the dashboard's product-area
    filter picks it up automatically -- see core/orm.py's FeatureComponent."""
    for value in values:
        stmt = pg_insert(FeatureComponent).values(value=value).on_conflict_do_nothing(
            index_elements=[FeatureComponent.value]
        )
        await session.execute(stmt)


async def get_cursor(session: AsyncSession, key: str = "tickets") -> datetime | None:
    result = await session.execute(select(SyncCursor).where(SyncCursor.key == key))
    row = result.scalar_one_or_none()
    return row.last_synced_at if row else None


async def set_cursor(session: AsyncSession, when: datetime, key: str = "tickets") -> None:
    stmt = pg_insert(SyncCursor).values(key=key, last_synced_at=when)
    stmt = stmt.on_conflict_do_update(
        index_elements=[SyncCursor.key], set_={"last_synced_at": stmt.excluded.last_synced_at}
    )
    await session.execute(stmt)
    await session.commit()
