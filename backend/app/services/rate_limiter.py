"""Rate limiting: Redis (Upstash in prod) with in-memory fallback.

When REDIS_URL is empty (dev/test without Redis), an in-memory
fixed-window limiter is used. Production must set REDIS_URL.
"""

import time
from collections import defaultdict

from app.core.config import get_settings


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
    """Unified interface: async check() that works with either backend."""

    def __init__(self) -> None:
        settings = get_settings()
        self._redis_url = settings.REDIS_URL
        self._redis: RedisRateLimiter | None = None
        self._memory = InMemoryRateLimiter()

    async def check(self, key: str, limit: int, window_seconds: int) -> bool:
        if self._redis_url:
            if self._redis is None:
                self._redis = RedisRateLimiter(self._redis_url)
            return await self._redis.check(key, limit, window_seconds)
        return self._memory.check(key, limit, window_seconds)

    def reset(self) -> None:
        self._memory.reset()


# Single shared instance (tests reset it via fixture).
rate_limiter = RateLimiter()
