"""Pydantic read/update schemas for fastapi-users' user router."""

from __future__ import annotations

from fastapi_users import schemas


class UserRead(schemas.BaseUser[str]):
    name: str | None = None


class UserUpdate(schemas.BaseUserUpdate):
    name: str | None = None
