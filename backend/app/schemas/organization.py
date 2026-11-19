"""Organization, member, invite and public-org schemas (Step 3b).

Conventions (AGENTS.md section 5): Create/Update/Read are separate;
server-owned fields (id, status, verified_at, timestamps, membership
state) are ABSENT from Create/Update so they cannot be mass-assigned —
extra="forbid" turns any attempt into a 422. Role escalation attempts are
also rejected structurally: MemberUpdate can never carry is_founder or
membership status, and ownership only moves through the dedicated
transfer endpoint.
"""

import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.organization import Department, OrgRole, OrgType

SLUG_RE = r"^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$"


# Shared with the Step 5a startup-profile schemas (single implementation).
from app.schemas.common import clean_text as _clean_text  # noqa: E402


class OrganizationCreate(BaseModel):
    """Create an organization. `type` maps to the caller's role (checked
    in the service): startup -> startup role, employer -> employer,
    investor_firm -> investor."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    type: OrgType
    slug: str | None = Field(default=None, max_length=200)
    summary: str | None = Field(default=None, max_length=5000)
    website: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=200)
    region: str | None = Field(default=None, max_length=200)
    country: str | None = Field(default=None, max_length=2)
    founded_year: int | None = Field(default=None, ge=1900, le=2100)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("must not be blank")
        return cleaned

    @field_validator("slug")
    @classmethod
    def _slug_format(cls, v: str | None) -> str | None:
        if v is None:
            return None
        slug = v.strip().lower()
        if not re.fullmatch(SLUG_RE, slug):
            raise ValueError(
                "must be lowercase letters, digits and hyphens (3-200 chars)"
            )
        return slug

    @field_validator("summary")
    @classmethod
    def _summary_clean(cls, v: str | None) -> str | None:
        return _clean_text(v, 5000)

    @field_validator("website")
    @classmethod
    def _website_clean(cls, v: str | None) -> str | None:
        return _clean_text(v, 500)

    @field_validator("city", "region")
    @classmethod
    def _place_clean(cls, v: str | None) -> str | None:
        return _clean_text(v, 200)


class OrganizationUpdate(BaseModel):
    """Owner/admin patch. `type` is intentionally absent: an organization
    never changes kind (a startup does not become an employer)."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(default=None, max_length=200)
    summary: str | None = Field(default=None, max_length=5000)
    website: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=200)
    region: str | None = Field(default=None, max_length=200)
    country: str | None = Field(default=None, max_length=2)
    founded_year: int | None = Field(default=None, ge=1900, le=2100)
    logo_url: str | None = Field(default=None, max_length=500)

    @field_validator("name", "slug")
    @classmethod
    def _lower_slug_or_name(cls, v: str | None, info) -> str | None:  # noqa: ANN001
        if v is None:
            return None
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("must not be blank")
        if info.field_name == "slug":
            cleaned = cleaned.lower()
            if not re.fullmatch(SLUG_RE, cleaned):
                raise ValueError(
                    "must be lowercase letters, digits and hyphens (3-200 chars)"
                )
        return cleaned


class OrganizationRead(BaseModel):
    """Member-visible organization shape (private view): includes my_role
    for the caller. The public shape lives in OrganizationPublicRead."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    name: str
    slug: str
    type: OrgType
    status: str
    summary: str | None = None
    logo_url: str | None = None
    logo_initials: str | None = None
    website: str | None = None
    city: str | None = None
    region: str | None = None
    country: str | None = None
    founded_year: int | None = None
    verified_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    my_role: OrgRole | None = None


class OrganizationPublicRead(BaseModel):
    """Public vs private (Step 3 part 9): the unauthenticated view never
    exposes membership, status internals or timestamps beyond created."""

    model_config = ConfigDict(extra="forbid")

    name: str
    slug: str
    type: OrgType
    summary: str | None = None
    logo_url: str | None = None
    logo_initials: str | None = None
    website: str | None = None
    city: str | None = None
    region: str | None = None
    country: str | None = None
    founded_year: int | None = None
    verified: bool = False


class MemberRead(BaseModel):
    """Team-directory row. Deliberately excludes ``phone``, ``din_number``
    and every auth field: the drawer needs bio and LinkedIn, nothing more
    (Step 3d item 13 — asserted by a test)."""

    model_config = ConfigDict(extra="forbid")

    user_id: uuid.UUID
    display_name: str
    email: str | None = None  # member-only views; never in public schemas
    avatar_initials: str | None = None
    avatar_url: str | None = None
    role: OrgRole
    status: str
    title: str | None = None
    department: Department | None = None
    is_founder: bool = False
    is_public: bool = True
    joined_at: datetime | None = None
    # Step 5c: non-deleted tasks assigned to this member (done tasks are
    # included today — see the 5c report open question). One grouped
    # query, never client-writable.
    task_count: int = 0
    # Step 3d items 5 and 13: the drawer's "Last active" line and LinkedIn
    # link. ``linkedin_url`` is blanked for non-public members unless the
    # caller manages the team (service-side gate).
    last_active_at: datetime | None = None
    linkedin_url: str | None = None
    bio: str | None = None
    # Step 3d item 7: what THIS caller may do, so the page disables a
    # control instead of offering it and collecting a 403.
    can_manage: bool = False


class MemberPage(BaseModel):
    """Paginated member list (Step 3d item 10) — the same limit/offset
    envelope as 5b/5c/5h, so the frontend has one list shape."""

    model_config = ConfigDict(extra="forbid")

    items: list[MemberRead]
    total: int
    limit: int
    offset: int


class JoinStat(BaseModel):
    """One month of the team page's "Join trend" sparkline."""

    month: str  # YYYY-MM
    joined: int


class MemberStatusRead(BaseModel):
    """Response for deactivate/reactivate: the changed row, so the page can
    re-render without a second round trip."""

    model_config = ConfigDict(extra="forbid")

    member: MemberRead


class BulkMemberAction(BaseModel):
    """Item 4: one request, one transaction, all-or-nothing.

    ``action`` is a closed vocabulary — anything else is a 422 before the
    service runs. ``user_ids`` is capped at 50 (a bulk action is a UI
    affordance, not a migration tool).
    """

    model_config = ConfigDict(extra="forbid")

    action: Literal["deactivate", "reactivate", "remove"]
    user_ids: list[uuid.UUID] = Field(min_length=1, max_length=50)

    @field_validator("user_ids")
    @classmethod
    def _distinct(cls, v: list[uuid.UUID]) -> list[uuid.UUID]:
        # Duplicates would make "the same target twice" ambiguous in an
        # all-or-nothing batch; reject rather than silently dedupe.
        if len(set(v)) != len(v):
            raise ValueError("must not contain duplicate user ids")
        return v


class BulkMemberResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["deactivate", "reactivate", "remove"]
    affected: int
    members: list[MemberRead]


class BulkInviteRevoke(BaseModel):
    model_config = ConfigDict(extra="forbid")

    invite_ids: list[uuid.UUID] = Field(min_length=1, max_length=50)

    @field_validator("invite_ids")
    @classmethod
    def _distinct(cls, v: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(set(v)) != len(v):
            raise ValueError("must not contain duplicate invite ids")
        return v


class BulkInviteResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    revoked: int


class TeamSummary(BaseModel):
    """The three counter cards. ``open_jobs_count`` is ``None`` until Step
    7a exists: a null renders as an empty state, whereas a 0 would look
    like real data (Step 3d item 6)."""

    model_config = ConfigDict(extra="forbid")

    active_members: int
    pending_invites: int
    open_jobs_count: int | None = None
    deactivated_members: int = 0
    my_role: OrgRole


class MemberUpdate(BaseModel):
    """Owner/admin patch of a member's role/title/department/visibility.

    Ownership transfer has its own endpoint; assigning role=owner here is
    rejected unless the actor is the owner (service check) and never for
    the actor themselves (use transfer-ownership)."""

    model_config = ConfigDict(extra="forbid")

    role: OrgRole | None = None
    title: str | None = Field(default=None, max_length=200)
    department: Department | None = None
    is_public: bool | None = None


class TransferOwnership(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: uuid.UUID


class InviteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    role: OrgRole = OrgRole.member
    title: str | None = Field(default=None, max_length=200)
    department: Department | None = None
    # Step 3d item 3: the inviter's note, sent in the email. Length-capped
    # because it is free text landing in an outbound message.
    message: str | None = Field(default=None, max_length=500)
    # Carried into the new member row on accept (the toggle lives there).
    is_public: bool = True

    @field_validator("message")
    @classmethod
    def _message_clean(cls, v: str | None) -> str | None:
        return _clean_text(v, 500)

    @field_validator("role")
    @classmethod
    def _no_owner_via_invite(cls, v: OrgRole) -> OrgRole:
        if v == OrgRole.owner:
            raise ValueError(
                "cannot invite directly as owner; invite as admin, then transfer ownership"
            )
        return v


class InviteRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    org_id: uuid.UUID
    email: str
    role: OrgRole
    title: str | None = None
    department: Department | None = None
    expires_at: datetime
    accepted_at: datetime | None = None
    revoked_at: datetime | None = None
    created_at: datetime
    message: str | None = None
    is_public: bool = True
    # Present exactly once, in the create and RESEND responses: the raw
    # token is never stored, only its hash. The create/resend call also
    # emails the accept link, so the client no longer has to.
    token: str | None = None


class InvitePage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[InviteRead]
    total: int
    limit: int
    offset: int
