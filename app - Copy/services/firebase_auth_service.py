"""Verify Firebase Auth ID tokens from the web client."""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import requests
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config import settings

logger = logging.getLogger(__name__)


def _verify_via_identity_toolkit(token: str) -> Dict[str, Any]:
    """Verify using Firebase Identity Toolkit (matches web app API key)."""
    api_key = settings.FIREBASE_WEB_API_KEY
    if not api_key:
        raise ValueError("FIREBASE_WEB_API_KEY is not configured.")

    resp = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={api_key}",
        json={"idToken": token},
        timeout=15,
    )
    if resp.status_code != 200:
        err = resp.json() if resp.content else {}
        message = err.get("error", {}).get("message", resp.text)
        raise ValueError(message or "Identity Toolkit verification failed.")

    users = resp.json().get("users") or []
    if not users:
        raise ValueError("No user record for token.")

    user = users[0]
    email = (user.get("email") or "").strip().lower()
    if not email:
        raise ValueError("Firebase user has no email.")

    providers = user.get("providerUserInfo") or []
    provider_id = "firebase"
    if providers and isinstance(providers[0], dict):
        provider_id = providers[0].get("providerId") or provider_id

    return {
        "email": email,
        "name": (user.get("displayName") or "").strip(),
        "uid": user.get("localId"),
        "email_verified": user.get("emailVerified") in (True, "true"),
        "firebase": {"sign_in_provider": provider_id},
    }


def claims_to_profile(claims: Dict[str, Any], fallback_name: Optional[str] = None) -> Dict[str, Any]:
    """Normalize Firebase / Identity Toolkit claims for local DB sync."""
    email = (claims.get("email") or "").strip().lower()
    name = (
        (claims.get("name") or claims.get("displayName") or fallback_name or "")
        .strip()
    )
    if not name and email:
        name = email.split("@")[0]

    uid = claims.get("uid") or claims.get("user_id") or claims.get("sub")
    if uid is not None:
        uid = str(uid)

    provider = "firebase"
    firebase_meta = claims.get("firebase")
    if isinstance(firebase_meta, dict):
        provider = firebase_meta.get("sign_in_provider") or provider
    if provider in ("google.com", "google"):
        provider = "google"

    return {
        "email": email,
        "full_name": name,
        "firebase_uid": uid,
        "auth_provider": provider,
    }


def _verify_via_google_auth_lib(token: str) -> Dict[str, Any]:
    request = google_requests.Request()
    return id_token.verify_firebase_token(
        token,
        request,
        audience=settings.FIREBASE_PROJECT_ID,
    )


def verify_firebase_id_token(raw_token: str) -> Dict[str, Any]:
    if not settings.FIREBASE_PROJECT_ID:
        raise RuntimeError("Firebase is not configured. Set FIREBASE_PROJECT_ID in .env.")

    token = (raw_token or "").strip()
    if not token:
        raise ValueError("Empty ID token.")

    errors: list[str] = []

    try:
        return _verify_via_identity_toolkit(token)
    except Exception as e:
        errors.append(f"identity_toolkit: {e}")
        logger.warning("Firebase Identity Toolkit verify failed: %s", e)

    try:
        return _verify_via_google_auth_lib(token)
    except Exception as e:
        errors.append(f"google_auth: {e}")
        logger.warning("google-auth verify_firebase_token failed: %s", e)

    raise ValueError("; ".join(errors))
