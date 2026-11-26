"""Schemas for Step 7m job alerts / saved searches (job seeker).

``criteria`` is a structured, ``extra="forbid"`` object that serializes to the
``jsonb`` column. Keeping it typed (not a raw dict) means an invalid
work_mode/employment_type or a 2-letter currency is a 422 before it ever
reaches the database. ``delivery`` is Step 12; ``last_sent_at`` is returned but
never written by this step.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.job import EmploymentType, WorkMode
from app.models.job_alert import AlertFrequency


class JobAlertCriteria(BaseModel):
    model_config = ConfigDict(extra="forbid")

    keywords: Annotated[str | None, Field(max_length=200)] = None
    location: Annotated[str | None, Field(max_length=200)] = None
    work_mode: WorkMode | None = None
    employment_type: EmploymentType | None = None
    salary_min: Annotated[
        Decimal | None, Field(ge=0, max_digits=14, decimal_places=2, allow_inf_nan=False)
    ] = None
    currency: Annotated[str | None, Field(pattern="^[A-Z]{3}$")] = None
    remote_only: bool | None = None


class JobAlertCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Annotated[str, Field(min_length=1, max_length=200)]

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title must not be blank")
        return value

    criteria: JobAlertCriteria = Field(default_factory=JobAlertCriteria)
    frequency: AlertFrequency = AlertFrequency.daily
    is_active: bool = True


class JobAlertUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Annotated[str | None, Field(min_length=1, max_length=200)] = None
    criteria: JobAlertCriteria | None = None
    frequency: AlertFrequency | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def reject_nulls(self):
        for name in self.model_fields_set:
            if getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        if self.title is not None:
            self.title = self.title.strip()
            if not self.title:
                raise ValueError("Title must not be blank")
        return self


class JobAlertRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    criteria: JobAlertCriteria
    frequency: AlertFrequency
    is_active: bool
    last_sent_at: datetime | None
    created_at: datetime
    updated_at: datetime


class JobAlertPage(BaseModel):
    items: list[JobAlertRead]
    total: int
    limit: int
    offset: int
    has_more: bool
