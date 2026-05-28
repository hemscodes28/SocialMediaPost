import os
import jwt
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from app.models import User, UserInDB, TokenData
from app.database import db
from app.config import settings

# Password hashing context
# Using pbkdf2_sha256 as the primary scheme to avoid bcrypt's 72-byte limit
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# OAuth2 settings
# OAuth2 settings - auto_error=False allows us to check query params if header is missing
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

# JWT settings
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-123456789") # Use a strong secret in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days — persistent browser sessions

class AuthService:
    @staticmethod
    def verify_password(plain_password, hashed_password):
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def get_password_hash(password):
        return pwd_context.hash(password)

    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})

        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

    @staticmethod
    async def get_user_by_email(email: str) -> Optional[UserInDB]:
        with db.get_connection() as conn:
            cursor = conn.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()
            if row:
                return UserInDB(
                    id=row['id'],
                    email=row['email'],
                    full_name=row['full_name'],
                    hashed_password=row['hashed_password']
                )
        return None

    @staticmethod
    async def create_user_with_hashed_password(
        email: str,
        full_name: str,
        hashed_password: str,
        *,
        firebase_uid: Optional[str] = None,
        auth_provider: str = "local",
    ) -> User:
        with db.get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO users (email, full_name, hashed_password, firebase_uid, auth_provider)
                VALUES (?, ?, ?, ?, ?)
                """,
                (email, full_name, hashed_password, firebase_uid, auth_provider),
            )
            user_id = cursor.lastrowid
            conn.commit()
        return User(id=user_id, email=email, full_name=full_name, password=None)

    @staticmethod
    async def update_user_from_firebase(
        user_id: int,
        *,
        full_name: Optional[str] = None,
        firebase_uid: Optional[str] = None,
        auth_provider: Optional[str] = None,
    ) -> None:
        updates = []
        params = []
        if full_name:
            updates.append("full_name = ?")
            params.append(full_name)
        if firebase_uid:
            updates.append("firebase_uid = ?")
            params.append(firebase_uid)
        if auth_provider:
            updates.append("auth_provider = ?")
            params.append(auth_provider)
        if not updates:
            return
        params.append(user_id)
        with db.get_connection() as conn:
            conn.execute(
                f"UPDATE users SET {', '.join(updates)} WHERE id = ?",
                params,
            )
            conn.commit()

    @staticmethod
    async def ensure_local_user(
        email: str,
        full_name: str,
        *,
        firebase_uid: Optional[str] = None,
        auth_provider: str = "firebase",
    ) -> Tuple[User, bool]:
        """
        Ensure a row exists in accounts.db for this Firebase / Google identity.
        Returns (user, created) where created is True when a new row was inserted.
        """
        from app.services.google_auth_service import random_password_for_oauth_user

        email = email.strip().lower()
        display_name = (full_name or email.split("@")[0]).strip() or email.split("@")[0]

        existing = await AuthService.get_user_by_email(email)
        if existing:
            await AuthService.update_user_from_firebase(
                existing.id,
                full_name=display_name if display_name else None,
                firebase_uid=firebase_uid,
                auth_provider=auth_provider,
            )
            refreshed = await AuthService.get_user_by_email(email)
            user = User(
                id=refreshed.id,
                email=refreshed.email,
                full_name=refreshed.full_name,
            )
            return user, False

        hashed = AuthService.get_password_hash(random_password_for_oauth_user())
        user = await AuthService.create_user_with_hashed_password(
            email,
            display_name,
            hashed,
            firebase_uid=firebase_uid,
            auth_provider=auth_provider,
        )
        return user, True

    @staticmethod
    async def create_user(user: User) -> User:
        hashed_password = AuthService.get_password_hash(user.password)
        with db.get_connection() as conn:
            cursor = conn.execute(
                "INSERT INTO users (email, full_name, hashed_password) VALUES (?, ?, ?)",
                (user.email, user.full_name, hashed_password)
            )
            user_id = cursor.lastrowid
            conn.commit()
            user.id = user_id
            user.password = None
            return user

    @staticmethod
    async def get_current_user(
        token: Optional[str] = Depends(oauth2_scheme),
        token_query: Optional[str] = Query(None, alias="token")
    ) -> User:
        # Check query param if header token is missing
        final_token = token or token_query
        
        if not final_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )

            
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        try:
            payload = jwt.decode(final_token, SECRET_KEY, algorithms=[ALGORITHM])
            email: str = payload.get("sub")
            if email is None:
                raise credentials_exception
            token_data = TokenData(email=email)
        except jwt.PyJWTError as e:
            raise credentials_exception


        
        user = await AuthService.get_user_by_email(token_data.email)
        if user is None:
            raise credentials_exception
        return user

auth_service = AuthService()
