"""Startup discovery schemas (Step 5h).

Two shapes:

- ``StartupDiscoveryItem`` — the discovery CARD. Deliberately smaller than
  ``StartupProfilePublicRead``: a list of 20 startups must not carry five
  5k-character pitch fields. Detail-field payloads stay on the detail read.
- ``StartupDiscoveryPage`` — the same limit/offset envelope as 5b/5c
  (``items``/``total``/``limit``/``offset``).

``visible_to_public`` is intentionally absent from the item (5h plan D6):
a row's presence in the list already tells the caller it was visible, and
repeating the flag per row would leak WHO the list was computed for.

Sections are ``None`` when the caller may not see them (toggle off, or the
profile is not visible to this caller at all) — never an empty string.
"""

from pydantic import BaseModel, ConfigDict

from app.models.startup import StartupStage


class StartupDiscoveryItem(BaseModel):
    """One discovery result: public identity fields + gated sections."""

    model_config = ConfigDict(extra="forbid")

    slug: str
    name: str
    tagline: str | None = None
    stage: StartupStage | None = None
    sector: str | None = None
    city: str | None = None
    founded_year: int | None = None
    website: str | None = None
    # Server-controlled badge; safe to publish (5h plan D3).
    mentor_verified: bool = False
    # Gated by readiness_public (5h plan D2).
    readiness_score: int | None = None
    # Gated by summary_public / traction_public (5a convention).
    summary: str | None = None
    traction_summary: str | None = None


class StartupDiscoveryPage(BaseModel):
    """Paginated discovery envelope (limit/offset, same shape as 5b/5c)."""

    model_config = ConfigDict(extra="forbid")

    items: list[StartupDiscoveryItem]
    total: int
    limit: int
    offset: int
