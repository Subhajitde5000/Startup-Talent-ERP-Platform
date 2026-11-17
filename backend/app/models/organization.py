"""Organization models: organizations, members, invites (schema.sql section 3).

Step 3b subset. Deviations from schema.sql (documented, for portability):
- Native ENUMs (org_type, org_role, member_status, department) -> VARCHAR +
  CHECK via Enum(native_enum=False), same as Step 2/3a.
- citext columns -> VARCHAR; the slug unique index lowercases via
  func.lower() so it behaves like citext on both PostgreSQL and SQLite.
- organization_invites gains updated_at (AGENTS.md section 6 requires it;
  schema.sql only has created_at there).
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OrgType(enum.StrEnum):
    startup = "startup"
    employer = "employer"
    investor_firm = "investor_firm"
    agency = "agency"
    other = "other"


class OrgRole(enum.StrEnum):
    owner = "owner"
    admin = "admin"
    member = "member"
    viewer = "viewer"


class MemberStatus(enum.StrEnum):
    invited = "invited"
    active = "active"
    deactivated = "deactivated"


class Department(enum.StrEnum):
    engineering = "engineering"
    product = "product"
    design = "design"
    sales = "sales"
    marketing = "marketing"
    operations = "operations"
    finance = "finance"
    people = "people"
    legal = "legal"
    support = "support"
    other = "other"


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[OrgType] = mapped_column(
        SAEnum(OrgType, name="org_type", native_enum=False, length=32),
        nullable=False,
    )
    # account_status subset used by Step 3; full workflow arrives later.
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="active", server_default="active"
    )
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_initials: Mapped[str | None] = mapped_column(String(3), nullable=True)
    website: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(Text, nullable=True)
    region: Mapped[str | None] = mapped_column(Text, nullable=True)
    country: Mapped[str | None] = mapped_column(
        String(2), nullable=True, default="IN", server_default="IN"
    )
    founded_year: Mapped[int | None] = mapped_column(
        nullable=True,
        info={"check": "founded_year IS NULL OR founded_year BETWEEN 1900 AND 2100"},
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "founded_year IS NULL OR (founded_year BETWEEN 1900 AND 2100)",
            name="organizations_founded_year_check",
        ),
        CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="organizations_name_check"),
        Index(
            "organizations_slug_key",
            func.lower(slug),
            unique=True,
            sqlite_where=deleted_at.is_(None),
            postgresql_where=deleted_at.is_(None),
        ),
        Index("organizations_type_idx", "type", "status"),
        Index("organizations_region_idx", "region"),
    )


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id: Mapped[uuid.UUID] = _uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[OrgRole] = mapped_column(
        SAEnum(OrgRole, name="org_role", native_enum=False, length=16),
        nullable=False,
        default=OrgRole.member,
        server_default="member",
    )
    status: Mapped[MemberStatus] = mapped_column(
        SAEnum(MemberStatus, name="member_status", native_enum=False, length=16),
        nullable=False,
        default=MemberStatus.invited,
        server_default="invited",
    )
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    department: Mapped[Department | None] = mapped_column(
        SAEnum(Department, name="department", native_enum=False, length=16),
        nullable=True,
    )
    seat_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_founder: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    invited_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    invited_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    joined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status <> 'active' OR joined_at IS NOT NULL",
            name="org_members_active_needs_join",
        ),
        Index(
            "org_members_unique_user",
            "org_id",
            "user_id",
            unique=True,
            sqlite_where=deleted_at.is_(None),
            postgresql_where=deleted_at.is_(None),
        ),
        Index(
            "org_members_user_idx",
            "user_id",
            sqlite_where=deleted_at.is_(None),
            postgresql_where=deleted_at.is_(None),
        ),
        Index("org_members_status_idx", "org_id", "status"),
    )


class OrganizationInvite(Base):
    __tablename__ = "organization_invites"

    id: Mapped[uuid.UUID] = _uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    role: Mapped[OrgRole] = mapped_column(
        SAEnum(OrgRole, name="org_role", native_enum=False, length=16),
        nullable=False,
        default=OrgRole.member,
        server_default="member",
    )
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    department: Mapped[Department | None] = mapped_column(
        SAEnum(Department, name="department", native_enum=False, length=16),
        nullable=True,
    )
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    invited_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("org_invites_token_key", "token_hash", unique=True),
        Index(
            "org_invites_pending_idx",
            "org_id",
            "email",
            postgresql_where=accepted_at.is_(None) & revoked_at.is_(None),
            sqlite_where=accepted_at.is_(None) & revoked_at.is_(None),
        ),
    )
