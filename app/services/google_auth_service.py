"""Verify Google Identity Services ID tokens."""
from __future__ import annotations

import secrets
from typing import Any, Dict

import requests

from app.config import settings


def verify_google_id_token(id_token: str) -> Dict[str, Any]:
    if not settings.GOOGLE_CLIENT_ID:
        raise RuntimeError("Google Sign-In is not configured. Set GOOGLE_CLIENT_ID in .env.")

    resp = requests.get(
        "https://oauth2.googleapis.com/tokeninfo",
        params={"id_token": id_token},
        timeout=15,
    )
    if resp.status_code != 200:
        raise ValueError("Invalid Google token.")

    data = resp.json()
    if data.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise ValueError("Google token audience mismatch.")

    email = (data.get("email") or "").strip().lower()
    if not email:
        raise ValueError("Google account did not provide an email.")

    return {
        "email": email,
        "full_name": (data.get("name") or email.split("@")[0]).strip(),
        "google_sub": data.get("sub"),
        "picture": data.get("picture"),
    }


def random_password_for_oauth_user() -> str:
    return secrets.token_urlsafe(24) + "!Aa1"
