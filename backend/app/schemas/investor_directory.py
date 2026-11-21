"""Investor directory schemas (Step 9b: startup view of investor firms).

Read-only shapes. The directory lists investor ORGANIZATIONS (Step 3
``organizations`` joined with the 9d ``investor_preferences`` thesis
filters); no investor's members or contact details are ever returned,
only org-level public data.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.investor_search import InvestorType
from app.models.startup import StartupStage


class InvestorDirectoryItem(BaseModel):
    """One investor firm as shown in the directory cards."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    name: str
    slug: str
    investor_type: InvestorType | None
    summary: str | None
    logo_url: str | None
    logo_initials: str | None
    website: str | None
    city: str | None
    region: str | None
    country: str | None
    founded_year: int | None
    verified: bool
    sectors: list[str]
    stage_focus: list[StartupStage]
    min_ticket: Decimal | None
    max_ticket: Decimal | None


class InvestorDirectoryDetail(BaseModel):
    """The public investor page (same org-level fields as the card)."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    name: str
    slug: str
    investor_type: InvestorType | None
    summary: str | None
    logo_url: str | None
    logo_initials: str | None
    website: str | None
    city: str | None
    region: str | None
    country: str | None
    founded_year: int | None
    verified: bool
    sectors: list[str]
    stage_focus: list[StartupStage]
    min_ticket: Decimal | None
    max_ticket: Decimal | None
    created_at: datetime
    updated_at: datetime


class InvestorDirectoryPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[InvestorDirectoryItem]
    total: int
    limit: int
    offset: int


class InvestorDirectorySummary(BaseModel):
    """Header counts for the directory page (one aggregate query)."""

    model_config = ConfigDict(extra="forbid")

    total: int
    verified: int


class InvestorDirectoryFacets(BaseModel):
    """Filter facet values among listed investor firms.

    Computed over the base set (active investor firms), independent of
    the other filters, so the checkboxes stay stable while narrowing.
    """

    model_config = ConfigDict(extra="forbid")

    sectors: list[str]
    stage_focus: list[StartupStage]
    types: list[InvestorType]


__all__ = [
    "InvestorDirectoryDetail",
    "InvestorDirectoryFacets",
    "InvestorDirectoryItem",
    "InvestorDirectoryPage",
    "InvestorDirectorySummary",
]
