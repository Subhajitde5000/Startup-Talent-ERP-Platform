"""Step 8c schemas: a mentor's weekly availability.

Two write shapes:

``AvailabilitySlotIn``   one window, used by POST and by each item of the
                         whole-week PUT.
``AvailabilityWeekIn``   the entire week, replaced atomically.

Reads return the stored local wall-clock window plus the IANA zone, never
a pre-converted UTC instant: a recurring 18:00 slot must stay 18:00 across
a daylight-saving change, so conversion belongs at the point where a
concrete bookable instant is computed (``AvailabilitySlotsRead``).
"""

import uuid
from datetime import date, datetime, time
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

WEEKDAYS_MAX = 6
SLOTS_PER_WEEK_MAX = 20
TIMEZONE_MAX = 64


def _valid_timezone(value: str) -> str:
    """A real IANA zone. ``zoneinfo`` is stdlib, so no new dependency."""
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    name = value.strip()
    if not name:
        msg = "A timezone is required."
        raise ValueError(msg)
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        msg = f"Unknown timezone: {name!r}."
        raise ValueError(msg) from exc
    return name


class AvailabilitySlotIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    weekday: int = Field(ge=0, le=WEEKDAYS_MAX, description="0 = Monday, 6 = Sunday.")
    start_time: time
    end_time: time
    timezone: str = Field(max_length=TIMEZONE_MAX, description="IANA zone, e.g. Asia/Kolkata.")
    is_active: bool = True

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v: str) -> str:
        return _valid_timezone(v)

    @model_validator(mode="after")
    def _range(self) -> Self:
        if self.end_time <= self.start_time:
            msg = "end_time must be after start_time."
            raise ValueError(msg)
        return self


class AvailabilityWeekIn(BaseModel):
    """Replace my whole week. ``slots=[]`` clears it, which is valid."""

    model_config = ConfigDict(extra="forbid")

    slots: list[AvailabilitySlotIn] = Field(max_length=SLOTS_PER_WEEK_MAX)

    @model_validator(mode="after")
    def _no_duplicates(self) -> Self:
        seen: set[tuple[int, time]] = set()
        for slot in self.slots:
            key = (slot.weekday, slot.start_time)
            if key in seen:
                msg = f"Duplicate slot on weekday {slot.weekday} at {slot.start_time}."
                raise ValueError(msg)
            seen.add(key)
        return self


class AvailabilitySlotRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    weekday: int
    start_time: time
    end_time: time
    timezone: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AvailabilityWeekRead(BaseModel):
    """The mentor's week, ordered by weekday then start."""

    slots: list[AvailabilitySlotRead]
    timezone: str | None = Field(
        default=None,
        description="The zone every slot is expressed in, when they agree; else null.",
    )


class BookableSlot(BaseModel):
    """One concrete, bookable instant derived from the template.

    ``start``/``end`` are the UTC instants (8d books against these);
    ``label`` is the same window in the mentor's own zone, which is what
    the UI shows. ``local_date``/``local_start`` are provided so a client
    never has to re-derive the wall clock from the instant.
    """

    start: datetime
    end: datetime
    local_date: date
    local_start: time
    local_end: time
    timezone: str


class BookableSlotsRead(BaseModel):
    mentor_handle: str
    timezone: str | None
    items: list[BookableSlot]
    total: int
