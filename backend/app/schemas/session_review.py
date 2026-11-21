"""Validated review payloads; identity and provenance are server-owned."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, StrictInt


class ReviewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    rating: StrictInt = Field(ge=1, le=5)
    public_text: str | None = Field(default=None, max_length=2000)
    private_feedback: str | None = Field(default=None, max_length=2000)
    public_consent: bool = False
    anonymous: bool = True


class ReviewRead(ReviewCreate):
    id: uuid.UUID
    session_id: uuid.UUID
    created_at: datetime


class MentorReviewRead(BaseModel):
    startup_name: str | None = None
    session_topic: str | None = None
    id: uuid.UUID
    session_id: uuid.UUID
    rating: int
    public_text: str | None
    private_feedback: str | None
    public_consent: bool
    anonymous: bool
    created_at: datetime


class PublicReviewRead(BaseModel):
    rating: int
    public_text: str | None
    reviewer_name: str | None
    created_at: datetime


class MentorReviewPage(BaseModel):
    items: list[MentorReviewRead]
    total: int
    limit: int
    offset: int


class PublicReviewPage(BaseModel):
    items: list[PublicReviewRead]
    total: int
    limit: int
    offset: int
