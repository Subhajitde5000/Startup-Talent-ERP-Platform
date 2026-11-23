"""Cloudflare R2 adapter. No public bucket or local fallback in production.

The synchronous SDK is isolated here and always called in a worker thread.
Never log provider exceptions: they may contain bucket names or signed URLs.
"""

import asyncio
from datetime import datetime
from functools import lru_cache
from typing import Any, Protocol
from urllib.parse import quote

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import get_settings
from app.core.exceptions import AppException


class StorageMissing(Exception):
    pass


class StorageInvalid(Exception):
    pass


class Storage(Protocol):
    async def sign_upload(self, key: str, mime: str, ttl: int) -> str: ...
    async def sign_download(
        self, key: str, name: str, mime: str, ttl: int, *, image: bool = False
    ) -> str: ...
    async def read(self, key: str, max_size: int) -> tuple[bytes, str]: ...
    async def put(self, key: str, data: bytes, mime: str) -> None: ...
    async def delete(self, key: str) -> None: ...
    async def cleanup_prefix(self, prefix: str, keep: set[str], before: datetime) -> None: ...


class R2Storage:
    def __init__(self) -> None:
        settings = get_settings()
        if not all(
            (
                settings.R2_ACCOUNT_ID,
                settings.R2_ACCESS_KEY_ID,
                settings.R2_SECRET_ACCESS_KEY,
                settings.R2_BUCKET,
            )
        ):
            raise AppException("STORAGE_UNAVAILABLE", "File storage is not configured.", 503)
        self.bucket = settings.R2_BUCKET
        self.client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
            config=Config(
                signature_version="s3v4",
                connect_timeout=5,
                read_timeout=30,
                retries={"max_attempts": 2},
                s3={"addressing_style": "path"},
            ),
        )

    async def _call(self, method: str, **kwargs: Any) -> Any:
        try:
            return await asyncio.to_thread(getattr(self.client, method), **kwargs)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in {"NoSuchKey", "404", "NotFound"}:
                raise StorageMissing from None
            raise AppException(
                "STORAGE_UNAVAILABLE", "File storage is temporarily unavailable.", 503
            ) from None
        except BotoCoreError:
            raise AppException(
                "STORAGE_UNAVAILABLE", "File storage is temporarily unavailable.", 503
            ) from None

    async def sign_upload(self, key: str, mime: str, ttl: int) -> str:
        return str(
            await self._call(
                "generate_presigned_url",
                ClientMethod="put_object",
                Params={"Bucket": self.bucket, "Key": key, "ContentType": mime},
                ExpiresIn=ttl,
                HttpMethod="PUT",
            )
        )

    async def sign_download(
        self, key: str, name: str, mime: str, ttl: int, *, image: bool = False
    ) -> str:
        disposition = "inline" if image else "attachment"
        return str(
            await self._call(
                "generate_presigned_url",
                ClientMethod="get_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": key,
                    "ResponseContentType": mime,
                    "ResponseContentDisposition": f"{disposition}; filename*=UTF-8''{quote(name, safe='')}",
                    "ResponseCacheControl": "private, no-store",
                },
                ExpiresIn=ttl,
                HttpMethod="GET",
            )
        )

    async def read(self, key: str, max_size: int) -> tuple[bytes, str]:
        result = await self._call("get_object", Bucket=self.bucket, Key=key)
        body = result["Body"]
        try:
            if result["ContentLength"] > max_size:
                raise StorageInvalid("Object exceeds its size limit.")
            data = await asyncio.to_thread(body.read, max_size + 1)
            if len(data) > max_size:
                raise StorageInvalid("Object exceeds its size limit.")
            return data, result.get("ContentType", "")
        except (BotoCoreError, OSError):
            raise AppException(
                "STORAGE_UNAVAILABLE", "File storage is temporarily unavailable.", 503
            ) from None
        finally:
            await asyncio.to_thread(body.close)

    async def put(self, key: str, data: bytes, mime: str) -> None:
        await self._call(
            "put_object",
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=mime,
            CacheControl="private, no-store",
        )

    async def delete(self, key: str) -> None:
        await self._call("delete_object", Bucket=self.bucket, Key=key)

    async def cleanup_prefix(self, prefix: str, keep: set[str], before: datetime) -> None:
        # Each provider request is bounded; walk all pages before marking purged.
        params: dict[str, Any] = dict(Bucket=self.bucket, Prefix=prefix, MaxKeys=1000)
        while True:
            result = await self._call("list_objects_v2", **params)
            for item in result.get("Contents", []):
                if item["Key"] not in keep and item["LastModified"] < before:
                    await self.delete(item["Key"])
            if not result.get("IsTruncated"):
                break
            params["ContinuationToken"] = result["NextContinuationToken"]


@lru_cache
def get_storage() -> Storage:
    return R2Storage()
