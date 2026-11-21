"""Strict request and response contracts for startup funding rounds."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.funding_round import Instrument, RoundStatus, RoundType

PositiveMoney = Annotated[Decimal, Field(gt=0, max_digits=14, decimal_places=2)]
NonnegativeMoney = Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2)]


class Terms(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_amount: PositiveMoney | None = None
    minimum_raise: PositiveMoney | None = None
    minimum_ticket: PositiveMoney | None = None
    pre_money_valuation: NonnegativeMoney | None = None
    instrument: Instrument | None = None
    opens_on: date | None = None
    closes_on: date | None = None


class FundingRoundCreate(Terms):
    name: str = Field(min_length=1, max_length=200)
    round_type: RoundType
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class FundingRoundUpdate(Terms):
    # Omitted fields are ignored; explicit null is forbidden on required columns.
    name: str = Field(default="", min_length=1, max_length=200)
    round_type: RoundType = RoundType.other
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class StatusChange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: RoundStatus


class FundingRoundRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    round_type: RoundType
    target_amount: Decimal | None
    minimum_raise: Decimal | None
    minimum_ticket: Decimal | None
    currency: str
    pre_money_valuation: Decimal | None
    instrument: Instrument | None
    status: RoundStatus
    opens_on: date | None
    closes_on: date | None
    created_at: datetime
    updated_at: datetime


class FundingRoundPage(BaseModel):
    items: list[FundingRoundRead]
    total: int
    limit: int
    offset: int


class RoundProgress(BaseModel):
    target_amount: Decimal | None
    currency: str
    committed_amount: Decimal | None = None
    remaining_amount: Decimal | None = None
    committed_percentage: Decimal | None = None
    available: bool = False
