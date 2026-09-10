"""FastAPI entry point for ticketsnap."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from httpx_oauth.exceptions import HTTPXOAuthError

from api.auth_routes import router as auth_router
from api.dashboard_routes import router as dashboard_router
from core.config import settings
from core.database import db_manager
from core.users import OAuthNotAllowedError, fastapi_users
from models.users import UserRead, UserUpdate
from pipeline.sync import trigger_sync

logger = logging.getLogger(__name__)

_SYNC_INTERVAL_SECONDS = 10 * 60


async def _sync_forever() -> None:
    while True:
        try:
            await trigger_sync()
        except Exception:
            logger.exception("Scheduled ticket sync failed")
        await asyncio.sleep(_SYNC_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db_manager.initialize()
    sync_task = asyncio.create_task(_sync_forever())
    yield
    sync_task.cancel()
    await db_manager.close()


app = FastAPI(title="ticketsnap", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

# In dev the frontend (Vite dev server) and backend are different origins, so
# the browser needs an explicit CORS allow for the cookie-authenticated
# dashboard calls. FRONTEND_URL is the single source for this -- same env var
# used for the OAuth redirect above, never hardcoded here. In prod, where the
# built frontend is served from this same app (see the StaticFiles mount
# below), this origin equals the app's own origin and CORS is a no-op.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# A bad `period` query param (api/dashboard_routes.py's resolve_period) is a
# client error, not a server fault -- surface it as a clean 400 instead of an
# unhandled-exception 500.
@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


# A user who isn't on ALLOWED_EMAILS reaches this mid-OAuth-flow -- send them
# back to the frontend (not a bare 403 text page) with a flag it can turn
# into a real message. Mirrors Ticket-Hub's oauth_not_allowed_handler.
@app.exception_handler(OAuthNotAllowedError)
async def oauth_not_allowed_handler(request: Request, exc: OAuthNotAllowedError):
    return RedirectResponse(f"{settings.FRONTEND_URL}?authError=not_allowed", status_code=302)


# Google's side of the OAuth callback can fail after the code exchange --
# e.g. the People API not being enabled on the OAuth client's GCP project,
# or a transient Google-side error -- which otherwise surfaces as a raw
# 500/traceback to whoever's signing in. Log the real cause server-side and
# send the browser back to the frontend with a flag instead.
@app.exception_handler(HTTPXOAuthError)
async def oauth_provider_error_handler(request: Request, exc: HTTPXOAuthError):
    logger.warning("Google OAuth callback failed: %s", exc)
    return RedirectResponse(f"{settings.FRONTEND_URL}?authError=oauth_failed", status_code=302)


app.include_router(auth_router, prefix="/api")
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate, requires_verification=True),
    prefix="/api/users",
    tags=["users"],
)
app.include_router(dashboard_router)

# Serve the built frontend (frontend/dist) when it exists -- in prod the SPA
# and the API share one origin, so api.ts's relative /dashboard and /api URLs
# just work. Mounted last so the routers above win; absent in dev, where
# Vite serves the frontend and proxies API calls to us instead.
_frontend_dist = Path(__file__).parent / "frontend" / "dist"
if _frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="frontend")
