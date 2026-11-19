"""Audit writer (Step 3d item 8).

``record()`` only *stages* a row (``db.add``); the caller's own ``commit()``
persists it. That is deliberate: the audit entry and the change it
describes then succeed or fail together, so the log can never claim an
action that was rolled back — nor miss one that committed.

Callers pass a human-readable ``summary`` plus optional structured
``data``. Nothing here inspects its own arguments beyond storing them, so
new event types (15b, Steps 7-15) do not need to touch this module.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityEvent, ActivityEventType


def record(
    db: AsyncSession,
    *,
    event_type: ActivityEventType,
    summary: str,
    org_id: uuid.UUID | None = None,
    actor_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    link_url: str | None = None,
    data: dict | None = None,
) -> ActivityEvent:
    """Stage one audit row in the caller's transaction. Returns it unflushed."""
    event = ActivityEvent(
        org_id=org_id,
        user_id=actor_id,
        event_type=event_type.value,
        entity_type=entity_type,
        entity_id=entity_id,
        summary=summary,
        link_url=link_url,
        data=data,
    )
    db.add(event)
    return event
