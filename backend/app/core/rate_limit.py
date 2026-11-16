import asyncio

import redis.asyncio as aioredis

from app.core.config import Settings, get_settings
from app.core.exceptions import AccountLockedError, RateLimitError
from app.core.logging import get_logger

logger = get_logger("rate_limit")

_redis_pool: aioredis.Redis | None = None
_redis_loop: asyncio.AbstractEventLoop | None = None


async def get_redis_client(settings: Settings | None = None) -> aioredis.Redis:
    global _redis_pool, _redis_loop
    current_loop = asyncio.get_running_loop()
    if _redis_pool is None or _redis_loop != current_loop:
        if settings is None:
            settings = get_settings()
        _redis_pool = aioredis.from_url(  # type: ignore[no-untyped-call]
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
        _redis_loop = current_loop
    assert _redis_pool is not None
    return _redis_pool


async def close_redis() -> None:
    global _redis_pool, _redis_loop
    if _redis_pool is not None:
        await _redis_pool.aclose()
        _redis_pool = None
        _redis_loop = None


async def check_ip_rate_limit(
    redis_client: aioredis.Redis,
    ip: str,
    endpoint: str,
    limit: int = 10,
    window_seconds: int = 60,
) -> None:
    key = f"ratelimit:ip:{endpoint}:{ip}"
    try:
        current = await redis_client.incr(key)
        if current == 1:
            await redis_client.expire(key, window_seconds)
        if current > limit:
            logger.warning("ip_rate_limit_exceeded", ip=ip, endpoint=endpoint, count=current)
            raise RateLimitError(
                f"Rate limit exceeded for this IP. Maximum {limit} requests per {window_seconds}s."
            )
    except RateLimitError:
        raise
    except Exception as exc:
        logger.error("redis_rate_limit_error", error=str(exc))


async def check_email_lockout(
    redis_client: aioredis.Redis,
    email: str,
    max_attempts: int = 5,
) -> None:
    key = f"lockout:email:{email.lower().strip()}"
    try:
        attempts_str = await redis_client.get(key)
        if attempts_str and int(attempts_str) >= max_attempts:
            ttl = await redis_client.ttl(key)
            logger.warning("account_locked_out", email=email, attempts=attempts_str, ttl=ttl)
            raise AccountLockedError(
                f"Account temporarily locked due to too many failed attempts. Try again in {max(ttl, 1)} seconds."
            )
    except AccountLockedError:
        raise
    except Exception as exc:
        logger.error("redis_lockout_check_error", error=str(exc))


async def record_failed_login(
    redis_client: aioredis.Redis,
    email: str,
    window_seconds: int = 900,
) -> int:
    key = f"lockout:email:{email.lower().strip()}"
    try:
        count = await redis_client.incr(key)
        if count == 1:
            await redis_client.expire(key, window_seconds)
        return int(count)
    except Exception as exc:
        logger.error("redis_record_failed_login_error", error=str(exc))
        return 0


async def clear_email_lockout(
    redis_client: aioredis.Redis,
    email: str,
) -> None:
    key = f"lockout:email:{email.lower().strip()}"
    try:
        await redis_client.delete(key)
    except Exception as exc:
        logger.error("redis_clear_lockout_error", error=str(exc))


async def check_and_set_cooldown(
    redis_client: aioredis.Redis,
    key_prefix: str,
    identifier: str,
    cooldown_seconds: int = 60,
) -> None:
    key = f"cooldown:{key_prefix}:{identifier.lower().strip()}"
    try:
        is_set = await redis_client.set(key, "1", ex=cooldown_seconds, nx=True)
        if not is_set:
            ttl = await redis_client.ttl(key)
            raise RateLimitError(
                f"Please wait {max(ttl, 1)} seconds before requesting another email."
            )
    except RateLimitError:
        raise
    except Exception as exc:
        logger.error("redis_cooldown_error", error=str(exc))
