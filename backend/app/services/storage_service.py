"""Storage adapters: Cloudflare R2 (production) and local disk (dev only).

R2 is used when all four R2_* env vars are set AND ENVIRONMENT is not 'prod'
without them. If R2 is unconfigured and the environment is not 'prod', a
LocalStorage backend is used instead — files are saved under backend/local_uploads/
and served via signed HMAC tokens through the /api/v1/files/local-* endpoints.

The synchronous S3 SDK is isolated here and always called in a worker thread.
Never log provider exceptions: they may contain bucket names or signed URLs.
"""

import asyncio
import hashlib
import hmac
import json
import logging
from base64 import urlsafe_b64decode, urlsafe_b64encode
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import quote

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import get_settings
from app.core.exceptions import AppException

logger = logging.getLogger(__name__)


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


class LocalStorage:
    """Dev-only local disk storage.

    Files are saved under backend/local_uploads/{key} (directories created on
    demand). Upload and download are gated by short-lived HMAC-SHA256 tokens
    so random filesystem paths are never guessable from outside the API.

    Token payload: {"k": key, "m": mime, "n": name, "a": action, "exp": ts}
    Signed with JWT_SECRET so the token is tied to this instance.
    """

    _UPLOAD_DIR_NAME = "local_uploads"

    def __init__(self) -> None:
        settings = get_settings()
        # Resolve relative to this file's project root (backend/)
        backend_root = Path(__file__).parent.parent.parent
        self._base = backend_root / self._UPLOAD_DIR_NAME
        self._base.mkdir(parents=True, exist_ok=True)
        self._secret = settings.JWT_SECRET.encode()
        self._api_prefix = settings.API_V1_PREFIX
        self._base_url = settings.FRONTEND_BASE_URL.replace(":3000", ":8000")
        logger.warning(
            "LocalStorage is active — files stored at %s. "
            "Set R2_* env vars for production use.",
            self._base,
        )

    # ------------------------------------------------------------------
    # Token helpers
    # ------------------------------------------------------------------

    def _make_token(self, payload: dict[str, Any], ttl: int) -> str:
        payload["exp"] = (datetime.now(UTC) + timedelta(seconds=ttl)).timestamp()
        raw = json.dumps(payload, separators=(",", ":")).encode()
        b64 = urlsafe_b64encode(raw).rstrip(b"=").decode()
        sig = hmac.new(self._secret, b64.encode(), hashlib.sha256).hexdigest()
        return f"{b64}.{sig}"

    def _verify_token(self, token: str, action: str) -> dict[str, Any]:
        try:
            b64, sig = token.rsplit(".", 1)
        except ValueError as exc:
            raise StorageInvalid("Malformed token.") from exc
        expected = hmac.new(self._secret, b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            raise StorageInvalid("Invalid token signature.")
        raw = urlsafe_b64decode(b64 + "==")
        payload: dict[str, Any] = json.loads(raw)
        if payload.get("a") != action:
            raise StorageInvalid("Token action mismatch.")
        if datetime.now(UTC).timestamp() > payload["exp"]:
            raise StorageInvalid("Token expired.")
        return payload

    def _local_path(self, key: str) -> Path:
        # Prevent path traversal: only allow keys that resolve inside _base.
        target = (self._base / key).resolve()
        if not str(target).startswith(str(self._base.resolve())):
            raise StorageInvalid("Invalid storage key.")
        return target

    def _metadata_path(self, key: str) -> Path:
        """Private sidecar for local object metadata.

        R2 stores Content-Type with each object. The development adapter must
        retain that metadata too: file processing verifies the object metadata
        against the signed upload reservation before it accepts the bytes.
        """
        path = self._local_path(key)
        return path.with_name(f"{path.name}.metadata.json")

    # ------------------------------------------------------------------
    # Storage protocol
    # ------------------------------------------------------------------

    async def sign_upload(self, key: str, mime: str, ttl: int) -> str:
        token = self._make_token({"k": key, "m": mime, "n": "", "a": "up"}, ttl)
        return f"{self._base_url}{self._api_prefix}/files/local-upload/{token}"

    async def sign_download(
        self, key: str, name: str, mime: str, ttl: int, *, image: bool = False
    ) -> str:
        token = self._make_token({"k": key, "m": mime, "n": name, "a": "dl"}, ttl)
        return f"{self._base_url}{self._api_prefix}/files/local-serve/{token}"

    async def read(self, key: str, max_size: int) -> tuple[bytes, str]:
        path = self._local_path(key)
        metadata_path = self._metadata_path(key)
        try:
            data = await asyncio.to_thread(path.read_bytes)
        except FileNotFoundError:
            raise StorageMissing from None
        except OSError as exc:
            raise AppException(
                "STORAGE_UNAVAILABLE", "Local storage read error.", 503
            ) from exc
        try:
            metadata = json.loads(await asyncio.to_thread(metadata_path.read_text, encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError, TypeError, OSError) as exc:
            raise StorageInvalid("Local object metadata is invalid.") from exc
        if len(data) > max_size:
            raise StorageInvalid("Object exceeds its size limit.")
        mime = metadata.get("mime") if isinstance(metadata, dict) else None
        if not isinstance(mime, str) or not mime:
            raise StorageInvalid("Local object metadata is invalid.")
        return data, mime

    async def put(self, key: str, data: bytes, mime: str) -> None:
        path = self._local_path(key)
        metadata_path = self._metadata_path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            await asyncio.to_thread(path.write_bytes, data)
            await asyncio.to_thread(metadata_path.write_text, json.dumps({"mime": mime}), "utf-8")
        except OSError as exc:
            raise AppException(
                "STORAGE_UNAVAILABLE", "Local storage write error.", 503
            ) from exc

    async def delete(self, key: str) -> None:
        path = self._local_path(key)
        metadata_path = self._metadata_path(key)
        try:
            await asyncio.to_thread(path.unlink, missing_ok=True)
            await asyncio.to_thread(metadata_path.unlink, missing_ok=True)
        except OSError:
            pass  # Best-effort on delete

    async def cleanup_prefix(self, prefix: str, keep: set[str], before: datetime) -> None:
        base_prefix = self._base / prefix
        if not base_prefix.exists():
            return
        for child in base_prefix.rglob("*"):
            if not child.is_file():
                continue
            rel = child.relative_to(self._base).as_posix()
            if rel in keep:
                continue
            mtime = datetime.fromtimestamp(child.stat().st_mtime, tz=UTC)
            if mtime < before:
                try:
                    child.unlink(missing_ok=True)
                except OSError:
                    pass

    # ------------------------------------------------------------------
    # Token verifier (called by the local-serve and local-upload endpoints)
    # ------------------------------------------------------------------

    def verify_upload_token(self, token: str) -> dict[str, Any]:
        return self._verify_token(token, "up")

    def verify_download_token(self, token: str) -> dict[str, Any]:
        return self._verify_token(token, "dl")


@lru_cache
def get_storage() -> Storage:
    settings = get_settings()
    try:
        return R2Storage()
    except AppException as exc:
        if exc.code == "STORAGE_UNAVAILABLE" and not settings.is_prod:
            return LocalStorage()
        raise
