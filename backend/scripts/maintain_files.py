"""Run every 15 minutes: PYTHONPATH=. python scripts/maintain_files.py.

Per-file database leases and conditional publication permit overlapping runs.
No credentials, object keys or filenames are printed.
"""

import argparse
import asyncio
import json

from app.db.session import async_session_factory, engine
from app.services.file_processing_service import get_scanner, maintain_files
from app.services.storage_service import get_storage


async def main(batch_size: int) -> None:
    try:
        stats = await maintain_files(
            async_session_factory, get_storage(), get_scanner(), batch_size
        )
        print(json.dumps(stats))
        if stats["failed"]:
            raise SystemExit(1)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--batch-size", type=int, default=100, choices=range(1, 1001), metavar="1..1000"
    )
    asyncio.run(main(parser.parse_args().batch_size))
