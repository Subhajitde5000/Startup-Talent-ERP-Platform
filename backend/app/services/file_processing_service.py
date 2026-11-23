"""Bounded validation, fail-closed scanner hook, thumbnails and retryable jobs.

A database lease claims each file without holding a transaction during I/O.
Each attempt writes different final keys, and only the lease holder can publish.
A deleted row can never be republished. Maintenance removes abandoned attempts.
"""

import asyncio
import hashlib
import io
import logging
import uuid
import warnings
import zipfile
from datetime import timedelta
from pathlib import PurePosixPath
from typing import Protocol

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import get_settings
from app.models.activity import ActivityEventType
from app.models.file import File
from app.schemas.file import max_bytes
from app.services.file_service import audit, aware, file_prefix, now
from app.services.storage_service import Storage, StorageInvalid, StorageMissing

logger = logging.getLogger("forma")


class Scanner(Protocol):
    async def scan(self, data: bytes, mime: str) -> str: ...


class ConfiguredScanner:
    async def scan(self, data: bytes, mime: str) -> str:
        settings = get_settings()
        if settings.FILE_SCANNER == "dev_clean" and not settings.is_prod:
            return "clean"
        # Intentional stub: an unavailable production scanner NEVER approves bytes.
        return "failed"


def get_scanner() -> Scanner:
    return ConfiguredScanner()


def validate_bytes(data: bytes, mime: str, name: str) -> bytes | None:
    """Structural checks supplement, but do not replace, malware scanning."""
    ext = PurePosixPath(name).suffix.lower()
    if mime.startswith("image/"):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(data)) as image:
                    expected = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}[
                        mime
                    ]
                    if (
                        image.format != expected
                        or image.width * image.height > 20_000_000
                        or getattr(image, "n_frames", 1) != 1
                    ):
                        raise ValueError("Unsupported image.")
                    image.verify()
                with Image.open(io.BytesIO(data)) as image:
                    image.load()
                    thumb = ImageOps.exif_transpose(image).convert("RGB")
                    thumb.thumbnail((256, 256))
                    output = io.BytesIO()
                    thumb.save(output, format="WEBP", quality=85)
                    return output.getvalue()
        except (
            UnidentifiedImageError,
            OSError,
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
            KeyError,
        ) as exc:
            raise ValueError("Invalid image.") from exc
    elif ext == ".pdf":
        if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-2048:]:
            raise ValueError("Invalid PDF signature.")
    elif ext in {".docx", ".pptx", ".xlsx"}:
        required = {
            ".docx": "word/document.xml",
            ".pptx": "ppt/presentation.xml",
            ".xlsx": "xl/workbook.xml",
        }[ext]
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                members = archive.infolist()
                names = {item.filename for item in members}
                if (
                    len(members) > 2000
                    or len(names) != len(members)
                    or sum(item.file_size for item in members) > 50 * 1024 * 1024
                ):
                    raise ValueError("Office container exceeds limits.")
                if required not in names or "[Content_Types].xml" not in names:
                    raise ValueError("Wrong Office container.")
                for item in members:
                    path = PurePosixPath(item.filename)
                    if (
                        item.flag_bits & 1
                        or path.is_absolute()
                        or ".." in path.parts
                        or "\\" in item.filename
                        or "vbaproject" in item.filename.lower()
                        or item.filename.lower().endswith((".exe", ".dll", ".bin"))
                    ):
                        raise ValueError("Unsafe Office container.")
                    # Bound expansion and force CRC/decompression verification.
                    with archive.open(item) as stream:
                        if len(stream.read(50 * 1024 * 1024 + 1)) != item.file_size:
                            raise ValueError("Invalid Office member.")
        except (zipfile.BadZipFile, RuntimeError, NotImplementedError, OSError) as exc:
            raise ValueError("Invalid Office document.") from exc
    else:
        text = data.decode("utf-8-sig")
        if any(ord(char) < 32 and char not in "\r\n\t" for char in text):
            raise ValueError("Invalid text document.")
    return None


async def process_file(
    file_id: uuid.UUID,
    sessions: async_sessionmaker[AsyncSession],
    storage: Storage,
    scanner: Scanner,
) -> None:
    token = uuid.uuid4()
    async with sessions() as db:
        claim = await db.execute(
            update(File)
            .where(
                File.id == file_id,
                File.deleted_at.is_(None),
                File.upload_status == "uploaded",
                or_(File.processing_expires_at.is_(None), File.processing_expires_at < now()),
            )
            .values(processing_token=token, processing_expires_at=now() + timedelta(minutes=10))
            .returning(File.id)
        )
        await db.commit()
        if claim.scalar_one_or_none() is None:
            return
        row = (await db.execute(select(File).where(File.id == file_id))).scalar_one()
        # expire_on_commit may be enabled on a supplied factory; retain scalar snapshot.
        staging, mime, size, name, kind, prefix = (
            row.upload_storage_key,
            row.mime_type,
            row.byte_size,
            row.file_name,
            row.kind,
            file_prefix(row),
        )
    scan, status, checksum, thumbnail = "failed", "uploaded", None, None
    final = f"{prefix}{token.hex}"
    thumb_key = f"{prefix}{token.hex}.webp"
    published = False
    wrote_final = False
    try:
        if not staging:
            raise StorageInvalid("Missing staging object.")
        data, stored_mime = await storage.read(staging, max_bytes(kind))
        if len(data) != size or stored_mime != mime:
            raise StorageInvalid("Uploaded metadata does not match the reservation.")
        thumbnail = await asyncio.to_thread(validate_bytes, data, mime, name)
        checksum = hashlib.sha256(data).hexdigest()
        scan = await asyncio.wait_for(scanner.scan(data, mime), timeout=120)
        if scan not in {"clean", "infected", "failed"}:
            scan = "failed"
        if scan == "clean":
            await storage.put(final, data, mime)
            wrote_final = True
            if thumbnail:
                await storage.put(thumb_key, thumbnail, "image/webp")
            status = "ready"
        elif scan == "infected":
            status = "rejected"
    except (ValueError, StorageInvalid):
        scan, status = "failed", "rejected"
    except StorageMissing:
        # Direct upload can still be completing: maintenance retries until expiry grace.
        scan, status = "pending", "uploaded"
    except Exception:
        # Persist a retryable failure, without leaking provider details or file content.
        scan, status = "failed", "uploaded"
        logger.warning("File processing failed; retry scheduled", extra={"file_id": str(file_id)})
    try:
        async with sessions() as db:
            values: dict = dict(
                scan_status=scan,
                upload_status=status,
                scanned_at=now() if scan != "pending" else None,
                checksum_sha256=checksum,
                processing_token=None,
                processing_expires_at=None,
            )
            if status == "ready":
                values.update(
                    storage_key=final, thumbnail_storage_key=thumb_key if thumbnail else None
                )
            result = await db.execute(
                update(File)
                .where(
                    File.id == file_id,
                    File.processing_token == token,
                    File.deleted_at.is_(None),
                    File.upload_status == "uploaded",
                    File.processing_expires_at > now(),
                )
                .values(**values)
                .returning(File.id)
            )
            changed = result.scalar_one_or_none() is not None
            if changed:
                row = (await db.execute(select(File).where(File.id == file_id))).scalar_one()
                audit(db, row, ActivityEventType.file_processed)
            await db.commit()
            published = bool(changed and status == "ready")
    finally:
        if wrote_final and not published:
            # Best effort here; maintenance also reaps crash leftovers by prefix.
            try:
                await storage.delete(final)
                await storage.delete(thumb_key)
            except Exception:
                logger.warning("File attempt cleanup deferred", extra={"file_id": str(file_id)})


async def process_in_background(file_id: uuid.UUID, scanner: Scanner, storage: Storage) -> None:
    from app.db.session import async_session_factory

    try:
        await process_file(file_id, async_session_factory, storage, scanner)
    except Exception:
        logger.warning(
            "File job interrupted; maintenance will retry", extra={"file_id": str(file_id)}
        )


async def maintain_files(
    sessions: async_sessionmaker[AsyncSession],
    storage: Storage,
    scanner: Scanner,
    batch_size: int = 100,
) -> dict[str, int]:
    """Keyset batches; per-file CAS leases protect overlap with API/other runs."""
    if not 1 <= batch_size <= 1000:
        raise ValueError("batch_size must be between 1 and 1000")
    cutoff = now() - timedelta(hours=get_settings().FILE_RETENTION_HOURS)
    stats = {"visited": 0, "retried": 0, "purged": 0, "failed": 0}
    last_id = None
    while True:
        async with sessions() as db:
            query = (
                select(File.id)
                .where(
                    File.purged_at.is_(None),
                    or_(
                        File.upload_status.in_(["pending", "uploaded", "rejected", "expired"]),
                        File.deleted_at.is_not(None),
                        File.upload_storage_key.is_not(None),
                        (File.owner_org_id.is_(None))
                        & File.storage_key.startswith("organizations/"),
                        (File.owner_org_id.is_(None)) & File.uploaded_by.is_(None),
                    ),
                )
                .order_by(File.id)
                .limit(batch_size)
            )
            if last_id:
                query = query.where(File.id > last_id)
            ids = list((await db.execute(query)).scalars())
        if not ids:
            break
        for file_id in ids:
            stats["visited"] += 1
            try:
                async with sessions() as db:
                    row = await db.get(File, file_id)
                    if row is None:
                        continue
                    # Do not purge while a current worker can still write objects.
                    if row.processing_expires_at and aware(row.processing_expires_at) > now():
                        continue
                    orphan = (
                        row.owner_org_id is None and row.storage_key.startswith("organizations/")
                    ) or (row.owner_org_id is None and row.uploaded_by is None)
                    if orphan and row.deleted_at is None:
                        row.deleted_at = now()
                        audit(db, row, ActivityEventType.file_deleted)
                        await db.commit()
                        await db.refresh(row)
                    deadline = aware(row.upload_expires_at)
                    if (
                        row.deleted_at is None
                        and row.upload_status in {"pending", "uploaded"}
                        and deadline < cutoff
                    ):
                        row.upload_status = "expired"
                        audit(db, row, ActivityEventType.file_expired)
                        await db.commit()
                        await db.refresh(row)
                    prefix, staging = file_prefix(row), row.upload_storage_key
                    purge = bool(
                        (row.deleted_at and aware(row.deleted_at) < cutoff)
                        or (row.upload_status in {"expired", "rejected"} and deadline < cutoff)
                    )
                    retry = row.upload_status == "uploaded" and row.deleted_at is None
                    ready = row.upload_status == "ready" and row.deleted_at is None
                    keep = {row.storage_key, row.thumbnail_storage_key or ""} if ready else set()
                # No database transaction remains open over network I/O.
                if retry:
                    await process_file(file_id, sessions, storage, scanner)
                    stats["retried"] += 1
                if purge or (ready and deadline < cutoff):
                    await storage.cleanup_prefix(prefix, keep, now())
                    if staging and (purge or deadline < cutoff):
                        await storage.delete(staging)
                    async with sessions() as db:
                        row = await db.get(File, file_id)
                        if row is not None:
                            if staging and (purge or deadline < cutoff):
                                row.upload_storage_key = None
                            if purge:
                                purged = await db.execute(
                                    update(File)
                                    .where(File.id == file_id, File.purged_at.is_(None))
                                    .values(purged_at=now())
                                    .returning(File.id)
                                )
                                if purged.scalar_one_or_none() is not None:
                                    audit(db, row, ActivityEventType.file_purged)
                                    stats["purged"] += 1
                            await db.commit()
            except Exception:
                stats["failed"] += 1
                logger.warning("File maintenance deferred", extra={"file_id": str(file_id)})
        last_id = ids[-1]
    return stats
