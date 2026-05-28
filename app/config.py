"""
Configuration settings
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# App folder (SocialMediaAutomation/) and repo parent (Social_media2/) — friend may use either
_PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _normalize_scope_string(scope_value: str) -> str:
    if not scope_value:
        return ""
    scope_value = scope_value.strip()
    if (scope_value.startswith('"') and scope_value.endswith('"')) or (
        scope_value.startswith("'") and scope_value.endswith("'")
    ):
        scope_value = scope_value[1:-1].strip()
    return " ".join(scope_value.replace(",", " ").split())
_REPO_ROOT = _PROJECT_ROOT.parent


def _load_env_files() -> None:
    parent_env = _REPO_ROOT / ".env"
    app_env = _PROJECT_ROOT / ".env"
    if parent_env.exists():
        load_dotenv(parent_env)
    if app_env.exists():
        load_dotenv(app_env, override=True)
    elif not parent_env.exists():
        load_dotenv(app_env)


_load_env_files()


def _normalize_public_base_url(url: str) -> str:
    return url.strip().rstrip("/")


APP_PUBLIC_URL = _normalize_public_base_url(os.getenv("APP_PUBLIC_URL", ""))


def oauth_callback_url(path: str, explicit_env_key: str, localhost_default: str) -> str:
    """
    Build OAuth redirect URIs for hosted deployments.

    Set APP_PUBLIC_URL=https://social.dmprojects.in (no trailing slash) on the server.
    When set, callback URLs are derived from it so localhost values in .env are not used.
    """
    if not path.startswith("/"):
        path = "/" + path
    if APP_PUBLIC_URL:
        return f"{APP_PUBLIC_URL}{path}"
    explicit = os.getenv(explicit_env_key, "").strip()
    if explicit:
        return explicit
    return localhost_default


def get_env_file_path() -> Path:
    """Primary .env file for read/write (app folder preferred, then repo parent)."""
    app_env = _PROJECT_ROOT / ".env"
    if app_env.exists():
        return app_env
    parent_env = _REPO_ROOT / ".env"
    if parent_env.exists():
        return parent_env
    return app_env


def update_env_token(key: str, value: str) -> bool:
    """
    Update or add a key=value line in the project's .env file.
    Returns True if the file was updated successfully.
    """
    env_path = get_env_file_path()
    try:
        lines = []
        if env_path.exists():
            lines = env_path.read_text(encoding="utf-8", errors="replace").splitlines()
        key_prefix = f"{key}="
        new_line = f'{key}="{value}"' if (" " in value or "#" in value or "\n" in value) else f"{key}={value}"
        found = False
        for i, line in enumerate(lines):
            if line.strip().startswith(key_prefix) or (line.strip() and line.split("=", 1)[0].strip() == key):
                lines[i] = new_line
                found = True
                break
        if not found:
            lines.append(new_line)
        env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return True
    except Exception:
        return False


class Settings:
    """Application settings"""
    
    # Instagram API
    INSTAGRAM_ACCOUNT_ID = os.getenv("INSTAGRAM_ACCOUNT_ID", "")
    PAGE_ACCESS_TOKEN = os.getenv("PAGE_ACCESS_TOKEN", "")
    GRAPH_API_VERSION = os.getenv("GRAPH_API_VERSION", "v24.0")
    GRAPH_API_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"
    
    # Facebook App Credentials (for token refresh)
    FB_APP_ID = os.getenv("FB_APP_ID", "")
    FB_APP_SECRET = os.getenv("FB_APP_SECRET", "")
    FB_REDIRECT_URI = oauth_callback_url(
        "/api/platforms/facebook/callback",
        "FB_REDIRECT_URI",
        "http://localhost:8000/api/platforms/facebook/callback",
    )
    
    # Image Hosting
    
    # Image Hosting
    IMGBB_API_KEY = os.getenv("IMGBB_API_KEY", "")
    IMGUR_CLIENT_ID = os.getenv("IMGUR_CLIENT_ID", "")
    
    # OpenAI AI Content Generation
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

    # Catbox.moe (Public image hosting)
    CATBOX_USER_HASH = os.getenv("CATBOX_USER_HASH", "")
    
    # File Upload
    UPLOAD_DIR = Path("./uploads")
    MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
    MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024
    ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
    
    # LinkedIn API (for future posting)
    LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID", "")
    LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET", "")
    LINKEDIN_ACCESS_TOKEN = os.getenv("LINKEDIN_ACCESS_TOKEN", "")
    LINKEDIN_REDIRECT_URI = oauth_callback_url(
        "/api/platforms/linkedin/callback",
        "LINKEDIN_REDIRECT_URI",
        "http://localhost:8000/api/platforms/linkedin/callback",
    )
    LINKEDIN_SCOPES = _normalize_scope_string(os.getenv("LINKEDIN_SCOPES", "w_member_social,openid,profile,email"))

    # Google Sign-In (GIS) — https://console.cloud.google.com/apis/credentials
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()

    # Firebase Auth (web) — project ID + API key from Firebase console
    FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "smauto-10c96").strip()
    FIREBASE_WEB_API_KEY = os.getenv(
        "FIREBASE_WEB_API_KEY",
        "AIzaSyCuEgLqq1k8xBGHCKasFaYwPbcd44O7FGo",
    ).strip()
    
    # X (Twitter) API
    X_CLIENT_ID = os.getenv("X_CLIENT_ID", "")
    X_CLIENT_SECRET = os.getenv("X_CLIENT_SECRET", "")
    X_REDIRECT_URI = oauth_callback_url(
        "/api/platforms/x/callback",
        "X_REDIRECT_URI",
        "http://localhost:8000/api/platforms/x/callback",
    )
    X_SCOPES = os.getenv("X_SCOPES", "tweet.read tweet.write users.read offline.access")
    
    # Threads API
    THREADS_APP_ID = os.getenv("THREADS_APP_ID", "")
    THREADS_APP_SECRET = os.getenv("THREADS_APP_SECRET", "")
    THREADS_REDIRECT_URI = oauth_callback_url(
        "/api/platforms/threads/callback",
        "THREADS_REDIRECT_URI",
        "http://localhost:8000/api/platforms/threads/callback",
    )
    THREADS_ACCESS_TOKEN = os.getenv("THREADS_ACCESS_TOKEN", "")
    
    # Server
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8000"))
    
    def __init__(self):
        # Create upload directory
        self.UPLOAD_DIR.mkdir(exist_ok=True)
    
    def get_config_status(self) -> dict:
        """Check configuration status"""
        return {
            "access_token_configured": bool(self.PAGE_ACCESS_TOKEN),
            "instagram_account_configured": bool(self.INSTAGRAM_ACCOUNT_ID),
            "fb_app_credentials_configured": bool(self.FB_APP_ID and self.FB_APP_SECRET),
            "openai_configured": bool(self.OPENAI_API_KEY),
            "catbox_configured": True,  # Standard use doesn't require hash
            "hosting_available": bool(self.IMGBB_API_KEY or self.IMGUR_CLIENT_ID or True),
            "fb_oauth_configured": bool(self.FB_APP_ID and self.FB_APP_SECRET and self.FB_REDIRECT_URI),
            "app_public_url": APP_PUBLIC_URL or None,
            "linkedin_redirect_uri": self.LINKEDIN_REDIRECT_URI,
            "facebook_redirect_uri": self.FB_REDIRECT_URI,
            "linkedin_configured": bool(self.LINKEDIN_CLIENT_ID and self.LINKEDIN_CLIENT_SECRET and self.LINKEDIN_REDIRECT_URI),
            "linkedin_token_configured": bool(self.LINKEDIN_ACCESS_TOKEN or os.getenv("LINKEDIN_ACCESS_TOKEN")),
            "x_configured": bool(self.X_CLIENT_ID and self.X_CLIENT_SECRET and self.X_REDIRECT_URI),
            "threads_configured": bool(self.THREADS_APP_ID and self.THREADS_APP_SECRET and self.THREADS_REDIRECT_URI),
        }


settings = Settings()