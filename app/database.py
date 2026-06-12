import sqlite3
import threading
from pathlib import Path
from app.config import settings

PROJECT_ROOT = Path(__file__).resolve().parent.parent

class Database:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(Database, cls).__new__(cls)
                cls._instance._db_path = PROJECT_ROOT / "accounts.db"
                cls._instance._init_db()
        return cls._instance

    def _init_db(self):
        with sqlite3.connect(self._db_path) as conn:
            # Users table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    full_name TEXT NOT NULL,
                    hashed_password TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            self._migrate_users_auth_columns(conn)

            # OTP Verifications table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS otp_verifications (
                    email TEXT PRIMARY KEY,
                    code TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    verified INTEGER DEFAULT 0
                )
            """)

            # LinkedIn accounts table (updated with user_id)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS linkedin_accounts (
                    member_urn TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    status TEXT DEFAULT 'active',
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            """)

            # Instagram accounts table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS instagram_accounts (
                    instagram_account_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    username TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    last_refreshed_at DATETIME NOT NULL,
                    status TEXT DEFAULT 'active',
                    PRIMARY KEY (instagram_account_id, username),
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            """)
            
            # X accounts table (Moving from JSON to SQLite for consistency)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS x_accounts (
                    x_user_id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    username TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    refresh_token TEXT,
                    expires_at REAL NOT NULL,
                    status TEXT DEFAULT 'active',
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            """)

            # Scheduled posts table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS scheduled_posts (
                    job_id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    platform TEXT NOT NULL,
                    scheduled_at DATETIME NOT NULL,
                    status TEXT DEFAULT 'pending',
                    post_id TEXT,
                    error TEXT,
                    image_url TEXT,
                    caption TEXT,
                    is_scheduled INTEGER DEFAULT 1,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            """)

            # Threads accounts table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS threads_accounts (
                    threads_account_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    username TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    last_refreshed_at DATETIME NOT NULL,
                    status TEXT DEFAULT 'active',
                    PRIMARY KEY (threads_account_id, username),
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            """)

            # Migration for scheduled_posts to add is_scheduled if missing
            cursor = conn.execute("PRAGMA table_info(scheduled_posts)")
            cols = [col[1] for col in cursor.fetchall()]
            if cols and "is_scheduled" not in cols:
                print("Migrating scheduled_posts table: adding is_scheduled column")
                conn.execute("ALTER TABLE scheduled_posts ADD COLUMN is_scheduled INTEGER DEFAULT 1")
                print("Successfully added is_scheduled column to scheduled_posts")
            
            # Migration for linkedin_accounts to add user_id if missing
            cursor = conn.execute("PRAGMA table_info(linkedin_accounts)")
            columns = [column[1] for column in cursor.fetchall()]
            if columns and "user_id" not in columns:
                print("Migrating linkedin_accounts table: adding user_id column")
                conn.execute("ALTER TABLE linkedin_accounts ADD COLUMN user_id INTEGER DEFAULT 1 REFERENCES users(id)")
                print("Successfully added user_id column to linkedin_accounts")

            # Migration for linkedin_accounts to add picture if missing
            cursor = conn.execute("PRAGMA table_info(linkedin_accounts)")
            columns = [column[1] for column in cursor.fetchall()]
            if columns and "picture" not in columns:
                print("Migrating linkedin_accounts table: adding picture column")
                conn.execute("ALTER TABLE linkedin_accounts ADD COLUMN picture TEXT")
                print("Successfully added picture column to linkedin_accounts")

            # Migration for instagram_accounts to convert primary key from user_id to instagram_account_id
            cursor = conn.execute("PRAGMA table_info(instagram_accounts)")
            table_info = cursor.fetchall()
            user_id_pk = False
            for col in table_info:
                if col[1] == 'user_id' and col[5] > 0:
                    user_id_pk = True
            
            if user_id_pk:
                print("Migrating instagram_accounts table to support multiple accounts per user...")
                conn.execute("ALTER TABLE instagram_accounts RENAME TO old_instagram_accounts")
                conn.execute("""
                    CREATE TABLE instagram_accounts (
                        instagram_account_id TEXT NOT NULL,
                        user_id INTEGER NOT NULL,
                        username TEXT NOT NULL,
                        access_token TEXT NOT NULL,
                        expires_at DATETIME NOT NULL,
                        last_refreshed_at DATETIME NOT NULL,
                        status TEXT DEFAULT 'active',
                        PRIMARY KEY (instagram_account_id, username),
                        FOREIGN KEY (user_id) REFERENCES users (id)
                    )
                """)
                cursor = conn.execute("SELECT * FROM old_instagram_accounts")
                rows = cursor.fetchall()
                for row in rows:
                    ig_id = row['instagram_account_id']
                    if not ig_id:
                        ig_id = f"fallback_{row['user_id']}"
                    conn.execute("""
                        INSERT OR REPLACE INTO instagram_accounts 
                        (instagram_account_id, user_id, username, access_token, expires_at, last_refreshed_at, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (ig_id, row['user_id'], row['username'], row['access_token'], row['expires_at'], row['last_refreshed_at'], row['status']))
                conn.execute("DROP TABLE old_instagram_accounts")
                print("Successfully migrated instagram_accounts table to support multiple accounts.")

            conn.commit()

    def _migrate_users_auth_columns(self, conn: sqlite3.Connection) -> None:
        """Add Firebase linkage columns for Google / Firebase sign-in sync."""
        cursor = conn.execute("PRAGMA table_info(users)")
        columns = {row[1] for row in cursor.fetchall()}
        if "firebase_uid" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN firebase_uid TEXT")
        if "auth_provider" not in columns:
            conn.execute(
                "ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'local'"
            )

    def get_connection(self):
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

db = Database()
