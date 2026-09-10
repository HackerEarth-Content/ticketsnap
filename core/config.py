"""Settings for the ticketsnap service."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # HubSpot private-app token (same token as Ticket-Hub, per instruction).
    HUBSPOT_SERVICE_KEY: str

    DATABASE_URL: str

    # HubSpot search API allows up to 200 results per page.
    TICKET_PAGE_SIZE: int = 200

    # Never pull or display anything reported before this date.
    SYNC_FLOOR: str = "2026-07-01T00:00:00+00:00"

    # Auth (Google OAuth) -- mirrors Ticket-Hub's values.
    USER_SECRET: str
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    API_BASE_URL: str = "http://localhost:8000"
    # Where the OAuth callback sends the browser after login (success or
    # failure) -- Ticket-Hub's core/config.py has the same setting. In prod,
    # where the built frontend is served from this same FastAPI app (see
    # main.py), this can just equal API_BASE_URL; in dev it's the Vite dev
    # server, not this backend, so it needs its own value.
    FRONTEND_URL: str = "http://localhost:5173"
    ENVIRONMENT: str = "development"
    # Comma-separated Google account emails allowed past the
    # Engineering Issues gate. Empty means any Google account can sign in.
    ALLOWED_EMAILS: str = ""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="allow"
    )


settings = Settings()
