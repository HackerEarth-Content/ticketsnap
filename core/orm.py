"""SQLAlchemy ORM models. Schema changes are managed via Alembic migrations --
this module only declares the mapped classes, it never creates or alters tables.
"""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi_users.db import SQLAlchemyBaseOAuthAccountTable, SQLAlchemyBaseUserTable
from sqlalchemy import TIMESTAMP, ForeignKey, Text, text
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column, relationship, synonym


class Base(DeclarativeBase):
    pass


class Ticket(Base):
    """A Slack-sourced HubSpot ticket, normalized for the ticketsnap dashboard.

    Only the fields the Oncall/Content Requests/Engineering Issues tabs need --
    see hackerearth478's Ticket-Hub hubspot_pipeline/models.py for the full
    upstream ticket model this is trimmed from.
    """

    __tablename__ = "tickets"

    ticket_id: Mapped[str] = mapped_column(primary_key=True)
    subject: Mapped[str] = mapped_column(default="")
    content: Mapped[str | None]  # raw description, holds the Workflow/Feature/Component lines

    customer_name: Mapped[str | None] = mapped_column(index=True)

    # "engg oncall" / "Content Request - ..." -- parsed from the `Workflow:`
    # line in content. Oncall and Engineering Issues share this same value;
    # Engineering Issues is the same bucket, just gated behind Google login.
    slack_workflow: Mapped[str | None] = mapped_column(index=True)
    # Product area, parsed from the `Feature/Component:` line in content.
    feature_component: Mapped[str | None] = mapped_column(index=True)

    priority: Mapped[str | None]  # native hs_ticket_priority (Low/Medium/High/Urgent)
    canonical_status: Mapped[str] = mapped_column(default="Unknown")
    stage_label: Mapped[str | None]

    created_at: Mapped[datetime | None] = mapped_column(index=True)  # createdate
    closed_at: Mapped[datetime | None]
    last_modified_at: Mapped[datetime | None] = mapped_column(index=True)


class FeatureComponent(Base):
    """Every distinct `Feature/Component:` value seen so far -- populated
    automatically by the sync pipeline as new values show up in ticket
    descriptions, so the dashboard's product-area filter grows on its own."""

    __tablename__ = "feature_components"

    value: Mapped[str] = mapped_column(primary_key=True)
    first_seen_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()")
    )


class SyncCursor(Base):
    """Tracks the last successful incremental-sync timestamp."""

    __tablename__ = "sync_cursors"

    key: Mapped[str] = mapped_column(primary_key=True)
    last_synced_at: Mapped[datetime]


class OAuthAccount(SQLAlchemyBaseOAuthAccountTable[str], Base):
    id: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
        default=lambda: str(uuid4()),
        server_default=text("uuid_generate_v4()::text"),
    )

    @declared_attr
    def user_id(cls) -> Mapped[str]:
        return mapped_column(
            Text, ForeignKey("user.user_id", ondelete="CASCADE"), nullable=False
        )


class User(SQLAlchemyBaseUserTable[str], Base):
    __tablename__ = "user"

    id: Mapped[str] = mapped_column(
        "user_id",
        Text,
        primary_key=True,
        default=lambda: str(uuid4()),
        server_default=text("uuid_generate_v4()::text"),
    )
    name: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()")
    )

    user_id = synonym("id")

    oauth_accounts: Mapped[list[OAuthAccount]] = relationship(
        "OAuthAccount", lazy="joined", cascade="all, delete-orphan"
    )
