"""Audit/activity log (Step 3d item 8; schema.sql section "activity_events").

Appendix-only log for sensitive organization actions. Written by
``activity_service.record()`` inside the SAME transaction as the action it
describes, so an audit row can never exist without its change (or the
reverse).

Deviations from schema.sql (documented, follow the existing policy):
- ``id`` stays a bigint identity on PostgreSQL (append-only log table,
  AGENTS.md section 6) but degrades to INTEGER on SQLite, which only
  autoincrements an INTEGER PRIMARY KEY — same treatment as
  ``login_attempts``. ``with_variant`` keeps the production type correct.
- ``metadata`` is a JSON column (schema.sql uses jsonb); SQLite has no
  jsonb, and the 5a-5l JSON-list columns already follow this rule.
- No ``updated_at``: the table is insert-only by design, so a mutation
  timestamp would be dead weight. This matches schema.sql.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ActivityEventType(enum.StrEnum):
    """The team actions Step 3d item 8 requires an audit row for.

    A fixed vocabulary (AGENTS.md section 6) so a typo cannot silently
    invent a new event category. Later steps append their own members.
    """

    application_submitted = "application_submitted"
    application_withdrawn = "application_withdrawn"
    application_stage_changed = "application_stage_changed"
    application_assigned = "application_assigned"
    application_note_created = "application_note_created"
    application_note_deleted = "application_note_deleted"
    application_resume_downloaded = "application_resume_downloaded"
    job_review_settings_changed = "job_review_settings_changed"
    job_created = "job_created"
    job_updated = "job_updated"
    job_published = "job_published"
    job_paused = "job_paused"
    job_closed = "job_closed"
    job_archived = "job_archived"
    # Step 7e: template lifecycle and per-applicant scoring.
    scorecard_created = "scorecard_created"
    scorecard_updated = "scorecard_updated"
    scorecard_deleted = "scorecard_deleted"
    application_scores_submitted = "application_scores_submitted"
    # Step 7f: interview lifecycle and panel feedback.
    interview_scheduled = "interview_scheduled"
    interview_rescheduled = "interview_rescheduled"
    interview_cancelled = "interview_cancelled"
    interview_completed = "interview_completed"
    interview_feedback_submitted = "interview_feedback_submitted"

    data_room_changed = "data_room_changed"
    data_room_access_changed = "data_room_access_changed"
    data_room_nda_accepted = "data_room_nda_accepted"

    file_attachment_changed = "file_attachment_changed"
    file_upload_requested = "file_upload_requested"
    file_confirmed = "file_confirmed"
    file_processed = "file_processed"
    file_deleted = "file_deleted"
    file_expired = "file_expired"
    file_purged = "file_purged"

    role_changed = "role_changed"
    member_deactivated = "member_deactivated"
    member_reactivated = "member_reactivated"
    member_removed = "member_removed"
    ownership_transferred = "ownership_transferred"
    invite_created = "invite_created"
    invite_resent = "invite_resent"
    invite_revoked = "invite_revoked"
    # Step 5d (approved D-9b): comments are user content an admin may
    # delete, so creation and deletion get an audit row. Editing is left
    # out deliberately — the edited flag is visible on the comment itself
    # (updated_at > created_at) and every edit would double the feed.
    task_commented = "task_commented"
    task_comment_deleted = "task_comment_deleted"
    # Step 8b: a mentorship request is user content both sides act on, so
    # creation and the accept/decline answer get an audit row (same
    # D-9b "create/delete of user content" rule, applied to a new pair).
    mentorship_requested = "mentorship_requested"
    mentorship_accepted = "mentorship_accepted"
    mentorship_declined = "mentorship_declined"
    mentorship_ended = "mentorship_ended"
    # Step 8e: a deliverable is user content the mentor creates and deletes,
    # and the assignee submits — the same create/delete audit rule (D-9b).
    deliverable_created = "deliverable_created"
    deliverable_submitted = "deliverable_submitted"
    deliverable_reviewed = "deliverable_reviewed"
    deliverable_deleted = "deliverable_deleted"
    # Step 8f: mentor sign-off on a readiness item grants a startup real
    # credibility, so both the grant and the revoke are audited.
    readiness_mentor_signed_off = "readiness_mentor_signed_off"
    readiness_mentor_revoked = "readiness_mentor_revoked"
    # Step 9a: a round is financial data the startup's members create,
    # edit, re-status and delete, so every one of those is audited in the
    # same transaction (D11).
    round_created = "round_created"
    round_updated = "round_updated"
    round_status_changed = "round_status_changed"
    round_deleted = "round_deleted"
    # Step 9d: saved searches and shortlist entries are user content the
    # investor creates and deletes (the D-9b create/delete rule); the
    # deal family in 9e adds update/stage events because deals are
    # financial data.
    saved_search_created = "saved_search_created"
    saved_search_deleted = "saved_search_deleted"
    shortlist_added = "shortlist_added"
    shortlist_removed = "shortlist_removed"
    # Step 9e: a deal is the investor's private pipeline data, so every
    # mutation is audited in the same transaction as the write.
    deal_created = "deal_created"
    deal_updated = "deal_updated"
    deal_stage_changed = "deal_stage_changed"
    deal_deleted = "deal_deleted"
    # Step 9i: an offer is financial data both sides act on, so every
    # version action is audited in the same transaction as the write.
    offer_created = "offer_created"
    offer_updated = "offer_updated"
    offer_sent = "offer_sent"
    offer_countered = "offer_countered"
    offer_accepted = "offer_accepted"
    offer_declined = "offer_declined"
    offer_withdrawn = "offer_withdrawn"
    offer_expired = "offer_expired"
    # Step 9j: commitments and holdings are financial records the
    # investor manages, so every mutation is audited in the same
    # transaction as the write.
    commitment_created = "commitment_created"
    commitment_updated = "commitment_updated"
    commitment_status_changed = "commitment_status_changed"
    holding_created = "holding_created"
    holding_updated = "holding_updated"
    holding_status_changed = "holding_status_changed"
    # Step 9f — engagement requests and meetings.
    engagement_request_created = "engagement_request_created"
    engagement_request_updated = "engagement_request_updated"
    engagement_request_accepted = "engagement_request_accepted"
    engagement_request_declined = "engagement_request_declined"
    engagement_request_withdrawn = "engagement_request_withdrawn"
    engagement_request_expired = "engagement_request_expired"
    meeting_created = "meeting_created"
    meeting_updated = "meeting_updated"
    meeting_status_changed = "meeting_status_changed"
    # Step 9k — diligence checklists and items.
    diligence_checklist_created = "diligence_checklist_created"
    diligence_checklist_updated = "diligence_checklist_updated"
    diligence_item_created = "diligence_item_created"
    diligence_item_updated = "diligence_item_updated"
    diligence_item_deleted = "diligence_item_deleted"


class ActivityEvent(Base):
    __tablename__ = "activity_events"

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    # nullable: an event may belong to the platform rather than an org
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
    )
    # SET NULL keeps the audit trail when a user account is deleted; the
    # summary text still says what happened.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    link_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    data: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        # Both feed a reverse-chronological feed ("what happened in this
        # org", "what did this person do") — schema.sql has the same two.
        Index("activity_events_org_idx", "org_id", created_at.desc()),
        Index("activity_events_user_idx", "user_id", created_at.desc()),
    )
