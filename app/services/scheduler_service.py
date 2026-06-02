



"""
Scheduler Service — wraps APScheduler to manage scheduled social media posts.

Jobs are stored in an in-memory dict keyed by job_id so they can be
listed and cancelled. The scheduler instance is injected from main.py
(app.state.scheduler) so it shares the same BackgroundScheduler that
powers the token-refresh job.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional, TYPE_CHECKING
from pathlib import Path

if TYPE_CHECKING:
    from apscheduler.schedulers.background import BackgroundScheduler


from app.database import db

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def _store_meta(job_id: str, platform: str, scheduled_at: datetime, user_id: int, image_url: str = None, caption: str = None):
    with db.get_connection() as conn:
        conn.execute("""
            INSERT INTO scheduled_posts (job_id, user_id, platform, scheduled_at, status, image_url, caption, is_scheduled)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        """, (job_id, user_id, platform, scheduled_at.isoformat(), "pending", image_url, caption))
        conn.commit()

def _update_status(job_id: str, status: str, post_id: str = None, error: str = None):
    with db.get_connection() as conn:
        if post_id:
            conn.execute("UPDATE scheduled_posts SET status = ?, post_id = ? WHERE job_id = ?", (status, post_id, job_id))
        elif error:
            conn.execute("UPDATE scheduled_posts SET status = ?, error = ? WHERE job_id = ?", (status, error, job_id))
        else:
            conn.execute("UPDATE scheduled_posts SET status = ? WHERE job_id = ?", (status, job_id))
        conn.commit()


# ---------------------------------------------------------------------------
# Job functions (called by APScheduler at run-time)
# ---------------------------------------------------------------------------

def _run_instagram_post(
    job_id: str,
    user_id: int,
    hosted_image_url: str,
    caption: str,
    instagram_account_id: Optional[str] = None,
    username: Optional[str] = None,
):
    """Execute a scheduled Instagram single-image post."""
    from app.services import InstagramService
    _update_status(job_id, "running")
    try:
        from app.services.instagram_token_service import InstagramTokenService
        token_svc = InstagramTokenService()

        if instagram_account_id:
            access_token = token_svc.get_access_token_for_account(instagram_account_id, username)
            ig_id = instagram_account_id
        else:
            record = token_svc.get_record(user_id)
            ig_id = record.get('instagram_account_id') if record else None
            access_token = token_svc.get_access_token_for_user(user_id)

        svc = InstagramService()
        creation_id = svc.create_media_container(hosted_image_url, caption, access_token, ig_id)
        import time; time.sleep(2)
        post_id = svc.publish_media_container(creation_id, access_token, ig_id)
        _update_status(job_id, "published", post_id=post_id)
        print(f"✅ Scheduled Instagram post published — post_id={post_id}  job_id={job_id}")
    except Exception as e:
        _update_status(job_id, "failed", error=str(e))
        print(f"❌ Scheduled Instagram post failed — job_id={job_id}  error={e}")


def _run_instagram_carousel(
    job_id: str,
    user_id: int,
    hosted_image_urls: list[str],
    caption: str,
    instagram_account_id: Optional[str] = None,
    username: Optional[str] = None,
):
    """Execute a scheduled Instagram carousel post."""
    from app.services import InstagramService
    _update_status(job_id, "running")
    try:
        from app.services.instagram_token_service import InstagramTokenService
        token_svc = InstagramTokenService()

        if instagram_account_id:
            access_token = token_svc.get_access_token_for_account(instagram_account_id, username)
            ig_id = instagram_account_id
        else:
            record = token_svc.get_record(user_id)
            ig_id = record.get('instagram_account_id') if record else None
            access_token = token_svc.get_access_token_for_user(user_id)

        svc = InstagramService()
        creation_id = svc.create_carousel_media(hosted_image_urls, caption, access_token, ig_id)
        import time; time.sleep(2)
        post_id = svc.publish_media_container(creation_id, access_token, ig_id)
        _update_status(job_id, "published", post_id=post_id)
        print(f"✅ Scheduled Instagram carousel published — post_id={post_id}  job_id={job_id}")
    except Exception as e:
        _update_status(job_id, "failed", error=str(e))
        print(f"❌ Scheduled Instagram carousel failed — job_id={job_id}  error={e}")


def _run_linkedin_post(
    job_id: str,
    member_urn: str,
    access_token: str,
    text: str,
    file_path: Optional[str] = None,
    file_paths: Optional[list[str]] = None,
):
    """Execute a scheduled LinkedIn post."""
    from app.services.linkedin_service import LinkedInService
    _update_status(job_id, "running")
    try:
        svc = LinkedInService()
        if file_paths and len(file_paths) > 1:
            post_id = svc.post_images(member_urn, text, file_paths, access_token)
        elif file_paths and len(file_paths) == 1:
            post_id = svc.post_image(member_urn, text, file_paths[0], access_token)
        elif file_path:
            post_id = svc.post_image(member_urn, text, file_path, access_token)
        else:
            post_id = svc.post_text(member_urn, text, access_token)
        _update_status(job_id, "published", post_id=post_id)
        print(f"✅ Scheduled LinkedIn post published — post_id={post_id}  job_id={job_id}")
    except Exception as e:
        _update_status(job_id, "failed", error=str(e))
        print(f"❌ Scheduled LinkedIn post failed — job_id={job_id}  error={e}")



def _run_threads_post(
    job_id: str,
    user_id: int,
    threads_account_id: str,
    caption: str,
    image_url: Optional[str] = None,
    image_urls: Optional[list[str]] = None,
):
    """Execute a scheduled Threads post."""
    from app.services.threads_service import threads_service
    _update_status(job_id, "running")
    try:
        acc = threads_service.get_account(threads_account_id, user_id)
        if not acc:
            raise Exception("Threads account not found or access denied.")
        
        access_token = acc["access_token"]
        if image_urls and len(image_urls) > 1:
            post_id = threads_service.post_carousel(threads_account_id, caption, image_urls, access_token)
        elif image_urls and len(image_urls) == 1:
            post_id = threads_service.post_image(threads_account_id, caption, image_urls[0], access_token)
        elif image_url:
            post_id = threads_service.post_image(threads_account_id, caption, image_url, access_token)
        else:
            post_id = threads_service.post_text(threads_account_id, caption, access_token)
            
        _update_status(job_id, "published", post_id=post_id)
        print(f"✅ Scheduled Threads post published — post_id={post_id}  job_id={job_id}")
    except Exception as e:
        _update_status(job_id, "failed", error=str(e))
        print(f"❌ Scheduled Threads post failed — job_id={job_id}  error={e}")



# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def schedule_instagram_post(
    scheduler: "BackgroundScheduler",
    scheduled_at: datetime,
    user_id: int,
    hosted_image_url: str,
    caption: str,
    instagram_account_id: Optional[str] = None,
    username: Optional[str] = None,
) -> str:
    job_id = str(uuid.uuid4())
    _store_meta(job_id, "instagram", scheduled_at, user_id, image_url=hosted_image_url, caption=caption)
    scheduler.add_job(
        _run_instagram_post,
        trigger="date",
        run_date=scheduled_at,
        kwargs={
            "job_id": job_id,
            "user_id": user_id,
            "hosted_image_url": hosted_image_url,
            "caption": caption,
            "instagram_account_id": instagram_account_id,
            "username": username,
        },
        id=job_id,
        replace_existing=False,
        misfire_grace_time=300,
    )
    return job_id


def schedule_instagram_carousel(
    scheduler: "BackgroundScheduler",
    scheduled_at: datetime,
    user_id: int,
    hosted_image_urls: list[str],
    caption: str,
    instagram_account_id: Optional[str] = None,
    username: Optional[str] = None,
) -> str:
    job_id = str(uuid.uuid4())
    _store_meta(job_id, "instagram_carousel", scheduled_at, user_id, image_url=hosted_image_urls[0] if hosted_image_urls else None, caption=caption)
    scheduler.add_job(
        _run_instagram_carousel,
        trigger="date",
        run_date=scheduled_at,
        kwargs={
            "job_id": job_id,
            "user_id": user_id,
            "hosted_image_urls": hosted_image_urls,
            "caption": caption,
            "instagram_account_id": instagram_account_id,
            "username": username,
        },
        id=job_id,
        replace_existing=False,
        misfire_grace_time=300,
    )
    return job_id


def schedule_linkedin_post(
    scheduler: "BackgroundScheduler",
    scheduled_at: datetime,
    user_id: int,
    member_urn: str,
    access_token: str,
    text: str,
    file_path: Optional[str] = None,
    file_paths: Optional[list[str]] = None,
) -> str:
    job_id = str(uuid.uuid4())
    image_url = None
    if file_path:
        image_url = f"/uploads/{Path(file_path).name}"
    elif file_paths:
        image_url = f"/uploads/{Path(file_paths[0]).name}"
        
    _store_meta(job_id, "linkedin", scheduled_at, user_id, caption=text, image_url=image_url)
    scheduler.add_job(
        _run_linkedin_post,
        trigger="date",
        run_date=scheduled_at,
        kwargs={
            "job_id": job_id,
            "member_urn": member_urn,
            "access_token": access_token,
            "text": text,
            "file_path": file_path,
            "file_paths": file_paths,
        },
        id=job_id,
        replace_existing=False,
        misfire_grace_time=300,
    )
    return job_id


def schedule_threads_post(
    scheduler: "BackgroundScheduler",
    scheduled_at: datetime,
    user_id: int,
    threads_account_id: str,
    caption: str,
    image_url: Optional[str] = None,
    image_urls: Optional[list[str]] = None,
) -> str:
    job_id = str(uuid.uuid4())
    preview_url = image_url
    if not preview_url and image_urls:
        preview_url = image_urls[0]
        
    _store_meta(job_id, "threads", scheduled_at, user_id, image_url=preview_url, caption=caption)
    scheduler.add_job(
        _run_threads_post,
        trigger="date",
        run_date=scheduled_at,
        kwargs={
            "job_id": job_id,
            "user_id": user_id,
            "threads_account_id": threads_account_id,
            "caption": caption,
            "image_url": image_url,
            "image_urls": image_urls,
        },
        id=job_id,
        replace_existing=False,
        misfire_grace_time=300,
    )
    return job_id



def record_direct_post(
    user_id: int,
    platform: str,
    status: str,
    post_id: Optional[str] = None,
    image_url: Optional[str] = None,
    caption: Optional[str] = None,
    error: Optional[str] = None,
) -> str:
    """Record an immediate publish in scheduled_posts for profile/history visibility."""
    job_id = str(uuid.uuid4())
    with db.get_connection() as conn:
        conn.execute("""
            INSERT INTO scheduled_posts (job_id, user_id, platform, scheduled_at, status, post_id, image_url, caption, error, is_scheduled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        """, (
            job_id,
            user_id,
            platform,
            datetime.now(timezone.utc).isoformat(),
            status,
            post_id,
            image_url,
            caption,
            error,
        ))
        conn.commit()
    return job_id


def list_jobs(user_id: int) -> List[dict]:
    """Return metadata for all tracked jobs for a specific user from database."""
    with db.get_connection() as conn:
        cursor = conn.execute("SELECT * FROM scheduled_posts WHERE user_id = ? ORDER BY scheduled_at DESC", (user_id,))
        return [dict(row) for row in cursor.fetchall()]


def get_stats(user_id: int) -> dict:
    """Return aggregated status counts for the user."""
    with db.get_connection() as conn:
        cursor = conn.execute("""
            SELECT 
                COUNT(*) FILTER (WHERE status = 'published') as published,
                COUNT(*) FILTER (WHERE status = 'pending') as scheduled,
                COUNT(*) FILTER (WHERE status = 'failed') as failed
            FROM scheduled_posts 
            WHERE user_id = ?
        """, (user_id,))
        row = cursor.fetchone()
        return {
            "published": row['published'] or 0,
            "scheduled": row['scheduled'] or 0,
            "failed": row['failed'] or 0
        }


def cancel_job(scheduler: "BackgroundScheduler", job_id: str, user_id: int) -> bool:
    """Remove a pending job if it belongs to the user. Returns True if found and removed."""
    with db.get_connection() as conn:
        cursor = conn.execute("SELECT user_id FROM scheduled_posts WHERE job_id = ?", (job_id,))
        row = cursor.fetchone()
        if row and row['user_id'] == user_id:
            try:
                scheduler.remove_job(job_id)
            except Exception:
                pass  # Already fired or doesn't exist in scheduler
            _update_status(job_id, "cancelled")
            return True
    return False
