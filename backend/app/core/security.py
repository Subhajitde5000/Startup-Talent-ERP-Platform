"""Password hashing (argon2id) and JWT helpers.

- Passwords: argon2id via argon2-cffi. Never store or log plain text.
- Access tokens: short-lived JWT (HS256), stateless.
- Refresh / verification / reset tokens: opaque random values, stored
  hashed (SHA-256 hex) server-side, single-use with expiry.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings

_ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        return _ph.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    try:
        return _ph.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


def hash_token(raw_token: str) -> str:
    """SHA-256 hex digest for storing opaque tokens at rest."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_opaque_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def generate_verification_code() -> str:
    """6-digit numeric code, matching the frontend (/verify-email)."""
    return f"{secrets.randbelow(900000) + 100000:06d}"


def create_access_token(user_id: UUID, *, expires_minutes: int | None = None) -> str:
    settings = get_settings()
    minutes = expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> UUID:
    """Decode and validate an access token. Raises jwt exceptions."""
    settings = get_settings()
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Not an access token.")
    sub = payload.get("sub")
    if not sub:
        raise jwt.InvalidTokenError("Missing subject.")
    return UUID(str(sub))
