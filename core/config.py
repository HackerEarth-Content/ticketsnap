"""Settings for the ticketsnap service."""

from __future__ import annotations

import json
import os

from pydantic_settings import BaseSettings, SettingsConfigDict


def _load_secrets_manager_env() -> None:
    """Pulls the prod/ticketsnap secret (HubSpot key, DATABASE_URL,
    USER_SECRET, Google OAuth creds, ...) into the process env before
    Settings reads it below. Only runs in production -- local dev keeps
    using .env untouched. setdefault so an explicitly-set env var (e.g. a
    compose override) still wins over the secret.
    """
    import boto3
    from botocore.exceptions import ClientError

    secret_name = os.environ.get("AWS_SECRET_NAME", "prod/ticketsnap")
    region_name = os.environ.get("AWS_REGION", "ap-south-1")

    client = boto3.session.Session().client(service_name="secretsmanager", region_name=region_name)
    try:
        response = client.get_secret_value(SecretId=secret_name)
    except ClientError as e:
        raise e

    for key, value in json.loads(response["SecretString"]).items():
        os.environ.setdefault(key, str(value))


if os.environ.get("ENVIRONMENT") == "production":
    _load_secrets_manager_env()


class Settings(BaseSettings):
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
    API_BASE_URL: str

    FRONTEND_URL: str
    ENVIRONMENT: str = "development"

    ALLOWED_EMAILS: str = ""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="allow"
    )


settings = Settings()
