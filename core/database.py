"""Database manager (async engine/session), mirrors Ticket-Hub's core/database.py."""

from __future__ import annotations

from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from core.config import settings


class DatabaseManager:
    def __init__(self) -> None:
        self.engine: AsyncEngine | None = None
        self._database_url = settings.DATABASE_URL.replace(
            "postgresql://", "postgresql+psycopg://"
        )

    async def initialize(self) -> None:
        self.engine = create_async_engine(
            self._database_url,
            connect_args={"prepare_threshold": None},
            pool_pre_ping=True,
        )

    async def close(self) -> None:
        if self.engine:
            await self.engine.dispose()

    def get_engine(self) -> AsyncEngine:
        if not self.engine:
            raise RuntimeError("Database not initialized")
        return self.engine

    def session_factory(self) -> async_sessionmaker[AsyncSession]:
        return async_sessionmaker(self.get_engine(), expire_on_commit=False)


db_manager = DatabaseManager()


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: yields a request-scoped AsyncSession."""
    async with db_manager.session_factory()() as session:
        yield session
