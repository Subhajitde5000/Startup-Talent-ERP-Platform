"""Mentor directory schemas (Step 8a).

Three shapes, following the 5h discovery convention:

- ``MentorDirectoryItem`` — the directory CARD. Deliberately smaller than the
  detail read: a list of 20 mentors must not carry 5,000-character bios.
- ``MentorDirectoryDetail`` — one mentor's full page.
- ``MentorDirectoryPage`` — the same limit/offset envelope as 5b/5c
  (``items``/``total``/``limit``/``offset``).

Everything here is READ-ONLY (8a has no write endpoint), so every field is
server-owned and absent from any input schema. ``is_verified``, ``rating``
and ``sessions_completed`` are published as read-only facts: they are
computed elsewhere (admin verification, 8i rating recompute) and a client
can never set them — proven by the fact that this module defines no input
model at all.

``reviews_count`` is intentionally ABSENT. A review count belongs to 8i
(``session_reviews``); until then the directory shows ``rating`` and
``sessions_completed`` only rather than deriving a plausible-looking number
(8a plan D-3).

``match_reasons`` is only populated by the suggestions read, and each string
is generated from a field that genuinely matched (8a plan D-2) — it is never
a stored score.
"""

from pydantic import BaseModel, ConfigDict

from app.models.startup import StartupStage


class MentorDirectoryItem(BaseModel):
    """One mentor card: identity + the fields the card renders."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    # Public handle is the directory key (never the user UUID): the frontend
    # routes on /startup/mentors/find/[mentorId], and an opaque UUID would
    # both leak an internal id and make the URL unshareable.
    handle: str
    display_name: str
    avatar_initials: str | None = None
    avatar_url: str | None = None
    headline: str | None = None
    expertise: list[str] = []
    sectors: list[str] = []
    languages: list[str] = []
    years_experience: int | None = None
    hourly_fee: float | None = None
    currency: str = "INR"
    cadence: str | None = None
    rating: float | None = None
    sessions_completed: int = 0
    is_verified: bool = False
    accepting_requests: bool = True
    # users.region holds the mentor's own location text ("Bengaluru, India").
    location: str | None = None


class MentorSuggestionItem(MentorDirectoryItem):
    """A card plus WHY it was suggested (8a plan D-2).

    ``match_reasons`` entries are generated from fields that actually
    matched, e.g. ``"Expertise: Fundraising"`` or ``"Same sector: fintech"``.
    An empty list means the mentor surfaced on the default ordering only —
    which is stated rather than filled with invented copy.
    """

    match_reasons: list[str] = []


class MentorDirectoryDetail(MentorDirectoryItem):
    """One mentor's full page: the card plus the long-form fields."""

    bio: str | None = None
    max_startups: int = 3


class MentorDirectoryPage(BaseModel):
    """Paginated directory envelope (limit/offset, same shape as 5b/5c)."""

    model_config = ConfigDict(extra="forbid")

    items: list[MentorDirectoryItem]
    total: int
    limit: int
    offset: int


class MentorSuggestionPage(BaseModel):
    """Paginated suggestions envelope. Implies the current stage in ``stage``."""

    model_config = ConfigDict(extra="forbid")

    items: list[MentorSuggestionItem]
    total: int
    limit: int
    offset: int
    # The startup's stage, echoed so the frontend can caption the list
    # ("Matched to your Prototype stage") without a second request.
    stage: StartupStage | None = None
    sector: str | None = None
    # 8a plan D-1: stage is NOT yet a stored mentor attribute, so the caller
    # must know the caption is not a filtered match. Stated, not faked.
    stage_filter_applied: bool = False
