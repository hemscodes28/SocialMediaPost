"""
Instagram / Facebook Graph access token lifecycle (Multi-user SQLite).
"""
from __future__ import annotations
import base64
import hashlib
import hmac
import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlencode

import requests
from app.config import settings
from app.database import db

logger = logging.getLogger(__name__)

META_OAUTH_ACCESS_TOKEN_URL = f"{settings.GRAPH_API_BASE}/oauth/access_token"
_STATE_TTL_SECONDS = 600
_STATE_SECRET = (os.getenv("JWT_SECRET_KEY") or settings.FB_APP_SECRET or "instagram-meta-oauth-state").encode()

class InstagramReauthRequired(Exception):
    """Raised when the token is expired/invalid and the user must re-login."""

class InstagramTokenService:
    def __init__(self, fb_app_id: Optional[str] = None, fb_app_secret: Optional[str] = None):
        self._fb_app_id = fb_app_id or settings.FB_APP_ID
        self._fb_app_secret = fb_app_secret or settings.FB_APP_SECRET
        if not self._fb_app_id or not self._fb_app_secret:
            logger.warning("FB_APP_ID / FB_APP_SECRET not configured; token refresh will not work.")

    def _make_oauth_state(self, user_id: int) -> str:
        payload = json.dumps({"uid": user_id, "ts": int(time.time())}, separators=(",", ":"))
        sig = hmac.new(_STATE_SECRET, payload.encode(), hashlib.sha256).hexdigest()[:16]
        raw = f"{payload}|{sig}"
        return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")

    def get_user_id_from_oauth_state(self, state: str) -> int:
        """Validate signed Meta OAuth state and return app user_id."""
        try:
            padded = state + "=" * (-len(state) % 4)
            raw = base64.urlsafe_b64decode(padded.encode()).decode()
            payload, sig = raw.rsplit("|", 1)
            expected = hmac.new(_STATE_SECRET, payload.encode(), hashlib.sha256).hexdigest()[:16]
            if not hmac.compare_digest(sig, expected):
                raise ValueError("Invalid Meta OAuth state signature")
            data = json.loads(payload)
            if time.time() - int(data.get("ts", 0)) > _STATE_TTL_SECONDS:
                raise ValueError("Meta OAuth session expired. Close the popup and try Add Instagram Account again.")
            return int(data["uid"])
        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f"Invalid or expired Meta OAuth session: {e}") from e

    def get_meta_login_url(self, user_id: int) -> str:
        """Facebook Login dialog URL (user signs in with Facebook / linked Instagram business setup)."""
        if not self._fb_app_id or not self._fb_app_secret:
            raise RuntimeError(
                "Facebook app not configured. Set FB_APP_ID and FB_APP_SECRET in your .env file."
            )
        redirect_uri = settings.FB_REDIRECT_URI.strip()
        if not redirect_uri:
            raise RuntimeError(
                "FB_REDIRECT_URI is not set. It must exactly match a Valid OAuth Redirect URI in your Meta app."
            )
        state = self._make_oauth_state(user_id)
        scopes = [
            "pages_show_list",
            "pages_read_engagement",
            "instagram_basic",
            "instagram_content_publish",
        ]
        params = {
            "client_id": self._fb_app_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "response_type": "code",
            "scope": ",".join(scopes),
            "auth_type": "rerequest",
        }
        return f"https://www.facebook.com/{settings.GRAPH_API_VERSION}/dialog/oauth?{urlencode(params)}"

    def exchange_oauth_code_for_short_lived_user_token(self, code: str) -> str:
        """Exchange authorization code from Facebook Login redirect for a short-lived user access token."""
        redirect_uri = settings.FB_REDIRECT_URI.strip()
        params = {
            "client_id": self._fb_app_id,
            "redirect_uri": redirect_uri,
            "client_secret": self._fb_app_secret,
            "code": code,
        }
        url = f"https://graph.facebook.com/{settings.GRAPH_API_VERSION}/oauth/access_token"
        resp = requests.get(url, params=params, timeout=20)
        data = resp.json()
        if resp.status_code >= 400 or data.get("error"):
            self._raise_for_meta_error(data)
        token = data.get("access_token")
        if not token:
            raise RuntimeError("Meta did not return an access_token.")
        return token

    def exchange_short_lived_token(self, short_token: str) -> Tuple[str, datetime]:
        params = {
            "grant_type": "fb_exchange_token",
            "client_id": self._fb_app_id,
            "client_secret": self._fb_app_secret,
            "fb_exchange_token": short_token,
        }
        resp = requests.get(META_OAUTH_ACCESS_TOKEN_URL, params=params, timeout=20)
        data = resp.json()
        if resp.status_code >= 400 or data.get("error"):
            self._raise_for_meta_error(data)
        
        long_token = data.get("access_token")
        if not long_token:
            raise RuntimeError("Meta did not return an access_token during token exchange.")
        expires_in = data.get("expires_in")
        # Default to 60 days if expires_in is not provided by Meta
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(expires_in) if expires_in else 5184000)
        return long_token, expires_at

    def store_long_lived_token(self, user_id: int, long_token: str, expires_at: datetime, account_id: Optional[str] = None, username: Optional[str] = None):
        if not account_id:
            # Try to get the existing account_id for this user
            existing = self.get_record(user_id)
            if existing:
                account_id = existing.get('instagram_account_id')
                username = username or existing.get('username')
            else:
                account_id = f"env_{user_id}"

        with db.get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO instagram_accounts 
                (instagram_account_id, user_id, username, access_token, expires_at, last_refreshed_at, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (account_id, user_id, username, long_token, expires_at, datetime.now(timezone.utc), "active"))
            conn.commit()

    def get_records(self, user_id: int) -> List[dict]:
        with db.get_connection() as conn:
            cursor = conn.execute("SELECT * FROM instagram_accounts WHERE user_id = ?", (user_id,))
            return [dict(row) for row in cursor.fetchall()]

    def get_record(self, user_id: int) -> Optional[dict]:
        records = self.get_records(user_id)
        active_records = [r for r in records if r.get('status') == 'active']
        return active_records[0] if active_records else (records[0] if records else None)

    def get_record_by_account_id(self, account_id: str, username: Optional[str] = None) -> Optional[dict]:
        with db.get_connection() as conn:
            if username:
                cursor = conn.execute("SELECT * FROM instagram_accounts WHERE instagram_account_id = ? AND username = ?", (account_id, username))
            else:
                cursor = conn.execute("SELECT * FROM instagram_accounts WHERE instagram_account_id = ?", (account_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def _verify_token_live(self, access_token: str) -> bool:
        try:
            resp = requests.get(
                "https://graph.facebook.com/v24.0/me",
                params={"access_token": access_token},
                timeout=15,
            )
            data = resp.json()
            return resp.status_code == 200 and "error" not in data
        except Exception:
            return False

    def get_access_token_for_account(self, account_id: str, username: Optional[str] = None) -> str:
        with db.get_connection() as conn:
            if username:
                cursor = conn.execute("SELECT * FROM instagram_accounts WHERE instagram_account_id = ? AND username = ?", (account_id, username))
            else:
                cursor = conn.execute("SELECT * FROM instagram_accounts WHERE instagram_account_id = ?", (account_id,))
            row = cursor.fetchone()
            if not row or row['status'] != 'active':
                raise InstagramReauthRequired("No active Instagram token for this account.")

            expires_at = datetime.fromisoformat(row['expires_at'])
            if expires_at <= datetime.now(timezone.utc):
                env_token = settings.PAGE_ACCESS_TOKEN.strip()
                env_ig_id = (settings.INSTAGRAM_ACCOUNT_ID or "").strip()
                if env_token and env_ig_id == account_id and self._verify_token_live(env_token):
                    logger.warning("DB Instagram token expired; falling back to PAGE_ACCESS_TOKEN from .env.")
                    try:
                        account_info = self.fetch_account_info_from_token(env_token)
                        new_expires = datetime.now(timezone.utc) + timedelta(days=60)
                        self.store_long_lived_token(
                            row['user_id'],
                            env_token,
                            new_expires,
                            account_id,
                            account_info.get("username") or row.get("username"),
                        )
                        return env_token
                    except Exception as e:
                        logger.error(f"Failed to update DB from .env token for {account_id}: {e}")
                raise InstagramReauthRequired("Instagram token expired. Please reconnect this account.")

            # Auto-refresh if within 10 days
            if expires_at - datetime.now(timezone.utc) <= timedelta(days=10):
                try:
                    new_token, new_expires = self.refresh_token(row['access_token'])
                    self.store_long_lived_token(row['user_id'], new_token, new_expires, account_id, row['username'])
                    return new_token
                except Exception:
                    logger.exception("Auto-refresh failed.")

            return row['access_token']

    def get_access_token_for_user(self, user_id: int) -> str:
        record = self.get_record(user_id)
        if not record or not record.get('instagram_account_id'):
            raise InstagramReauthRequired("No active Instagram token.")
        return self.get_access_token_for_account(record['instagram_account_id'])

    def refresh_token(self, long_lived_token: str) -> Tuple[str, datetime]:
        params = {
            "grant_type": "fb_refresh_token",
            "client_id": self._fb_app_id,
            "client_secret": self._fb_app_secret,
            "fb_exchange_token": long_lived_token,
        }
        resp = requests.get(META_OAUTH_ACCESS_TOKEN_URL, params=params, timeout=20)
        data = resp.json()
        if resp.status_code >= 400 or data.get("error"):
            self._raise_for_meta_error(data)
        return data["access_token"], datetime.now(timezone.utc) + timedelta(seconds=int(data["expires_in"]))

    def fetch_all_instagram_accounts_from_token(self, access_token: str) -> Tuple[List[dict], List[str]]:
        """
        Discover every Instagram Business/Creator account linked to any Facebook Page
        the user granted access to. Returns (accounts, page_names_without_instagram).
        """
        graph = settings.GRAPH_API_BASE
        me_resp = requests.get(
            f"{graph}/me/accounts",
            params={
                "fields": (
                    "id,name,access_token,"
                    "instagram_business_account{id,username},"
                    "connected_instagram_account{id,username}"
                ),
                "access_token": access_token,
                "limit": 100,
            },
            timeout=20,
        )
        me_data = me_resp.json()
        if "error" in me_data:
            self._raise_for_meta_error(me_data)

        pages = me_data.get("data", [])
        if not pages:
            logger.warning("No Facebook Pages returned by /me/accounts.")
            raise RuntimeError(
                "No Facebook Pages found. To connect Instagram you need: "
                "1) A Facebook Page (create one at facebook.com/pages/create), "
                "2) An Instagram Professional account (Business or Creator), "
                "3) Link Instagram to your Facebook Page (Instagram > Settings > Account > Linked Accounts > Facebook). "
                "4) When Meta asks which Pages to share, select every Page you want to use — including Subramani's Page."
            )

        accounts: List[dict] = []
        seen_ig_ids: set[str] = set()
        pages_without_ig: List[str] = []

        for page in pages:
            page_id = page["id"]
            page_name = page.get("name", "Unnamed")
            page_token = page.get("access_token") or access_token
            ig_ref = page.get("instagram_business_account") or page.get("connected_instagram_account")

            if not ig_ref:
                ig_resp = requests.get(
                    f"{graph}/{page_id}",
                    params={
                        "fields": (
                            "instagram_business_account{id,username},"
                            "connected_instagram_account{id,username}"
                        ),
                        "access_token": page_token,
                    },
                    timeout=20,
                )
                ig_data = ig_resp.json()
                logger.info("Page %s (%s) instagram lookup: %s", page_name, page_id, ig_data)
                if "error" not in ig_data:
                    ig_ref = ig_data.get("instagram_business_account") or ig_data.get(
                        "connected_instagram_account"
                    )

            if not ig_ref or not isinstance(ig_ref, dict) or not ig_ref.get("id"):
                pages_without_ig.append(page_name)
                continue

            ig_id = str(ig_ref["id"])
            if ig_id in seen_ig_ids:
                continue
            seen_ig_ids.add(ig_id)

            username = (ig_ref.get("username") or "").strip()
            display_name = ""
            if not username:
                user_resp = requests.get(
                    f"{graph}/{ig_id}",
                    params={"fields": "username,name", "access_token": page_token},
                    timeout=20,
                )
                user_data = user_resp.json()
                if "error" in user_data:
                    logger.warning("Could not load IG user %s: %s", ig_id, user_data)
                    pages_without_ig.append(page_name)
                    continue
                username = user_data.get("username", "Unknown")
                display_name = user_data.get("name", "") or ""

            accounts.append(
                {
                    "instagram_account_id": ig_id,
                    "username": username,
                    "name": display_name,
                    "page_name": page_name,
                    "page_access_token": page_token,
                }
            )

        if not accounts:
            env_ig_id = (settings.INSTAGRAM_ACCOUNT_ID or "").strip()
            if env_ig_id and pages:
                first_page_token = pages[0].get("access_token") or access_token
                logger.info("Trying fallback with INSTAGRAM_ACCOUNT_ID=%s from .env", env_ig_id)
                try:
                    user_resp = requests.get(
                        f"{graph}/{env_ig_id}",
                        params={"fields": "username,name", "access_token": first_page_token},
                        timeout=20,
                    )
                    user_data = user_resp.json()
                    if "error" not in user_data and user_data.get("username"):
                        accounts.append(
                            {
                                "instagram_account_id": env_ig_id,
                                "username": user_data.get("username", "Unknown"),
                                "name": user_data.get("name", ""),
                                "page_name": pages[0].get("name", "Page"),
                                "page_access_token": first_page_token,
                            }
                        )
                        return accounts, pages_without_ig
                except Exception as ex:
                    logger.warning("Fallback exception: %s", ex)

        return accounts, pages_without_ig

    def fetch_account_info_from_token(self, access_token: str) -> dict:
        """Fetch the first Instagram Business account (legacy single-account callers)."""
        accounts, pages_without_ig = self.fetch_all_instagram_accounts_from_token(access_token)
        if accounts:
            acc = accounts[0]
            return {
                "instagram_account_id": acc["instagram_account_id"],
                "username": acc["username"],
                "name": acc.get("name", ""),
                "page_access_token": acc["page_access_token"],
            }

        page_names = ", ".join(pages_without_ig) if pages_without_ig else "your Pages"
        raise RuntimeError(self._format_no_instagram_error(page_names, pages_without_ig))

    @staticmethod
    def _format_no_instagram_error(page_names: str, pages_without_ig: List[str]) -> str:
        extra = ""
        if pages_without_ig:
            extra = (
                f" Pages without a linked Instagram: {', '.join(pages_without_ig)}."
                " Each Page you add must have its own Professional Instagram linked to it."
            )
        return (
            f"Your Facebook Pages ({page_names}) don't have an Instagram Business/Creator account linked.{extra} "
            "To fix: 1) In the Instagram app, open Settings > Account > Switch to Professional account. "
            "2) Settings > Account > Linked Accounts > Facebook — link to the correct Page (e.g. Subramani). "
            "3) Try Add Instagram Account again and grant access to ALL Pages that have Instagram in the Meta popup."
        )

    def connect_all_accounts_for_user(
        self, user_id: int, user_access_token: str, expires_at: datetime
    ) -> Dict[str, Any]:
        """Link every new Instagram account found on the user's Facebook Pages."""
        all_accounts, pages_without_ig = self.fetch_all_instagram_accounts_from_token(user_access_token)

        if not all_accounts:
            page_names = ", ".join(pages_without_ig) if pages_without_ig else "your Pages"
            raise RuntimeError(self._format_no_instagram_error(page_names, pages_without_ig))

        existing = self.get_records(user_id)
        existing_ids = {
            str(r["instagram_account_id"])
            for r in existing
            if r.get("instagram_account_id")
        }

        connected: List[dict] = []
        skipped: List[str] = []

        for acc in all_accounts:
            ig_id = str(acc["instagram_account_id"])
            username = acc.get("username", "Unknown")
            if ig_id in existing_ids:
                skipped.append(username)
                continue
            token_to_store = acc.get("page_access_token") or user_access_token
            self.store_long_lived_token(
                user_id,
                token_to_store,
                expires_at,
                ig_id,
                username,
            )
            connected.append(
                {
                    "instagram_account_id": ig_id,
                    "username": username,
                    "page_name": acc.get("page_name", ""),
                }
            )
            existing_ids.add(ig_id)

        if not connected:
            if skipped:
                names = ", ".join(f"@{u}" for u in skipped)
                raise RuntimeError(
                    f"Instagram account(s) {names} are already connected. "
                    "To add Subramani (or another account), link that Instagram as a Professional account "
                    "to its Facebook Page in the Instagram app, then run Add Instagram Account again "
                    "and allow access to that Page in the Meta login window."
                )
            page_names = ", ".join(pages_without_ig) if pages_without_ig else "selected Pages"
            raise RuntimeError(self._format_no_instagram_error(page_names, pages_without_ig))

        return {
            "connected": connected,
            "skipped_usernames": skipped,
            "pages_without_instagram": pages_without_ig,
        }

    def _raise_for_meta_error(self, data: dict):
        error = data.get("error", {})
        code = error.get("code")
        message = error.get("message", "Unknown Meta error")
        if code == 190:
            raise InstagramReauthRequired(message)
        raise RuntimeError(f"Meta error {code}: {message}")

    # Legacy method compatibility
    # Legacy method compatibility
    def connect_user_from_env(self, user_id: int) -> dict:
        """Link Instagram for one user using PAGE_ACCESS_TOKEN from .env (no token exchange)."""
        env_token = (settings.PAGE_ACCESS_TOKEN or "").strip()
        env_ig_id = (settings.INSTAGRAM_ACCOUNT_ID or "").strip()
        
        # Check if the env account is already connected and active
        if env_ig_id:
            existing = self.get_record_by_account_id(env_ig_id)
            if existing and existing.get('user_id') == user_id and existing.get('status') == 'active':
                return {
                    "instagram_account_id": env_ig_id,
                    "username": existing.get('username'),
                    "name": "",
                }

        if not env_token:
            raise RuntimeError(
                "PAGE_ACCESS_TOKEN is not set in .env. Add your Meta page access token, then restart the server."
            )
        if not self._verify_token_live(env_token):
            raise RuntimeError(
                "PAGE_ACCESS_TOKEN in .env is expired or invalid. Generate a new token in Meta Graph API Explorer."
            )
        account_info = self.fetch_account_info_from_token(env_token)
        expires_at = datetime.now(timezone.utc) + timedelta(days=60)
        token_to_store = account_info.get("page_access_token") or env_token
        self.store_long_lived_token(
            user_id,
            token_to_store,
            expires_at,
            account_info.get("instagram_account_id") or settings.INSTAGRAM_ACCOUNT_ID,
            account_info.get("username"),
        )
        return {k: v for k, v in account_info.items() if k != "page_access_token"}

    def bootstrap_from_env(self):
        if not settings.PAGE_ACCESS_TOKEN:
            return

        env_token = settings.PAGE_ACCESS_TOKEN.strip()
        if not env_token:
            return

        if not self._verify_token_live(env_token):
            logger.warning("PAGE_ACCESS_TOKEN in .env is expired or invalid; bootstrap skipped.")
            return

        try:
            account_info = self.fetch_account_info_from_token(env_token)
        except Exception as e:
            logger.warning(f"Could not fetch account info from .env token: {e}")
            return

        expires_at = datetime.now(timezone.utc) + timedelta(days=60)
        with db.get_connection() as conn:
            cursor = conn.execute("SELECT id FROM users")
            user_ids = [r["id"] for r in cursor.fetchall()]
            if not user_ids:
                user_ids = [1]
            cursor = conn.execute("SELECT user_id, expires_at, username, instagram_account_id FROM instagram_accounts")
            rows = cursor.fetchall()
            env_ig_id = (account_info.get("instagram_account_id") or settings.INSTAGRAM_ACCOUNT_ID or "").strip()
            for uid in user_ids:
                refresh_row = True
                if rows and env_ig_id:
                    # Find if this user already has the ENV account ID in the rows
                    row = next((r for r in rows if r["user_id"] == uid and r["instagram_account_id"] == env_ig_id), None)
                    if row:
                        try:
                            row_expires = datetime.fromisoformat(row["expires_at"])
                            has_valid_token = row_expires > datetime.now(timezone.utc)
                            has_username = row.get("username") and row["username"] != "env_account"
                            if has_valid_token and has_username:
                                refresh_row = False
                        except Exception:
                            pass

                if refresh_row:
                    token_to_store = account_info.get("page_access_token") or env_token
                    self.store_long_lived_token(
                        uid,
                        token_to_store,
                        expires_at,
                        env_ig_id,
                        account_info.get("username"),
                    )
        logger.info("Instagram credentials synced from .env for %s user(s).", len(user_ids))

    def scheduled_refresh(self, within_days=10):
        # Could iterate all users and refresh if needed
        pass
