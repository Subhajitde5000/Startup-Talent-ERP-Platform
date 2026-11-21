"""Safe investor-firm identity returned to startup members (Step 9b)."""
import uuid

from pydantic import BaseModel, ConfigDict


class InvestorDirectoryItem(BaseModel):
    """Only organization public-profile fields; no preferences or team data."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    name: str
    slug: str
    summary: str | None
    logo_url: str | None
    logo_initials: str | None
    website: str | None
    city: str | None
    region: str | None
    country: str | None
    founded_year: int | None
    verified: bool


class InvestorDirectoryPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[InvestorDirectoryItem]
    total: int
    limit: int
    offset: int
