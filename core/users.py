"""Google OAuth + fastapi-users wiring. Mirrors Ticket-Hub's core/users.py --
same allowlist behavior, same cookie/JWT backend -- trimmed to Google-only"""

from __future__ import annotations

import hashlib
import hmac
import os
from pathlib import Path
from typing import Any

from dotenv import dotenv_values
from fastapi import Depends, Request
from fastapi_users import BaseUserManager, FastAPIUsers
from fastapi_users.authentication import (
    AuthenticationBackend,
    CookieTransport,
    JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase
from httpx_oauth.clients.google import GoogleOAuth2

from core.config import settings
from core.database import get_session
from core.orm import OAuthAccount, User

# USER_SECRET is the one root secret we're given; derive a distinct key per
# purpose (HKDF-style HMAC) so a leak of one (e.g. an OAuth state token) can't
# be replayed as another (e.g. a session JWT or password-reset token).
def _derive_secret(purpose: str) -> str:
    return hmac.new(settings.USER_SECRET.encode(), purpose.encode(), hashlib.sha256).hexdigest()


SECRET = _derive_secret("oauth-state")
_JWT_SECRET = _derive_secret("session-jwt")
_RESET_SECRET = _derive_secret("password-reset")
_VERIFY_SECRET = _derive_secret("email-verify")

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


class OAuthNotAllowedError(Exception):
    """Raised when an authenticated Google account isn't on ALLOWED_EMAILS."""


def _is_email_allowed(email: str) -> bool:
    """Reads ALLOWED_EMAILS fresh from .env on every call, so editing the
    allowlist takes effect on the next login attempt without a restart."""
    raw = dotenv_values(_ENV_PATH).get("ALLOWED_EMAILS") or os.environ.get(
        "ALLOWED_EMAILS", ""
    )
    allowed = {e.strip().lower() for e in raw.split(",") if e.strip()}
    if not allowed:
        # Fail closed in production -- an empty/missing allowlist must never
        # silently open sign-in to any Google account. Dev keeps the old
        # allow-all convenience since there's no real data to protect there.
        return settings.ENVIRONMENT != "production"
    return email.strip().lower() in allowed


google_oauth_client = GoogleOAuth2(
    settings.GOOGLE_CLIENT_ID,
    settings.GOOGLE_CLIENT_SECRET,
)


class UserManager(BaseUserManager[User, str]):
    reset_password_token_secret = _RESET_SECRET
    verification_token_secret = _VERIFY_SECRET

    def parse_id(self, value: Any) -> str:
        return str(value)

    async def oauth_callback(
        self,
        oauth_name: str,
        access_token: str,
        account_id: str,
        account_email: str,
        expires_at: int | None = None,
        refresh_token: str | None = None,
        request: Request | None = None,
        *,
        associate_by_email: bool = False,
        is_verified_by_default: bool = False,
    ):
        if not _is_email_allowed(account_email):
            raise OAuthNotAllowedError(account_email)

        result = await super().oauth_callback(
            oauth_name,
            access_token,
            account_id,
            account_email,
            expires_at,
            refresh_token,
            request,
            associate_by_email=associate_by_email,
            is_verified_by_default=is_verified_by_default,
        )

        if not result.name and result.email:
            result = await self.user_db.update(
                result, {"name": result.email.split("@")[0]}
            )

        return result


async def get_user_db(session=Depends(get_session)):
    yield SQLAlchemyUserDatabase(session, User, OAuthAccount)


async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)


class RedirectCookieTransport(CookieTransport):
    """CookieTransport that redirects to a URL after login (for OAuth flows)."""

    def __init__(self, redirect_url: str, **kwargs):
        super().__init__(**kwargs)
        self.redirect_url = redirect_url

    async def get_login_response(self, token: str):
        from fastapi.responses import RedirectResponse

        response = RedirectResponse(self.redirect_url, status_code=302)
        return self._set_login_cookie(response, token)


oauth_cookie_transport = RedirectCookieTransport(
    redirect_url=settings.FRONTEND_URL,
    cookie_max_age=3600,
    cookie_name="ticketsnap_auth",
    cookie_secure=settings.ENVIRONMENT == "production",
    cookie_samesite="lax",
)


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=_JWT_SECRET, lifetime_seconds=3600)


oauth_auth_backend = AuthenticationBackend(
    name="oauth-cookie",
    transport=oauth_cookie_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, str](get_user_manager, [oauth_auth_backend])

current_active_user = fastapi_users.current_user(active=True)
current_active_user_optional = fastapi_users.current_user(optional=True, active=True)
