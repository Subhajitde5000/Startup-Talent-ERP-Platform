import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import Settings
from app.core.exceptions import AuthenticationError

ph = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=1)


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    if not hashed_password:
        return False
    try:
        return ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def hash_token(raw_token: str) -> str:
    """Compute SHA-256 hex digest of a token."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_token(nbytes: int = 32) -> tuple[str, str]:
    """Generate a secure random token and its SHA-256 hash. Returns (raw_token, token_hash)."""
    raw_token = secrets.token_urlsafe(nbytes)
    return raw_token, hash_token(raw_token)


def create_access_token(user_id: str | uuid.UUID, settings: Settings) -> str:
    now = datetime.now(UTC)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
        "jti": str(uuid.uuid4()),
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(settings: Settings) -> tuple[str, str, datetime]:
    """Generate a secure refresh token. Returns (raw_token, token_hash, expires_at)."""
    raw_token = secrets.token_urlsafe(64)
    token_hash = hash_token(raw_token)
    expires_at = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return raw_token, token_hash, expires_at


def decode_access_token(token: str, settings: Settings) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["exp", "iat", "jti", "type", "sub"]},
        )
        if payload.get("type") != "access":
            raise AuthenticationError("Invalid token type.")
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token has expired.") from None
    except jwt.PyJWTError:
        raise AuthenticationError("Could not validate credentials.") from None
