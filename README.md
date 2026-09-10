# ticketsnap

A dashboard for Slack-sourced HubSpot tickets. A sync job pulls tickets from HubSpot into
Postgres; a FastAPI backend (Google-OAuth gated) serves aggregated stats and ticket lists to a
React frontend, split into three views — Oncall, Content Requests, and Engineering Issues —
each just a different `slack_workflow` bucket over the same `tickets` table.

## Stack

- **Backend:** FastAPI + SQLAlchemy (async) + `fastapi-users` (Google OAuth) + Alembic, on Postgres
- **Pipeline:** standalone async script pulling from HubSpot's ticket search API
- **Frontend:** React + TypeScript + Vite, charts via Recharts
- Dependency management via [uv](https://docs.astral.sh/uv/)

## Setup

```bash
uv sync
cp .env.example .env   # fill in the values below
```

Required env vars (see `.env.example`):

| Var | Purpose |
|---|---|
| `HUBSPOT_SERVICE_KEY` | HubSpot private-app token used by the sync pipeline |
| `DATABASE_URL` | Postgres connection string |
| `USER_SECRET` | Secret for `fastapi-users` session/JWT signing |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth app credentials |
| `API_BASE_URL` | This backend's own URL (OAuth callback target) |
| `FRONTEND_URL` | Where the frontend is served (CORS + post-login redirect) |
| `ALLOWED_EMAILS` | Comma-separated emails allowed to sign in; empty = anyone with a Google account |
| `SYNC_FLOOR` | Ignore tickets reported before this timestamp |

Run migrations:

```bash
uv run alembic upgrade head
```

## Running

Backend:

```bash
uv run uvicorn main:app --reload
```

Frontend (dev, proxies API calls to the backend):

```bash
cd frontend
npm install
npm run dev
```

In production, build the frontend (`npm run build`) and the FastAPI app serves the static
`frontend/dist` output directly from the same origin — no separate frontend server or CORS
needed.

Sync tickets from HubSpot (incremental, safe to run repeatedly/on a schedule):

```bash
uv run python -m pipeline.sync
```

## Project layout

```
main.py               FastAPI app: middleware, routers, error handlers, static frontend mount
api/                   auth_routes.py (Google OAuth), dashboard_routes.py (dashboard JSON API)
core/                  settings, DB session management, user model wiring for fastapi-users
models/                Pydantic schemas for the users API
pipeline/              HubSpot client, normalization, upsert, and the sync entrypoint
migrations/            Alembic migrations
frontend/              React + Vite dashboard UI
```
