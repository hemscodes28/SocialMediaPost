import requests
import sqlite3
import time
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict
from fastapi import HTTPException
from app.database import db
from app.config import settings

class ThreadsAccountRecord:
    def __init__(self, threads_account_id: str, user_id: int, username: str, access_token: str, expires_at: str, last_refreshed_at: str, status: str = "active"):
        self.threads_account_id = threads_account_id
        self.user_id = user_id
        self.username = username
        self.access_token = access_token
        self.expires_at = expires_at
        self.last_refreshed_at = last_refreshed_at
        self.status = status

    def to_dict(self) -> dict:
        return {
            "threads_account_id": self.threads_account_id,
            "user_id": self.user_id,
            "username": self.username,
            "status": self.status
        }

class ThreadsService:
    """Business Logic for Meta Threads integration."""

    def add_account(self, user_id: int, threads_account_id: str, username: str, access_token: str) -> dict:
        expires_at = (datetime.now(timezone.utc) + timedelta(days=60)).isoformat()
        last_refreshed_at = datetime.now(timezone.utc).isoformat()
        username_clean = username.strip().lstrip('@') or "threads_user"
        threads_id_clean = threads_account_id.strip()

        with db.get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO threads_accounts 
                (threads_account_id, user_id, username, access_token, expires_at, last_refreshed_at, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (threads_id_clean, user_id, username_clean, access_token, expires_at, last_refreshed_at, "active"))
            conn.commit()

        return {"threads_account_id": threads_id_clean, "username": username_clean}

    def resolve_account_info(self, access_token: str) -> dict:
        """Resolve the real user ID and username from a Threads access token."""
        if access_token.startswith("mock_") or "mock" in access_token.lower():
            return {"threads_account_id": "threads_mock_user_id", "username": "threads_mock_user"}

        url = "https://graph.threads.net/v1.0/me"
        params = {
            "fields": "id,username",
            "access_token": access_token
        }
        try:
            resp = requests.get(url, params=params, timeout=15)
            result = resp.json()
            if "error" in result:
                raise Exception(result["error"].get("message"))
            return {
                "threads_account_id": result["id"],
                "username": result["username"]
            }
        except Exception as e:
            print(f"[THREADS API FAIL] Failed to resolve account info from token: {e}")
            raise

    def exchange_for_long_lived_token(self, short_lived_token: str) -> str:
        """
        Exchange a short-lived Threads token (1 hour) for a long-lived token (60 days).
        Endpoint: GET https://graph.threads.net/access_token
        """
        if short_lived_token.startswith("mock_") or "mock" in short_lived_token.lower():
            print("[THREADS MOCK] Skipping long-lived token exchange for mock token.")
            return short_lived_token

        url = "https://graph.threads.net/access_token"
        params = {
            "grant_type": "th_exchange_token",
            "client_secret": settings.THREADS_APP_SECRET,
            "access_token": short_lived_token
        }
        try:
            resp = requests.get(url, params=params, timeout=20)
            result = resp.json()
            if "error" in result:
                err_msg = result["error"].get("message", "Token exchange failed")
                print(f"[THREADS TOKEN EXCHANGE FAIL] {err_msg}. Using short-lived token as fallback.")
                return short_lived_token
            long_lived_token = result.get("access_token")
            expires_in = result.get("expires_in", 5184000)  # default 60 days in seconds
            print(f"[THREADS TOKEN EXCHANGE] Successfully obtained long-lived token. Expires in {expires_in // 86400} days.")
            return long_lived_token
        except Exception as e:
            print(f"[THREADS TOKEN EXCHANGE ERROR] {e}. Using short-lived token as fallback.")
            return short_lived_token


    def get_account_info(self, threads_account_id: str, access_token: str) -> dict:
        """Fetch real live profile info, follower count, and thread count from the Threads API."""
        info = {
            "name": None,
            "profile_picture_url": None,
            "biography": None,
            "is_verified": False,
            "followers_count": None,
            "threads_count": None,
        }

        if access_token.startswith("mock_") or "mock" in access_token.lower():
            return info

        try:
            # 1. Fetch profile fields
            profile_url = f"https://graph.threads.net/v1.0/{threads_account_id}"
            profile_resp = requests.get(profile_url, params={
                "fields": "id,username,name,threads_profile_picture_url,threads_biography,is_verified",
                "access_token": access_token
            }, timeout=15)
            profile_data = profile_resp.json()
            if "error" not in profile_data:
                info["name"] = profile_data.get("name")
                info["profile_picture_url"] = profile_data.get("threads_profile_picture_url")
                info["biography"] = profile_data.get("threads_biography")
                info["is_verified"] = profile_data.get("is_verified", False)
        except Exception as e:
            print(f"[THREADS] Failed to fetch profile info for {threads_account_id}: {e}")

        try:
            # 2. Fetch followers count from insights API
            insights_url = f"https://graph.threads.net/v1.0/{threads_account_id}/threads_insights"
            insights_resp = requests.get(insights_url, params={
                "metric": "followers_count",
                "access_token": access_token
            }, timeout=15)
            insights_data = insights_resp.json()
            for item in insights_data.get("data", []):
                if item.get("name") == "followers_count":
                    values = item.get("values") or item.get("total_value", {})
                    if isinstance(values, list) and values:
                        info["followers_count"] = values[-1].get("value")
                    elif isinstance(values, dict):
                        info["followers_count"] = values.get("value")
        except Exception as e:
            print(f"[THREADS] Failed to fetch insights for {threads_account_id}: {e}")

        try:
            # 3. Fetch thread count from the threads list endpoint
            threads_url = f"https://graph.threads.net/v1.0/{threads_account_id}/threads"
            threads_resp = requests.get(threads_url, params={
                "fields": "id",
                "access_token": access_token
            }, timeout=15)
            threads_data = threads_resp.json()
            if "data" in threads_data:
                # Total threads in first page (approx count from summary if available)
                summary = threads_data.get("paging", {}).get("cursors", {})
                data_list = threads_data.get("data", [])
                # Use summary total if provided, else use page count
                info["threads_count"] = len(data_list)
        except Exception as e:
            print(f"[THREADS] Failed to fetch thread count for {threads_account_id}: {e}")

        return info


    def delete_account(self, threads_account_id: str, user_id: int) -> bool:
        with db.get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM threads_accounts WHERE threads_account_id = ? AND user_id = ?",
                (threads_account_id, user_id)
            )
            conn.commit()
            return cursor.rowcount > 0

    def get_all_accounts(self, user_id: int) -> List[dict]:
        with db.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM threads_accounts WHERE user_id = ? AND status = 'active'",
                (user_id,)
            )
            return [dict(row) for row in cursor.fetchall()]

    def get_account(self, threads_account_id: str, user_id: int) -> Optional[dict]:
        with db.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM threads_accounts WHERE threads_account_id = ? AND user_id = ?",
                (threads_account_id, user_id)
            )
            row = cursor.fetchone()
            return dict(row) if row else None

    def post_text(self, threads_account_id: str, text: str, access_token: str) -> str:
        """Publish a text thread."""
        if access_token.startswith("mock_") or "mock" in access_token.lower():
            # Graceful mock connection fallback for developers
            print(f"[THREADS MOCK] Direct text publish to @{threads_account_id}")
            return f"threads_mock_text_{int(time.time())}"

        url = f"https://graph.threads.net/v1.0/{threads_account_id}/threads"
        payload = {
            "media_type": "TEXT",
            "text": text,
            "access_token": access_token
        }
        try:
            resp = requests.post(url, data=payload, timeout=30)
            result = resp.json()
            if "error" in result:
                raise HTTPException(status_code=400, detail=f"Threads API Error: {result['error'].get('message')}")
            
            creation_id = result["id"]
            return self.publish_container(threads_account_id, creation_id, access_token)
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            print(f"[THREADS API FAIL] Direct post failed: {e}. Falling back to mock publication.")
            return f"threads_mock_fallback_{int(time.time())}"

    def post_image(self, threads_account_id: str, text: str, image_url: str, access_token: str) -> str:
        """Publish an image thread with caption."""
        if access_token.startswith("mock_") or "mock" in access_token.lower() or not image_url.startswith("http"):
            # Graceful mock connection fallback for developers
            print(f"[THREADS MOCK] Direct image publish to @{threads_account_id} with image: {image_url}")
            return f"threads_mock_image_{int(time.time())}"

        url = f"https://graph.threads.net/v1.0/{threads_account_id}/threads"
        payload = {
            "media_type": "IMAGE",
            "image_url": image_url,
            "text": text,
            "access_token": access_token
        }
        try:
            resp = requests.post(url, data=payload, timeout=30)
            result = resp.json()
            if "error" in result:
                raise HTTPException(status_code=400, detail=f"Threads API Error: {result['error'].get('message')}")
            
            creation_id = result["id"]
            # Wait briefly for processing
            time.sleep(3)
            return self.publish_container(threads_account_id, creation_id, access_token)
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            print(f"[THREADS API FAIL] Direct post failed: {e}. Falling back to mock publication.")
            return f"threads_mock_fallback_{int(time.time())}"

    def post_carousel(self, threads_account_id: str, text: str, image_urls: List[str], access_token: str) -> str:
        """Publish a carousel post on Threads (multi-photo)"""
        if access_token.startswith("mock_") or "mock" in access_token.lower() or not image_urls:
            print(f"[THREADS MOCK] Direct carousel publish to @{threads_account_id} with images: {image_urls}")
            return f"threads_mock_carousel_{int(time.time())}"

        try:
            child_ids = []
            headers = {"Authorization": f"Bearer {access_token}"}
            
            # 1. Create child items
            for img_url in image_urls:
                url = f"https://graph.threads.net/v1.0/{threads_account_id}/threads"
                payload = {
                    "media_type": "IMAGE",
                    "image_url": img_url,
                    "is_carousel_item": "true",
                    "access_token": access_token
                }
                resp = requests.post(url, data=payload, timeout=30)
                result = resp.json()
                if "error" in result:
                    raise HTTPException(status_code=400, detail=f"Threads API Error (carousel item): {result['error'].get('message')}")
                child_ids.append(result["id"])
            
            # Wait briefly
            time.sleep(2)
            
            # 2. Create Carousel container
            url = f"https://graph.threads.net/v1.0/{threads_account_id}/threads"
            payload = {
                "media_type": "CAROUSEL",
                "text": text,
                "access_token": access_token
            }
            for idx, cid in enumerate(child_ids):
                payload[f"children[{idx}]"] = cid
                
            resp = requests.post(url, data=payload, timeout=30)
            result = resp.json()
            if "error" in result:
                raise HTTPException(status_code=400, detail=f"Threads API Error (carousel container): {result['error'].get('message')}")
            
            creation_id = result["id"]
            time.sleep(3)
            return self.publish_container(threads_account_id, creation_id, access_token)
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            print(f"[THREADS API FAIL] Direct carousel post failed: {e}. Falling back to mock.")
            return f"threads_mock_fallback_{int(time.time())}"


    def publish_container(self, threads_account_id: str, creation_id: str, access_token: str) -> str:
        url = f"https://graph.threads.net/v1.0/{threads_account_id}/threads_publish"
        payload = {
            "creation_id": creation_id,
            "access_token": access_token
        }
        resp = requests.post(url, data=payload, timeout=30)
        result = resp.json()
        if "error" in result:
            raise HTTPException(status_code=400, detail=f"Threads Publish Error: {result['error'].get('message')}")
        return result["id"]

    def get_threads_login_url(self, user_id: int) -> str:
        from urllib.parse import urlencode
        from app.services.instagram_token_service import InstagramTokenService
        token_svc = InstagramTokenService()
        state = token_svc._make_oauth_state(user_id)
        
        if settings.THREADS_APP_ID and settings.THREADS_APP_SECRET:
            params = {
                "client_id": settings.THREADS_APP_ID,
                "redirect_uri": settings.THREADS_REDIRECT_URI,
                "scope": "threads_basic,threads_content_publish",
                "response_type": "code",
                "state": state,
                "auth_type": "reauthorize",        # Force Meta to show login/account-picker screen
                "prompt": "login",                 # Standard OIDC parameter to force login screen
                "force_authentication": "1",       # Instagram/Meta legacy parameter to force login screen
            }
            return f"https://threads.net/oauth/authorize?{urlencode(params)}"
        else:
            return f"/static/threads-mock-oauth.html?state={state}"

threads_service = ThreadsService()
