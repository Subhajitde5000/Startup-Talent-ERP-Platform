"""Rate limiting: Redis (Upstash in prod) with in-memory fallback.

When REDIS_URL is empty (dev/test without Redis), an in-memory
fixed-window limiter is used. Production must set REDIS_URL.

If REDIS_URL is set but Redis is unreachable, the limiter logs a
warning and falls back to in-memory so the app stays functional.
"""

import logging
import time
from collections import defaultdict

from app.core.config import get_settings

logger = logging.getLogger("forma")


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str, limit: int, window_seconds: int) -> bool:
        """Return True if allowed, False if rate-limited."""
        now = time.monotonic()
        cutoff = now - window_seconds
        hits = [t for t in self._hits[key] if t > cutoff]
        if len(hits) >= limit:
            self._hits[key] = hits
            return False
        hits.append(now)
        self._hits[key] = hits
        return True

    def reset(self) -> None:
        self._hits.clear()


class RedisRateLimiter:
    def __init__(self, redis_url: str) -> None:
        import redis.asyncio as aioredis

        self._redis = aioredis.from_url(redis_url, decode_responses=True)

    async def check(self, key: str, limit: int, window_seconds: int) -> bool:
        # Fixed window via INCR + EXPIRE.
        count = await self._redis.incr(key)
        if count == 1:
            await self._redis.expire(key, window_seconds)
        return count <= limit


class RateLimiter:
    """Unified interface: async check() that works with either backend.

    Falls back to in-memory if Redis is configured but unreachable,
    so a missing Redis instance never takes down the application.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._redis_url = settings.REDIS_URL
        self._redis: RedisRateLimiter | None = None
        self._redis_unavailable: bool = False
        self._memory = InMemoryRateLimiter()

    async def check(self, key: str, limit: int, window_seconds: int) -> bool:
        if self._redis_url and not self._redis_unavailable:
            if self._redis is None:
                self._redis = RedisRateLimiter(self._redis_url)
            try:
                return await self._redis.check(key, limit, window_seconds)
            except Exception as exc:
                logger.warning(
                    "Redis rate-limiter unreachable (%s: %s); "
                    "falling back to in-memory limiter.",
                    type(exc).__name__,
                    exc,
                )
                self._redis_unavailable = True
                self._redis = None
        return self._memory.check(key, limit, window_seconds)

    def reset(self) -> None:
        self._memory.reset()
        self._redis_unavailable = False
        self._redis = None


# Single shared instance (tests reset it via fixture).
rate_limiter = RateLimiter()

