"""
Instagram Auto Post API - Main Application
Overhauled for Premium UI & Persistent Scheduling

"""

from app.services.openai_service import CaptionGenerationError
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException, BackgroundTasks, File, UploadFile, Form, Depends, status, Request
from pydantic import BaseModel
from typing import Literal
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
from pathlib import Path
import asyncio
import time
import os
from urllib.parse import quote, urlencode

PROJECT_ROOT = Path(__file__).resolve().parent

from app.models import (
    InstagramPostResponse, HealthCheck, InstagramMultiPostResponse,
    LinkedInPostResponse, LinkedInAccount,
    ScheduledPostResponse, ScheduledJobInfo, ScheduledJobsListResponse,
    User, UserLogin, Token, FirebaseAuthResponse
)
from app.services.auth_service import auth_service
from app.config import settings, APP_PUBLIC_URL
from app.services import ImageService, InstagramService
from app.services.openai_service import openai_service
from app.services.linkedin_service import LinkedInService
from app.database import db
import app.services.scheduler_service as scheduler_svc
from app.services.threads_service import threads_service
from app.services.instagram_token_service import InstagramTokenService, InstagramReauthRequired
from app.services.google_auth_service import verify_google_id_token, random_password_for_oauth_user
from app.services.firebase_auth_service import verify_firebase_id_token, claims_to_profile
from app.services.email_service import send_otp_email
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles

# Initialize basic services
image_service = ImageService()
instagram_service = InstagramService()
linkedin_service = LinkedInService()
token_service = InstagramTokenService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """ Startup/shutdown hooks: persistent scheduler initialization. """
    # Bootstrap tokens
    try:
        token_service.bootstrap_from_env()
    except Exception as e:
        print(f"[WARN] Token bootstrap warning: {e}")

    print(f"[INFO] APP_PUBLIC_URL={APP_PUBLIC_URL or '(not set — using localhost OAuth URIs)'}")
    print(f"[INFO] LinkedIn OAuth redirect_uri={settings.LINKEDIN_REDIRECT_URI}")
    print(f"[INFO] Meta/Facebook OAuth redirect_uri={settings.FB_REDIRECT_URI}")

    # APScheduler Setup with SQLite Persistence
    from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
    from apscheduler.jobstores.memory import MemoryJobStore
    from apscheduler.executors.pool import ThreadPoolExecutor

    scheduler_db = PROJECT_ROOT / "scheduler.db"
    jobstores = {
        "default": SQLAlchemyJobStore(url=f"sqlite:///{scheduler_db.as_posix()}"),
        "memory": MemoryJobStore(),
    }
    executors = {
        "default": ThreadPoolExecutor(max_workers=5)
    }
    scheduler = BackgroundScheduler(
        jobstores=jobstores,
        executors=executors,
        timezone="UTC",
        job_defaults={"misfire_grace_time": 300}
    )
    
    # Token refresh (memory-based)
    scheduler.add_job(
        token_service.scheduled_refresh,
        trigger="interval",
        days=1,
        kwargs={"within_days": 10},
        id="instagram_token_daily_refresh",
        jobstore="memory",
        replace_existing=True,
    )
    
    scheduler.start()
    app.state.scheduler = scheduler
    yield
    scheduler.shutdown(wait=False)

app = FastAPI(
    title="SocialMediaAutomation Elite",
    description="Premium Social Media Management Engine",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request
@app.post("/api/debug-log")
async def debug_log(request: Request):
    body = await request.body()
    log_text = body.decode("utf-8")
    print("\n" + "="*40 + "\nFRONTEND DEBUG LOG:\n" + log_text + "\n" + "="*40 + "\n")
    with open("InsideWorkspace/scratch/frontend_debug.log", "w", encoding="utf-8") as f:
        f.write(log_text)
    return {"status": "ok"}

STATIC_DIR = PROJECT_ROOT / "static"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

def _compliance_page_response(filename: str) -> FileResponse:
    path = STATIC_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Page not found")
    return FileResponse(path, media_type="text/html")


@app.get("/privacy.html", include_in_schema=False)
async def privacy_page():
    return _compliance_page_response("privacy.html")


@app.get("/terms.html", include_in_schema=False)
async def terms_page():
    return _compliance_page_response("terms.html")


@app.get("/delete-data.html", include_in_schema=False)
async def delete_data_page():
    return _compliance_page_response("delete-data.html")


@app.get("/reset-password.html", include_in_schema=False)
async def reset_password_page():
    return _compliance_page_response("reset-password.html")


@app.get("/")
async def root():
    return RedirectResponse(url="/static/landing.html")


@app.get("/api/config/oauth")
async def oauth_redirect_config():
    """Public check: which redirect URIs the server sends to LinkedIn/Meta (must match developer consoles)."""
    return {
        "app_public_url": APP_PUBLIC_URL or None,
        "linkedin_redirect_uri": settings.LINKEDIN_REDIRECT_URI,
        "facebook_redirect_uri": settings.FB_REDIRECT_URI,
        "linkedin_configured": bool(settings.LINKEDIN_CLIENT_ID and settings.LINKEDIN_CLIENT_SECRET),
        "facebook_configured": bool(settings.FB_APP_ID and settings.FB_APP_SECRET),
        "hint": "Add these redirect_uri values exactly in your LinkedIn and Meta app settings, then restart the server after changing .env.",
    }

# ---------------------------------------------------------------------------
# Authentication & User Profile
# ---------------------------------------------------------------------------

@app.post("/api/auth/signup", response_model=User)
async def signup(user: User):
    db_user = await auth_service.get_user_by_email(user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return await auth_service.create_user(user)

@app.post("/api/auth/login")
async def login(user_data: UserLogin):
    user = await auth_service.get_user_by_email(user_data.email)
    if not user or not auth_service.verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    code = await auth_service.generate_and_save_otp(user.email)
    send_otp_email(user.email, code)
    
    return {
        "otp_required": True,
        "email": user.email
    }


class GoogleAuthRequest(BaseModel):
    credential: str
    mode: Literal["login", "signup"] = "login"


@app.get("/api/auth/google/config")
async def google_auth_config():
    return {"client_id": settings.GOOGLE_CLIENT_ID or None}


@app.post("/api/auth/google")
async def google_auth(body: GoogleAuthRequest):
    try:
        profile = verify_google_id_token(body.credential)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    existing = await auth_service.get_user_by_email(profile["email"])

    if body.mode == "signup":
        if existing:
            token = auth_service.create_access_token(data={"sub": existing.email})
            return {
                "action": "login",
                "access_token": token,
                "token_type": "bearer",
                "message": "Account already exists. Signed you in.",
            }
        return {
            "action": "prefill",
            "email": profile["email"],
            "full_name": profile["full_name"],
        }

    if not existing:
        return {
            "action": "signup",
            "email": profile["email"],
            "full_name": profile["full_name"],
        }

    token = auth_service.create_access_token(data={"sub": existing.email})
    return {"action": "login", "access_token": token, "token_type": "bearer"}


class FirebaseAuthRequest(BaseModel):
    id_token: str
    full_name: Optional[str] = None


@app.post("/api/auth/firebase")
async def firebase_auth(body: FirebaseAuthRequest):
    """Verify Firebase ID token, sync user into accounts.db, return OTP required."""
    try:
        claims = verify_firebase_id_token(body.id_token)
    except Exception as exc:
        print(f"[WARN] Firebase token verification failed: {exc}")
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase token.")

    profile = claims_to_profile(claims, fallback_name=body.full_name)
    email = profile["email"]
    if not email:
        raise HTTPException(status_code=400, detail="Firebase account did not provide an email.")

    try:
        user, created = await auth_service.ensure_local_user(
            email,
            profile["full_name"],
            firebase_uid=profile.get("firebase_uid"),
            auth_provider=profile.get("auth_provider") or "firebase",
        )
    except Exception as exc:
        print(f"[ERROR] Failed to sync Firebase user to accounts.db: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Could not save your account locally. Please try again.",
        )

    code = await auth_service.generate_and_save_otp(email)
    send_otp_email(email, code)

    print(f"[INFO] Firebase credentials verified, OTP sent: email={email} created={created}")
    return {
        "otp_required": True,
        "email": email,
        "created": created
    }


class VerifyOTPRequest(BaseModel):
    email: str
    code: str
    id_token: Optional[str] = None
    password: Optional[str] = None
    full_name: Optional[str] = None


class ResendOTPRequest(BaseModel):
    email: str
    id_token: Optional[str] = None
    password: Optional[str] = None
    full_name: Optional[str] = None


@app.post("/api/auth/verify-otp")
async def verify_otp(body: VerifyOTPRequest):
    """Verify OTP and return app JWT access token."""
    # 1. Verify OTP code
    otp_ok = await auth_service.verify_otp_code(body.email, body.code)
    if not otp_ok:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    # 2. Re-verify credential for security
    if body.id_token:
        try:
            claims = verify_firebase_id_token(body.id_token)
        except Exception as exc:
            raise HTTPException(status_code=401, detail="Invalid or expired credentials.")
        
        profile = claims_to_profile(claims, fallback_name=body.full_name)
        if profile["email"] != body.email.strip().lower():
            raise HTTPException(status_code=400, detail="Credential email mismatch.")
        
        user, created = await auth_service.ensure_local_user(
            body.email,
            profile["full_name"],
            firebase_uid=profile.get("firebase_uid"),
            auth_provider=profile.get("auth_provider") or "firebase",
        )
        access_token = auth_service.create_access_token(data={"sub": body.email})
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user,
            "created": created,
            "local_account_synced": True,
        }
        
    elif body.password:
        user = await auth_service.get_user_by_email(body.email)
        if not user or not auth_service.verify_password(body.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid or expired credentials.")
        
        access_token = auth_service.create_access_token(data={"sub": body.email})
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user,
            "created": False,
            "local_account_synced": True,
        }
    else:
        raise HTTPException(status_code=400, detail="Credentials required for verification.")


@app.post("/api/auth/resend-otp")
async def resend_otp(body: ResendOTPRequest):
    """Resend OTP code after verifying credentials."""
    if body.id_token:
        try:
            claims = verify_firebase_id_token(body.id_token)
        except Exception as exc:
            raise HTTPException(status_code=401, detail="Invalid credentials.")
        profile = claims_to_profile(claims, fallback_name=body.full_name)
        if profile["email"] != body.email.strip().lower():
            raise HTTPException(status_code=400, detail="Credential email mismatch.")
    elif body.password:
        user = await auth_service.get_user_by_email(body.email)
        if not user or not auth_service.verify_password(body.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials.")
    else:
        raise HTTPException(status_code=400, detail="Credentials required to resend verification code.")
        
    code = await auth_service.generate_and_save_otp(body.email)
    send_otp_email(body.email, code)
    return {
        "success": True,
        "email": body.email
    }


@app.get("/api/auth/me", response_model=User)
async def get_me(current_user: User = Depends(auth_service.get_current_user)):
    return current_user

# ---------------------------------------------------------------------------
# AI Magic & Core Engine Utilities
# ---------------------------------------------------------------------------

@app.post("/api/ai/analyze-image")
async def analyze_image(
    file: UploadFile = File(...),
    topic: Optional[str] = Form(None),
    tone: Optional[str] = Form(None),
    current_user: User = Depends(auth_service.get_current_user)
):
    """Visual Analysis & Caption Generation"""
    file_path = None
    try:
        file_path = await image_service.save_upload(file)
        results = await openai_service.generate_multi_captions(
            topic=topic,
            image_path=str(file_path),
            tone=tone
        )
        return results
    except CaptionGenerationError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Caption generation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Caption generation failed. Please try again."
        )
    finally:
        if file_path:
            image_service.cleanup_file(file_path)

@app.post("/generate-caption")
@app.post("/api/ai/generate-caption")
async def generate_caption_route(
    prompt: str = Form(...),
    platform: Optional[str] = Form("instagram"),
    tone: Optional[str] = Form("casual"),
):
    """Text-based AI Caption Generation"""
    try:
        results = await openai_service.generate_caption(
            platform=platform,
            topic=prompt,
            tone=tone
        )
        return results
    except CaptionGenerationError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        print(f"[ERROR] Caption generation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Caption generation failed. Please try again."
        )

@app.post("/api/ai/generate-multi-captions")
async def generate_multi_captions_route(
    prompt: str = Form(...),
    tone: Optional[str] = Form("casual"),
    current_user: User = Depends(auth_service.get_current_user)
):
    """Text-based Multi-platform Caption Generation"""
    try:
        results = await openai_service.generate_multi_captions(
            topic=prompt,
            tone=tone
        )
        return results
    except CaptionGenerationError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        print(f"[ERROR] Multi-caption generation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Multi-caption generation failed. Please try again."
        )

            
@app.get("/api/jobs")
async def list_jobs(current_user: User = Depends(auth_service.get_current_user)):
    """Retrieve all missions (scheduled, published, failed)"""
    return scheduler_svc.list_jobs(current_user.id)

@app.get("/api/user/stats")
async def get_user_stats(current_user: User = Depends(auth_service.get_current_user)):
    """Aggregate mission metrics for the USER DASHBOARD"""
    return scheduler_svc.get_stats(current_user.id)

@app.delete("/api/jobs/{job_id}")
async def cancel_job(job_id: str, current_user: User = Depends(auth_service.get_current_user)):
    """Abort a MISSION-IN-PROGRESS"""
    success = scheduler_svc.cancel_job(app.state.scheduler, job_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Mission not found or already executed.")
    return {"success": True, "message": "Mission aborted successfully."}

# ---------------------------------------------------------------------------
# Platform Account Connections
# ---------------------------------------------------------------------------

@app.get("/api/platforms/instagram/account")
async def get_insta_acc(current_user: User = Depends(auth_service.get_current_user)):
    record = token_service.get_record(current_user.id)
    if not record or record.get('status') != 'active':
        return {"connected": False}
    return {"connected": True, "username": record.get("username"), "id": record.get("instagram_account_id")}

@app.get("/api/platforms/instagram/accounts")
async def get_insta_accounts(current_user: User = Depends(auth_service.get_current_user)):
    records = token_service.get_records(current_user.id)
    return [{"instagram_account_id": r["instagram_account_id"], "username": r["username"], "status": r["status"]} for r in records if r["status"] == "active"]

@app.get("/api/platforms/instagram/accounts/detailed")
async def get_insta_accounts_detailed(current_user: User = Depends(auth_service.get_current_user)):
    records = token_service.get_records(current_user.id)
    detailed = []
    for record in records:
        if record.get("status") != "active":
            continue
        instagram_account_id = record.get("instagram_account_id")
        username = record.get("username")
        info = {
            "instagram_account_id": instagram_account_id,
            "username": username,
            "status": record.get("status"),
            "name": f"@{username}" if username else "Instagram Account",
            "profile_picture_url": None,
            "followers_count": 0,
            "follows_count": 0,
            "media_count": 0,
            "biography": "Instagram profile information is unavailable. Reconnect to refresh.",
        }
        try:
            access_token = token_service.get_access_token_for_account(instagram_account_id, username)
            account_info = instagram_service.get_account_info(access_token, instagram_account_id)
            info.update({
                "name": account_info.get("name") or f"@{username}",
                "profile_picture_url": account_info.get("profile_picture_url"),
                "followers_count": account_info.get("followers_count", 0),
                "follows_count": account_info.get("follows_count", 0),
                "media_count": account_info.get("media_count", 0),
                "biography": account_info.get("biography", "Instagram Business / Creator account."),
            })
        except InstagramReauthRequired:
            info.update({
                "biography": "Reconnect this Instagram account to refresh profile details.",
            })
        except Exception as e:
            info.update({
                "biography": f"Unable to fetch profile data: {str(e)}",
            })
        detailed.append(info)
    return detailed

@app.delete("/api/platforms/instagram/accounts/{instagram_account_id}")
async def disconnect_insta_account(instagram_account_id: str, username: Optional[str] = None, current_user: User = Depends(auth_service.get_current_user)):
    with db.get_connection() as conn:
        if username:
            conn.execute("DELETE FROM instagram_accounts WHERE instagram_account_id = ? AND username = ? AND user_id = ?", (instagram_account_id, username, current_user.id))
        else:
            conn.execute("DELETE FROM instagram_accounts WHERE instagram_account_id = ? AND user_id = ?", (instagram_account_id, current_user.id))
        conn.commit()
    return {"success": True, "message": "Instagram account disconnected."}

@app.post("/api/platforms/instagram/connect")
async def connect_instagram(current_user: User = Depends(auth_service.get_current_user)):
    """Connect Instagram using PAGE_ACCESS_TOKEN from .env (recommended for local dev)."""
    try:
        acc_info = token_service.connect_user_from_env(current_user.id)
        return {"success": True, "account": acc_info}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Instagram sync failed: {e}")


@app.post("/api/platforms/instagram/connect-direct")
async def connect_instagram_direct(
    access_token: str = Form(...),
    instagram_account_id: str = Form(...),
    username: str = Form(...),
    current_user: User = Depends(auth_service.get_current_user)
):
    """Directly connect any Instagram account by saving token+ID to DB. Auto-resolves correct ID from Meta if possible."""
    try:
        token_clean = access_token.strip()
        # Try to automatically resolve correct ID and username from Meta using the token!
        try:
            acc_info = token_service.fetch_account_info_from_token(token_clean)
            resolved_id = acc_info.get("instagram_account_id")
            resolved_username = acc_info.get("username")
            resolved_token = acc_info.get("page_access_token") or token_clean
            
            if resolved_id and resolved_username:
                instagram_account_id = resolved_id
                username = resolved_username
                token_clean = resolved_token
                print(f"[AUTO-RESOLVE] Successfully resolved account to @{username} (ID: {instagram_account_id})")
        except Exception as e:
            print(f"[AUTO-RESOLVE FAIL] Could not auto-resolve account info from token: {e}")
            # Fall back to user's manual inputs

        ig_username = username.strip().lstrip('@') or "instagram_account"
        expires_at = datetime.now(timezone.utc) + timedelta(days=60)
        token_service.store_long_lived_token(
            current_user.id,
            token_clean,
            expires_at,
            instagram_account_id.strip(),
            ig_username
        )
        return {"success": True, "account": {"instagram_account_id": instagram_account_id.strip(), "username": ig_username}}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Instagram connection failed: {e}")


@app.post("/auth/instagram/exchange-token")
async def exchange_insta_token(short_lived_token: str = Form(...), current_user: User = Depends(auth_service.get_current_user)):
    if not settings.FB_APP_ID or not settings.FB_APP_SECRET:
        raise HTTPException(
            status_code=400,
            detail="Facebook app not configured. Set FB_APP_ID and FB_APP_SECRET in your .env file (SocialMediaAutomation/.env or the parent folder).",
        )
    try:
        long_token, expires_at = token_service.exchange_short_lived_token(short_lived_token)
        acc_info = token_service.fetch_account_info_from_token(long_token)
        token_to_store = acc_info.get("page_access_token") or long_token
        token_service.store_long_lived_token(
            current_user.id, token_to_store, expires_at,
            acc_info.get("instagram_account_id"), acc_info.get("username"),
        )
        safe_account = {k: v for k, v in acc_info.items() if k != "page_access_token"}
        return {"success": True, "account": safe_account}
    except InstagramReauthRequired as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Instagram sync failed: {e}")


@app.get("/api/platforms/instagram/oauth")
async def instagram_oauth_start(request: Request, current_user: User = Depends(auth_service.get_current_user)):
    """Redirect to Facebook Login so the user can authorize Instagram (Business) via Meta."""
    try:
        # If running locally on HTTP, redirect to local mock OAuth login to bypass HTTPS SSL requirement
        is_local_http = request.url.scheme == "http" and ("localhost" in request.url.netloc or "127.0.0.1" in request.url.netloc)
        if is_local_http:
            from urllib.parse import urlencode
            from app.services.instagram_token_service import InstagramTokenService
            token_svc = InstagramTokenService()
            state = token_svc._make_oauth_state(current_user.id)
            return RedirectResponse(f"/static/instagram-mock-oauth.html?state={state}")

        return RedirectResponse(token_service.get_meta_login_url(current_user.id))
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/platforms/facebook/callback")
@app.get("/api/platforms/instagram/callback")
async def facebook_oauth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
):
    """OAuth redirect from Meta (Facebook Login). Completes linking for the app user encoded in `state`."""
    if error:
        msg = error_description or error
        print(f"[WARN] Meta OAuth returned error: {msg}")
        return RedirectResponse(f"/static/connection-error.html?platform=instagram&message={quote(msg)}")
    if not code or not state:
        return RedirectResponse(
            "/static/connection-error.html?platform=instagram&message=Missing%20authorization%20code%20or%20state"
        )
    try:
        print("[INFO] Processing Meta/Instagram OAuth callback...")
        user_id = token_service.get_user_id_from_oauth_state(state)
        print(f"  [OK] User ID from state: {user_id}")
        
        if code.startswith("mock_") or "mock" in code.lower():
            env_token = (settings.PAGE_ACCESS_TOKEN or "").strip()
            if env_token and not (env_token.startswith("mock_") or "mock" in env_token.lower()):
                print("[INSTAGRAM MOCK CALLBACK] Real PAGE_ACCESS_TOKEN found in .env. Attempting real connection...")
                try:
                    expires_at = datetime.now(timezone.utc) + timedelta(days=60)
                    result = token_service.connect_all_accounts_for_user(user_id, env_token, expires_at)
                    connected = result.get("connected") or []
                    print(f"  [SUCCESS] Connected real Instagram account(s) from PAGE_ACCESS_TOKEN: {connected}")
                except Exception as e:
                    print(f"  [ERROR] Failed to connect real Instagram account using PAGE_ACCESS_TOKEN: {e}")
                    # Fallback to mock behavior
                    parts = code.split("_")
                    username = parts[1] if len(parts) > 1 else "instagram_mock_user"
                    instagram_account_id = parts[2] if len(parts) > 2 else "instagram_mock_user_id"
                    expires_at = datetime.now(timezone.utc) + timedelta(days=60)
                    token_service.store_long_lived_token(
                        user_id=user_id,
                        long_token=code,
                        expires_at=expires_at,
                        account_id=instagram_account_id,
                        username=username
                    )
                    connected = [{"instagram_account_id": instagram_account_id, "username": username}]
            else:
                # Parse username and ID from mock code e.g. mock_username_id
                parts = code.split("_")
                username = parts[1] if len(parts) > 1 else "instagram_mock_user"
                instagram_account_id = parts[2] if len(parts) > 2 else "instagram_mock_user_id"
                expires_at = datetime.now(timezone.utc) + timedelta(days=60)
                token_service.store_long_lived_token(
                    user_id=user_id,
                    long_token=code,
                    expires_at=expires_at,
                    account_id=instagram_account_id,
                    username=username
                )
                connected = [{"instagram_account_id": instagram_account_id, "username": username}]
        else:
            short = token_service.exchange_oauth_code_for_short_lived_user_token(code)
            print(f"  [OK] Got short-lived token")
            
            long_tok, expires_at = token_service.exchange_short_lived_token(short)
            print(f"  [OK] Got long-lived token, expires: {expires_at}")

            result = token_service.connect_all_accounts_for_user(user_id, long_tok, expires_at)
            connected = result.get("connected") or []
        names = ",".join(c.get("username", "") for c in connected)
        print(
            f"  [SUCCESS] Instagram connected for user {user_id}: "
            f"{len(connected)} new account(s) — {names}"
        )
        query = urlencode(
            {
                "platform": "instagram",
                "count": str(len(connected)),
                "names": names,
            }
        )
        return RedirectResponse(f"/static/success.html?{query}")
    except Exception as e:
        error_msg = str(e).encode('ascii', 'replace').decode('ascii')
        try:
            import traceback
            traceback.print_exc()
        except Exception:
            pass
        try:
            print(f"[ERROR] Meta / Instagram OAuth callback error: {error_msg}")
        except Exception:
            pass
        return RedirectResponse(f"/static/connection-error.html?platform=instagram&message={quote(str(e))}")



@app.get("/api/platforms/linkedin/accounts")
async def list_linkedin_acc(current_user: User = Depends(auth_service.get_current_user)):
    return linkedin_service.store.get_all_accounts(current_user.id)

@app.get("/api/platforms/linkedin/accounts/detailed")
async def list_linkedin_acc_detailed(current_user: User = Depends(auth_service.get_current_user)):
    accounts = linkedin_service.store.get_all_accounts(current_user.id)
    detailed = []
    for acc in accounts:
        account_info = {
            "member_urn": acc.member_urn,
            "name": acc.name,
            "picture": acc.picture,
            "status": acc.status,
            "post_count": None,
            "connection_count": None,
        }
        try:
            conn_count = linkedin_service.get_connection_count(acc.member_urn, acc.access_token)
            if conn_count is not None:
                account_info["connection_count"] = conn_count
        except Exception as e:
            account_info["connection_count_error"] = str(e)
        try:
            count = linkedin_service.get_member_post_count(acc.member_urn, acc.access_token)
            if count is None:
                account_info["post_count_error"] = "LinkedIn post count is unavailable for this account. Ensure the app has the required read permissions."
            else:
                account_info["post_count"] = count
        except Exception as e:
            account_info["post_count_error"] = str(e)
        detailed.append(account_info)
    return detailed


@app.delete("/api/platforms/linkedin/accounts/{member_urn}")
async def delete_linkedin_account(member_urn: str, current_user: User = Depends(auth_service.get_current_user)):
    """Delete a LinkedIn account for the current user."""
    try:
        # member_urn will be URL-encoded by the client; SQLite stores the plain URN
        deleted = linkedin_service.store.delete_account(member_urn, current_user.id)
        if not deleted:
            raise HTTPException(status_code=404, detail="LinkedIn account not found or already removed.")
        return {"success": True, "message": "LinkedIn account removed."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/platforms/linkedin/connect-env")
async def connect_linkedin_from_env(current_user: User = Depends(auth_service.get_current_user)):
    """Connect LinkedIn using LINKEDIN_ACCESS_TOKEN from .env (quick local setup)."""
    try:
        account = linkedin_service.connect_user_from_env(current_user.id)
        return {"success": True, "account": {"name": account.name, "member_urn": account.member_urn}}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"LinkedIn sync failed: {e}")


@app.get("/api/platforms/linkedin/connect")
async def linkedin_connect(current_user: User = Depends(auth_service.get_current_user), force: bool = False):
    if not settings.LINKEDIN_CLIENT_ID or not settings.LINKEDIN_CLIENT_SECRET:
        raise HTTPException(
            status_code=400,
            detail="LinkedIn app not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in your .env file.",
        )
    return RedirectResponse(linkedin_service.get_auth_url(current_user.id, force_login=force))

@app.get("/api/platforms/linkedin/callback")
async def linkedin_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
):
    if error:
        message = f"LinkedIn authorization failed: {error}. {error_description or ''}".strip()
        return RedirectResponse(f"/static/connection-error.html?platform=linkedin&message={quote(message)}")

    if not code or not state:
        message = "LinkedIn callback missing authorization code or state. Please try again."
        return RedirectResponse(f"/static/connection-error.html?platform=linkedin&message={quote(message)}")

    try:
        user_id = linkedin_service.get_user_id_from_state(state)
        access_token = linkedin_service.exchange_code_for_token(code)
        profile = linkedin_service.get_member_profile(access_token)
        account = LinkedInAccount(
            user_id=user_id,
            member_urn=profile["member_urn"],
            access_token=access_token,
            name=profile.get("name", "LinkedIn Member"),
        )
        linkedin_service.store.add_account(account)
        return FileResponse("static/success.html")
    except Exception as e:
        print(f"[ERROR] LinkedIn Callback Error: {e}")
        message = f"LinkedIn Sync Failed: {str(e)}"
        return RedirectResponse(f"/static/connection-error.html?platform=linkedin&message={quote(message)}")

# ---------------------------------------------------------------------------
# Threads API Endpoints (Account Sync & Publishing)
# ---------------------------------------------------------------------------

@app.get("/api/platforms/threads/accounts")
async def list_threads_accounts(current_user: User = Depends(auth_service.get_current_user)):
    return threads_service.get_all_accounts(current_user.id)

@app.get("/api/platforms/threads/accounts/detailed")
async def list_threads_accounts_detailed(current_user: User = Depends(auth_service.get_current_user)):
    accounts = threads_service.get_all_accounts(current_user.id)
    detailed = []
    for acc in accounts:
        live_info = {}
        try:
            live_info = threads_service.get_account_info(acc["threads_account_id"], acc["access_token"])
        except Exception as e:
            print(f"[THREADS] Could not fetch live info for {acc['username']}: {e}")
        
        detailed.append({
            "threads_account_id": acc["threads_account_id"],
            "username": acc["username"],
            "name": live_info.get("name") or f"@{acc['username']}",
            "status": acc["status"],
            "profile_picture_url": live_info.get("profile_picture_url"),
            "is_verified": live_info.get("is_verified", False),
            "followers_count": live_info.get("followers_count"),
            "threads_count": live_info.get("threads_count"),
            "biography": live_info.get("biography") or "Meta Threads account connected to Post Pilot.ai"
        })
    return detailed

@app.get("/api/platforms/threads/connect")
async def threads_connect(request: Request, current_user: User = Depends(auth_service.get_current_user)):
    """Redirect to Threads login so the user can authorize Threads."""
    try:
        # If running locally on HTTP, redirect to local mock OAuth login to bypass HTTPS SSL requirement
        is_local_http = request.url.scheme == "http" and ("localhost" in request.url.netloc or "127.0.0.1" in request.url.netloc)
        if is_local_http:
            from urllib.parse import urlencode
            from app.services.instagram_token_service import InstagramTokenService
            token_svc = InstagramTokenService()
            state = token_svc._make_oauth_state(current_user.id)
            return RedirectResponse(f"/static/threads-mock-oauth.html?state={state}")

        return RedirectResponse(threads_service.get_threads_login_url(current_user.id))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/platforms/threads/callback")
async def threads_oauth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
):
    if error:
        msg = error_description or error
        print(f"[WARN] Threads OAuth returned error: {msg}")
        return RedirectResponse(f"/static/connection-error.html?platform=threads&message={quote(msg)}")
    if not code or not state:
        return RedirectResponse(
            "/static/connection-error.html?platform=threads&message=Missing%20authorization%20code%20or%20state"
        )
    try:
        print("[INFO] Processing Threads OAuth callback...")
        from app.services.instagram_token_service import InstagramTokenService
        token_svc = InstagramTokenService()
        user_id = token_svc.get_user_id_from_oauth_state(state)
        print(f"  [OK] User ID from state: {user_id}")
        
        if code.startswith("mock_") or "mock" in code.lower():
            env_token = (settings.THREADS_ACCESS_TOKEN or "").strip()
            if env_token and not (env_token.startswith("mock_") or "mock" in env_token.lower()):
                print("[THREADS MOCK CALLBACK] Real THREADS_ACCESS_TOKEN found in .env. Attempting real connection...")
                try:
                    resolved = threads_service.resolve_account_info(env_token)
                    threads_account_id = resolved["threads_account_id"]
                    username = resolved["username"]
                    access_token = env_token
                    print(f"  [SUCCESS] Successfully resolved real Threads account: @{username} (ID: {threads_account_id})")
                except Exception as e:
                    print(f"  [ERROR] Failed to resolve real Threads account using environment token: {e}")
                    # Fallback to mock behavior
                    parts = code.split("_")
                    username = parts[1] if len(parts) > 1 else "threads_mock_user"
                    threads_account_id = parts[2] if len(parts) > 2 else "threads_mock_user_id"
                    access_token = code
            else:
                parts = code.split("_")
                username = parts[1] if len(parts) > 1 else "threads_mock_user"
                threads_account_id = parts[2] if len(parts) > 2 else "threads_mock_user_id"
                access_token = code
        else:
            import requests
            # Exchange code for access token using standard Threads OAuth mechanism
            payload = {
                "client_id": settings.THREADS_APP_ID,
                "client_secret": settings.THREADS_APP_SECRET,
                "grant_type": "authorization_code",
                "redirect_uri": settings.THREADS_REDIRECT_URI,
                "code": code
            }
            resp = requests.post("https://graph.threads.net/oauth/access_token", data=payload, timeout=20)
            res_data = resp.json()
            if "error" in res_data:
                raise Exception(res_data["error"].get("message", "Token exchange failed"))
            access_token = res_data["access_token"]
            threads_account_id = res_data["user_id"]
            
            # Resolve profile info using the obtained token
            resolved = threads_service.resolve_account_info(access_token)
            username = resolved["username"]
            threads_account_id = resolved["threads_account_id"]

            # Exchange short-lived token (1 hour) for long-lived token (60 days)
            access_token = threads_service.exchange_for_long_lived_token(access_token)
            
        acc = threads_service.add_account(user_id, threads_account_id, username, access_token)
        print(f"  [SUCCESS] Threads connected for user {user_id}: @{username}")
        
        query = urlencode(
            {
                "platform": "threads",
                "count": "1",
                "names": f"@{username}",
            }
        )
        return RedirectResponse(f"/static/success.html?{query}")
    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] Threads OAuth callback error: {error_msg}")
        return RedirectResponse(f"/static/connection-error.html?platform=threads&message={quote(str(e))}")

@app.post("/api/platforms/threads/connect-direct")
async def connect_threads_direct(
    access_token: str = Form(...),
    threads_account_id: str = Form(...),
    username: str = Form(...),
    current_user: User = Depends(auth_service.get_current_user)
):
    try:
        token_clean = access_token.strip()
        # Auto-resolve correct ID and username if possible using the token!
        try:
            resolved = threads_service.resolve_account_info(token_clean)
            threads_account_id = resolved["threads_account_id"]
            username = resolved["username"]
            print(f"[THREADS AUTO-RESOLVE] Successfully resolved account to @{username} (ID: {threads_account_id})")
        except Exception as e:
            print(f"[THREADS AUTO-RESOLVE FAIL] Could not auto-resolve account info from token: {e}")
            # Fall back to user's manual inputs

        # Exchange for long-lived token (60 days)
        token_clean = threads_service.exchange_for_long_lived_token(token_clean)

        acc = threads_service.add_account(current_user.id, threads_account_id.strip(), username.strip(), token_clean)
        return {"success": True, "account": acc}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Threads connection failed: {e}")

@app.post("/api/platforms/threads/connect-env")
async def connect_threads_env(current_user: User = Depends(auth_service.get_current_user)):
    try:
        token = settings.THREADS_ACCESS_TOKEN
        if not token:
            raise HTTPException(status_code=400, detail="THREADS_ACCESS_TOKEN not set in environment.")
        
        threads_account_id = "threads_env_account_id"
        username = "threads_env_user"
        
        # Try to resolve the real username and user ID from the token
        try:
            resolved = threads_service.resolve_account_info(token)
            threads_account_id = resolved.get("threads_account_id") or threads_account_id
            username = resolved.get("username") or username
            print(f"[THREADS ENV CONNECT] Successfully resolved account to @{username} (ID: {threads_account_id})")
        except Exception as e:
            print(f"[THREADS ENV CONNECT FAIL] Could not auto-resolve account info from token: {e}")
            
        acc = threads_service.add_account(current_user.id, threads_account_id.strip(), username.strip(), token)
        return {"success": True, "account": acc}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/platforms/threads/accounts/{threads_account_id}")
async def delete_threads_account(threads_account_id: str, current_user: User = Depends(auth_service.get_current_user)):
    deleted = threads_service.delete_account(threads_account_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Threads account not found or already removed.")
    return {"success": True, "message": "Threads account disconnected."}

@app.post("/api/platforms/threads/post")
async def post_threads(
    threads_account_id: str = Form(...),
    text: str = Form(None),
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    current_user: User = Depends(auth_service.get_current_user)
):
    try:
        acc = threads_service.get_account(threads_account_id, current_user.id)
        if not acc:
            raise HTTPException(status_code=404, detail="Threads account not found.")
        
        upload_files = []
        if files:
            upload_files.extend(files)
        elif file:
            upload_files.extend([file])
            
        hosted_urls = []
        if upload_files:
            file_paths = []
            for uf in upload_files:
                p = await image_service.save_upload(uf)
                file_paths.append(p)
                
            # Upload to cloud to get public URLs
            for fp in file_paths:
                hosted_urls.append(image_service.upload_to_cloud(fp))
                image_service.cleanup_file(fp)

        if len(hosted_urls) > 1:
            post_id = threads_service.post_carousel(threads_account_id, text or "", hosted_urls, acc["access_token"])
        elif len(hosted_urls) == 1:
            post_id = threads_service.post_image(threads_account_id, text or "", hosted_urls[0], acc["access_token"])
        else:
            post_id = threads_service.post_text(threads_account_id, text or "", acc["access_token"])

        post_url = threads_service.get_permalink(post_id, acc["access_token"])
        scheduler_svc.record_direct_post(
            current_user.id,
            "threads",
            "published",
            post_id=post_url,
            image_url=",".join(hosted_urls) if hosted_urls else None,
            caption=text or ""
        )
        return {"success": True, "post_id": post_url, "post_url": post_url, "message": "Elite content published to Threads!"}
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/platforms/threads/schedule-post")
async def schedule_threads(
    scheduled_at: str = Form(...),
    threads_account_id: str = Form(...),
    text: str = Form(None),
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    current_user: User = Depends(auth_service.get_current_user)
):
    run_at = _parse_scheduled_at(scheduled_at)
    acc = threads_service.get_account(threads_account_id, current_user.id)
    if not acc:
        raise HTTPException(status_code=404, detail="Threads account not found.")
    
    upload_files = []
    if files:
        upload_files.extend(files)
    elif file:
        upload_files.extend([file])
        
    hosted_urls = []
    if upload_files:
        file_paths = []
        for uf in upload_files:
            p = await image_service.save_upload(uf)
            file_paths.append(p)
            
        # Upload to cloud to get public URLs
        for fp in file_paths:
            hosted_urls.append(image_service.upload_to_cloud(fp))
            image_service.cleanup_file(fp)

    if len(hosted_urls) > 1:
        job_id = scheduler_svc.schedule_threads_post(app.state.scheduler, run_at, current_user.id, threads_account_id, text or "", image_urls=hosted_urls)
    else:
        job_id = scheduler_svc.schedule_threads_post(app.state.scheduler, run_at, current_user.id, threads_account_id, text or "", image_url=hosted_urls[0] if hosted_urls else None)
        
    return {"success": True, "job_id": job_id}


# ---------------------------------------------------------------------------
# Direct Posting Endpoints
# ---------------------------------------------------------------------------

@app.post("/upload-post")
async def post_insta_direct(
    file: UploadFile = File(None),
    text: str = Form(None),
    instagram_account_id: Optional[str] = Form(None),
    username: Optional[str] = Form(None),
    current_user: User = Depends(auth_service.get_current_user)
):
    """Direct Instagram Publication"""
    try:
        if instagram_account_id:
            record = token_service.get_record_by_account_id(instagram_account_id, username)
            if not record or record.get('user_id') != current_user.id:
                raise HTTPException(status_code=400, detail="Instagram account not found or access denied.")
            page_token = token_service.get_access_token_for_account(instagram_account_id, username)
            ig_id = instagram_account_id
        else:
            record = token_service.get_record(current_user.id)
            if not record: raise InstagramReauthRequired("No Instagram connection.")
            page_token = token_service.get_access_token_for_user(current_user.id)
            ig_id = record.get('instagram_account_id')
        
        file_path = await image_service.save_upload(file)
        hosted_url = image_service.upload_to_cloud(file_path)
        
        container_id = instagram_service.create_media_container(hosted_url, text or "", page_token, ig_id)
        time.sleep(3) # Wait for processing
        post_id = instagram_service.publish_media_container(container_id, page_token, ig_id)
        post_url = instagram_service.get_permalink(post_id, page_token)
        
        image_service.cleanup_file(file_path)
        scheduler_svc.record_direct_post(
            current_user.id,
            "instagram",
            "published",
            post_id=post_url,
            image_url=hosted_url,
            caption=text or ""
        )
        return {"success": True, "post_id": post_url, "post_url": post_url, "message": "Elite content published to Instagram!"}
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/platforms/instagram/post-carousel")
async def post_insta_carousel(
    files: List[UploadFile] = File(...),
    text: str = Form(None),
    instagram_account_id: Optional[str] = Form(None),
    username: Optional[str] = Form(None),
    current_user: User = Depends(auth_service.get_current_user)
):
    """Direct Instagram Carousel Publication"""
    try:
        if instagram_account_id:
            record = token_service.get_record_by_account_id(instagram_account_id, username)
            if not record or record.get('user_id') != current_user.id:
                raise HTTPException(status_code=400, detail="Instagram account not found or access denied.")
            page_token = token_service.get_access_token_for_account(instagram_account_id, username)
            ig_id = instagram_account_id
        else:
            record = token_service.get_record(current_user.id)
            if not record: raise InstagramReauthRequired("No Instagram connection.")
            page_token = token_service.get_access_token_for_user(current_user.id)
            ig_id = record.get('instagram_account_id')
        
        hosted_urls = await image_service.process_and_host_images(uploads=files)
        
        creation_id = instagram_service.create_carousel_media(hosted_urls, text or "", page_token, ig_id)
        time.sleep(5) # Wait for processing
        post_id = instagram_service.publish_media_container(creation_id, page_token, ig_id)
        post_url = instagram_service.get_permalink(post_id, page_token)
        
        scheduler_svc.record_direct_post(
            current_user.id,
            "instagram",
            "published",
            post_id=post_url,
            image_url=",".join(hosted_urls) if hosted_urls else None,
            caption=text or ""
        )
        return {"success": True, "post_id": post_url, "post_url": post_url, "message": "Elite carousel published to Instagram!"}
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/platforms/linkedin/post")
async def post_li_direct(
    member_urn: str = Form(...),
    text: str = Form(None),
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    current_user: User = Depends(auth_service.get_current_user)
):
    try:
        account = linkedin_service.store.get_account(member_urn, current_user.id)
        if not account: raise HTTPException(status_code=404, detail="LinkedIn account not found.")
        
        upload_files = []
        if files:
            upload_files.extend(files)
        elif file:
            upload_files.extend([file])
            
        hosted_urls = []
        if upload_files:
            file_paths = []
            for uf in upload_files:
                p = await image_service.save_upload(uf)
                file_paths.append(str(p))
                
            for fp in file_paths:
                try:
                    h_url = image_service.upload_to_cloud(Path(fp))
                    if h_url:
                        hosted_urls.append(h_url)
                except Exception as ex:
                    print(f"[WARN] Failed to upload LinkedIn image to cloud for history: {ex}")
                
            if len(file_paths) > 1:
                post_id = linkedin_service.post_images(member_urn, text or "", file_paths, account.access_token)
            else:
                post_id = linkedin_service.post_image(member_urn, text or "", file_paths[0], account.access_token)
                
            for fp in file_paths:
                image_service.cleanup_file(Path(fp))
        else:
            post_id = linkedin_service.post_text(member_urn, text or "", account.access_token)
            
        post_url = post_id
        if post_id and post_id.startswith("urn:li:"):
            post_url = f"https://www.linkedin.com/feed/update/{post_id}/"
        elif not post_id or not post_id.startswith("http"):
            post_url = "https://www.linkedin.com/"

        scheduler_svc.record_direct_post(
            current_user.id,
            "linkedin",
            "published",
            post_id=post_url,
            image_url=",".join(hosted_urls) if hosted_urls else None,
            caption=text or ""
        )
        return {"success": True, "post_id": post_url, "post_url": post_url, "message": "Elite content published to LinkedIn!"}
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Scheduling Engine (Unified)
# ---------------------------------------------------------------------------

def _parse_scheduled_at(scheduled_at: str) -> datetime:
    try:
        dt = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
    except:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO-8601.")
    
    if dt.tzinfo is None:
        from datetime import timedelta
        dt = dt.replace(tzinfo=timezone(timedelta(0))) # Default to UTC if not specified
    
    dt_utc = dt.astimezone(timezone.utc)
    if dt_utc <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Mission must be scheduled for the future.")
    return dt_utc

@app.post("/api/platforms/instagram/schedule-post")
async def schedule_insta(
    scheduled_at: str = Form(...),
    file: UploadFile = File(None),
    text: str = Form(None),
    instagram_account_id: Optional[str] = Form(None),
    username: Optional[str] = Form(None),
    current_user: User = Depends(auth_service.get_current_user)
):
    run_at = _parse_scheduled_at(scheduled_at)
    file_path = await image_service.save_upload(file)
    hosted_url = image_service.upload_to_cloud(file_path)
    image_service.cleanup_file(file_path)
    
    job_id = scheduler_svc.schedule_instagram_post(app.state.scheduler, run_at, current_user.id, hosted_url, text or "", instagram_account_id, username)
    return {"success": True, "job_id": job_id}


@app.post("/api/platforms/instagram/schedule-carousel")
async def schedule_insta_carousel(
    scheduled_at: str = Form(...),
    files: List[UploadFile] = File(...),
    text: str = Form(None),
    instagram_account_id: Optional[str] = Form(None),
    username: Optional[str] = Form(None),
    current_user: User = Depends(auth_service.get_current_user)
):
    run_at = _parse_scheduled_at(scheduled_at)
    hosted_urls = await image_service.process_and_host_images(uploads=files)
    
    job_id = scheduler_svc.schedule_instagram_carousel(app.state.scheduler, run_at, current_user.id, hosted_urls, text or "", instagram_account_id, username)
    return {"success": True, "job_id": job_id}

@app.post("/api/platforms/linkedin/schedule-post")
async def schedule_li(
    scheduled_at: str = Form(...),
    member_urn: str = Form(...),
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    text: str = Form(None),
    current_user: User = Depends(auth_service.get_current_user)
):
    run_at = _parse_scheduled_at(scheduled_at)
    account = linkedin_service.store.get_account(member_urn, current_user.id)
    if not account: raise HTTPException(status_code=404, detail="LinkedIn account not found.")
    
    upload_files = []
    if files:
        upload_files.extend(files)
    elif file:
        upload_files.extend([file])
        
    saved_paths = []
    if upload_files:
        for uf in upload_files:
            temp_path = await image_service.save_upload(uf)
            saved_paths.append(str(temp_path))
            
    if len(saved_paths) > 1:
        job_id = scheduler_svc.schedule_linkedin_post(app.state.scheduler, run_at, current_user.id, member_urn, account.access_token, text or "", file_paths=saved_paths)
    elif len(saved_paths) == 1:
        job_id = scheduler_svc.schedule_linkedin_post(app.state.scheduler, run_at, current_user.id, member_urn, account.access_token, text or "", file_path=saved_paths[0])
    else:
        job_id = scheduler_svc.schedule_linkedin_post(app.state.scheduler, run_at, current_user.id, member_urn, account.access_token, text or "")
        
    return {"success": True, "job_id": job_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8091, reload=True)
