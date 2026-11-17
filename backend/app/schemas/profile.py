"""Profile, readiness, skills and data-request schemas (Step 3a).

Conventions (AGENTS.md section 5): PATCH-only writes, no partial-update
semantics on Create/Read, server-owned fields (status, roles, verification,
ratings, ids, timestamps) are ABSENT from UserUpdate so they cannot be
mass-assigned — extra="forbid" turns any attempt into a 422.
"""

import re
import uuid
from datetime import datetime
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.profile import CasePriority, DataRequestStatus, DataRequestType
from app.schemas.auth import UserRead

HANDLE_RE = r"^[a-z0-9_]{3,30}$"
LOCALE_RE = r"^[a-z]{2,3}(-[A-Za-z]{2,4})?$"
MAX_URL_LENGTH = 500

# Free handles that must never be claimed by a user (Step 3 plan, item 8).
RESERVED_HANDLES: frozenset[str] = frozenset(
    {
        "admin", "administrator", "root", "superuser", "staff", "moderator",
        "official", "system", "support", "help", "api", "graphql", "webhooks",
        "auth", "login", "logout", "signup", "register", "signin", "settings",
        "security", "privacy", "terms", "legal", "about", "contact",
        "careers", "pricing", "billing", "invoice", "payment", "payments",
        "checkout", "refund", "helpcenter", "status", "blog", "news", "press",
        "community", "forum", "feedback", "beta", "test", "demo", "sandbox",
        "me", "you", "user", "users", "profile", "profiles", "account",
        "accounts", "dashboard", "home", "index", "static", "assets", "public",
        "private", "internal", "forma", "startup", "talent", "mentor",
        "mentorship", "founder", "founders", "employer", "employerbrand",
        "investor", "investors", "job", "jobs", "internship", "internships",
        "resume", "cv", "practice", "readiness", "otp", "verify", "reset",
        "forgot", "invite", "invites", "organization", "organizations", "org",
        "orgs", "team", "teams", "workspace", "adminbot", "noreply",
        "no-reply", "postmaster", "abuse", "hostmaster", "webmaster",
        "this", "that", "null", "undefined", "true", "false",
    }
)

# Fields that may be explicitly set to null only by clearing ("" is ok);
# if present-but-null they must be non-null: these columns are NOT NULL.
_NOT_NULL_WHEN_SET = (
    "display_name",
    "locale",
    "timezone",
    "profile_public",
    "allow_outreach",
)

_URL_FIELDS = ("avatar_url", "linkedin_url", "github_url", "twitter_url", "website_url")


def _clean_optional_text(v: str | None) -> str | None:
    """Strip whitespace; treat empty string as 'clear the field' (None)."""
    if v is None:
        return None
    v = v.strip()
    return v or None


def _validate_http_url(v: str | None) -> str | None:
    v = _clean_optional_text(v)
    if v is None:
        return None
    if len(v) > MAX_URL_LENGTH:
        raise ValueError(f"must be at most {MAX_URL_LENGTH} characters")
    parts = urlsplit(v)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        raise ValueError("must be an http(s) URL starting with http:// or https://")
    return v


class UserUpdate(BaseModel):
    """Mutable public profile fields for the profile edit page (PATCH /users/me).

    Email change, password, 2FA, roles and account status live elsewhere and
    are deliberately not patchable here.
    """

    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, max_length=160)
    handle: str | None = Field(default=None, max_length=64)
    avatar_url: str | None = Field(default=None, max_length=MAX_URL_LENGTH)
    avatar_initials: str | None = Field(default=None, max_length=3)
    phone: str | None = Field(default=None, max_length=32)
    locale: str | None = Field(default=None, max_length=16)
    timezone: str | None = Field(default=None, max_length=64)
    region: str | None = Field(default=None, max_length=64)
    onboarding_step: str | None = Field(default=None, max_length=64)
    linkedin_url: str | None = Field(default=None, max_length=MAX_URL_LENGTH)
    github_url: str | None = Field(default=None, max_length=MAX_URL_LENGTH)
    twitter_url: str | None = Field(default=None, max_length=MAX_URL_LENGTH)
    website_url: str | None = Field(default=None, max_length=MAX_URL_LENGTH)
    headline: str | None = Field(default=None, max_length=160)
    bio: str | None = Field(default=None, max_length=5000)
    education: str | None = Field(default=None, max_length=500)
    prior_role: str | None = Field(default=None, max_length=500)
    founder_vision: str | None = Field(default=None, max_length=5000)
    din_number: str | None = Field(default=None, max_length=64)
    profile_public: bool | None = None
    allow_outreach: bool | None = None

    @field_validator(
        "display_name",
        "avatar_initials",
        "phone",
        "region",
        "onboarding_step",
        "headline",
        "bio",
        "education",
        "prior_role",
        "founder_vision",
        "din_number",
    )
    @classmethod
    def _optional_text(cls, v: str | None) -> str | None:
        return _clean_optional_text(v)

    @field_validator("handle")
    @classmethod
    def _handle(cls, v: str | None) -> str | None:
        v = _clean_optional_text(v)
        if v is None:
            return None
        v = v.lower()  # handles are stored lowercase (citext-style)
        if v in RESERVED_HANDLES:
            raise ValueError("this handle is reserved")
        if not re.match(HANDLE_RE, v):
            raise ValueError(
                "must be 3-30 characters: lowercase letters, digits, underscores"
            )
        return v

    @field_validator("locale")
    @classmethod
    def _locale(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if v and not re.match(LOCALE_RE, v):
            raise ValueError("must be a locale like 'en' or 'en-IN'")
        return v or None

    @field_validator("timezone")
    @classmethod
    def _timezone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, ValueError, KeyError):
            raise ValueError("must be an IANA timezone like 'Asia/Kolkata'") from None
        return v

    @field_validator(*_URL_FIELDS)
    @classmethod
    def _urls(cls, v: str | None) -> str | None:
        return _validate_http_url(v)

    @model_validator(mode="after")
    def _not_null_when_set(self) -> "UserUpdate":
        for name in _NOT_NULL_WHEN_SET:
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class ReadinessRead(BaseModel):
    """Computed readiness scores (0-100). resume/practice stay 0 until
    Step 4 (resume scan) and Step 5 (practice) land."""

    model_config = ConfigDict(extra="forbid")

    profile_complete: int = Field(ge=0, le=100)
    resume_score: int = Field(ge=0, le=100)
    practice_score: int = Field(ge=0, le=100)
    overall_score: int = Field(ge=0, le=100)


class SkillRead(BaseModel):
    """One searchable skill (read-only; creation is admin-only, Step 7)."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    name: str
    category: str | None = None


class DeleteRequestRead(BaseModel):
    """A self-service data (erasure) request as seen by its owner."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    request_type: DataRequestType
    status: DataRequestStatus
    priority: CasePriority
    received_at: datetime
    due_at: datetime
    fulfilled_at: datetime | None = None


class UserMeRead(UserRead):
    """GET /users/me: the full self view (Step 2 auth fields + Step 3a
    profile fields). Never contains password hashes or token material."""

    model_config = ConfigDict(extra="forbid")

    handle: str | None = None
    avatar_url: str | None = None
    avatar_initials: str | None = None
    phone: str | None = None
    locale: str = "en-IN"
    timezone: str = "Asia/Kolkata"
    region: str | None = None
    onboarding_step: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    twitter_url: str | None = None
    website_url: str | None = None
    headline: str | None = None
    bio: str | None = None
    education: str | None = None
    prior_role: str | None = None
    founder_vision: str | None = None
    din_number: str | None = None
    profile_public: bool = True
    allow_outreach: bool = True


# --- Step 3c: talent & mentor profiles -------------------------------------


def _string_list(v: list[str] | None, *, max_items: int, max_len: int) -> list[str] | None:
    if v is None:
        return None
    if len(v) > max_items:
        raise ValueError(f"must contain at most {max_items} items")
    cleaned: list[str] = []
    for item in v:
        text = item.strip()
        if not text:
            raise ValueError("items must not be blank")
        if len(text) > max_len:
            raise ValueError(f"items must be at most {max_len} characters")
        cleaned.append(text)
    # de-dup case-insensitively, preserving order
    seen: set[str] = set()
    out: list[str] = []
    for text in cleaned:
        key = text.lower()
        if key not in seen:
            seen.add(key)
            out.append(text)
    return out


def _currency(v: str | None) -> str | None:
    if v is None:
        return None
    code = v.strip().upper()
    if len(code) != 3 or not code.isalpha():
        raise ValueError("must be a 3-letter ISO currency code")
    return code


class TalentProfileUpdate(BaseModel):
    """PATCH /talent-profile/me. `skills` is a replace-set of skill NAMES
    (unknown names are created in the lookup table). Server-owned fields
    (resume_id, timestamps) are absent."""

    model_config = ConfigDict(extra="forbid")

    headline: str | None = Field(default=None, max_length=300)
    summary: str | None = Field(default=None, max_length=10000)
    total_experience_yrs: float | None = Field(default=None, ge=0, le=99.9)
    current_location: str | None = Field(default=None, max_length=200)
    preferred_mode: str | None = None
    availability: str | None = None
    salary_expectation: float | None = Field(default=None, ge=0)
    currency: str | None = None
    open_to_relocate: bool | None = None
    is_searchable: bool | None = None
    hide_current_employer: bool | None = None
    skills: list[str] | None = None

    @field_validator("preferred_mode")
    @classmethod
    def _mode(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if v not in ("onsite", "hybrid", "remote"):
            raise ValueError("must be one of: onsite, hybrid, remote")
        return v

    @field_validator("availability")
    @classmethod
    def _availability(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if v not in ("immediate", "two_weeks", "one_month", "flexible", "not_looking"):
            raise ValueError(
                "must be one of: immediate, two_weeks, one_month, flexible, not_looking"
            )
        return v

    @field_validator("currency")
    @classmethod
    def _cur(cls, v: str | None) -> str | None:
        return _currency(v)

    @field_validator("skills")
    @classmethod
    def _skills(cls, v: list[str] | None) -> list[str] | None:
        return _string_list(v, max_items=50, max_len=80)

    @field_validator("headline", "summary", "current_location")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned or None


class TalentProfileRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: uuid.UUID
    headline: str | None = None
    summary: str | None = None
    total_experience_yrs: float | None = None
    current_location: str | None = None
    preferred_mode: str | None = None
    availability: str = "flexible"
    salary_expectation: float | None = None
    currency: str = "INR"
    open_to_relocate: bool = False
    is_searchable: bool = True
    hide_current_employer: bool = False
    skills: list[SkillRead] = []
    created_at: datetime
    updated_at: datetime


class TalentPublicRead(BaseModel):
    """Public vs private (part 9): served only when is_searchable AND the
    owner's users.profile_public flag is on; otherwise 404."""

    model_config = ConfigDict(extra="forbid")

    handle: str
    display_name: str
    avatar_initials: str | None = None
    avatar_url: str | None = None
    headline: str | None = None
    summary: str | None = None
    current_location: str | None = None
    preferred_mode: str | None = None
    availability: str = "flexible"
    skills: list[str] = []


class MentorProfileUpdate(BaseModel):
    """PATCH /mentor-profile/me. rating/sessions_completed/is_verified are
    server-owned (Steps 8/15) and absent."""

    model_config = ConfigDict(extra="forbid")

    headline: str | None = Field(default=None, max_length=300)
    bio: str | None = Field(default=None, max_length=10000)
    expertise: list[str] | None = None
    sectors: list[str] | None = None
    languages: list[str] | None = None
    years_experience: int | None = Field(default=None, ge=0, le=80)
    hourly_fee: float | None = Field(default=None, ge=0)
    currency: str | None = None
    cadence: str | None = Field(default=None, max_length=300)
    max_startups: int | None = Field(default=None, ge=1, le=100)
    accepting_requests: bool | None = None

    @field_validator("expertise", "sectors", "languages")
    @classmethod
    def _lists(cls, v: list[str] | None) -> list[str] | None:
        return _string_list(v, max_items=30, max_len=120)

    @field_validator("currency")
    @classmethod
    def _cur(cls, v: str | None) -> str | None:
        return _currency(v)

    @field_validator("headline", "bio", "cadence")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned or None


class MentorProfileRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: uuid.UUID
    headline: str | None = None
    bio: str | None = None
    expertise: list[str] = []
    sectors: list[str] = []
    languages: list[str] = []
    years_experience: int | None = None
    hourly_fee: float | None = None
    currency: str = "INR"
    cadence: str | None = None
    max_startups: int = 3
    accepting_requests: bool = True
    rating: float | None = None
    sessions_completed: int = 0
    is_verified: bool = False
    created_at: datetime
    updated_at: datetime


class MentorPublicRead(BaseModel):
    """Public mentor directory shape (part 9); hidden unless the owner's
    users.profile_public flag is on."""

    model_config = ConfigDict(extra="forbid")

    handle: str
    display_name: str
    avatar_initials: str | None = None
    avatar_url: str | None = None
    headline: str | None = None
    bio: str | None = None
    expertise: list[str] = []
    sectors: list[str] = []
    languages: list[str] = []
    years_experience: int | None = None
    hourly_fee: float | None = None
    currency: str = "INR"
    cadence: str | None = None
    max_startups: int = 3
    accepting_requests: bool = True
    rating: float | None = None
    sessions_completed: int = 0
    is_verified: bool = False


# --- Step 3 part 8: notification preferences stub ---------------------------


class NotificationPreferenceItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: str = Field(min_length=1, max_length=80)
    channel: str
    is_enabled: bool

    @field_validator("channel")
    @classmethod
    def _channel(cls, v: str) -> str:
        if v not in ("in_app", "email", "push"):
            raise ValueError("must be one of: in_app, email, push")
        return v

    @field_validator("category")
    @classmethod
    def _category(cls, v: str) -> str:
        cleaned = v.strip().lower().replace(" ", "_")
        if not cleaned or len(cleaned) > 80:
            raise ValueError("category must be 1-80 chars")
        if not all(ch.isalnum() or ch in "_-" for ch in cleaned):
            raise ValueError("category may only contain letters, digits, _ and -")
        return cleaned


class NotificationPreferenceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[NotificationPreferenceItem] = Field(min_length=1, max_length=200)


class NotificationPreferenceRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[NotificationPreferenceItem] = []
