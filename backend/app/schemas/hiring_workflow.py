"""Strict 7f–7h commands and audience-separated reads. No free-form status updates."""

import uuid
from datetime import UTC, date, datetime
from typing import Annotated, Any, Literal, Self

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.models.job import SalaryPeriod
from app.models.organization import Department
from app.schemas.job import Equity, Money
from app.schemas.scorecard import required_text

Name = Annotated[
    str, Field(strict=True, max_length=200), AfterValidator(lambda v: required_text(v, 200))
]
Text1000 = Annotated[
    str, Field(strict=True, max_length=1000), AfterValidator(lambda v: required_text(v, 1000))
]
Text500 = Annotated[
    str, Field(strict=True, max_length=500), AfterValidator(lambda v: required_text(v, 500))
]
InterviewStatus = Literal["scheduled", "confirmed", "completed", "cancelled", "no_show"]
InterviewView = Literal["upcoming", "past", "needs_feedback", "needs_action"]
InterviewFormat = Literal["video", "phone", "onsite", "async"]
Attendance = Literal["accepted", "declined", "tentative"]
Recommendation = Literal["strong_yes", "yes", "no", "strong_no"]
OfferStatus = Literal["draft", "sent", "countered", "accepted", "declined", "expired", "withdrawn"]
HireStatus = Literal["pending_onboarding", "onboarding", "active", "no_show", "cancelled"]
TaskStatus = Literal["pending", "in_progress", "done", "blocked", "waived"]
DocStatus = Literal["requested", "received", "verified", "rejected", "expired"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("*", mode="after")
    @classmethod
    def utc_timestamps(cls, value: Any) -> Any:
        # SQLite fixtures lose offsets; PostgreSQL persists timestamptz. Emit one contract.
        if isinstance(value, datetime):
            return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
        return value


class Expected(Strict):
    expected_version: int = Field(strict=True, ge=1)


class Page(Strict):
    total: int
    limit: int
    offset: int
    has_more: bool


class ParticipantInput(Strict):
    user_id: uuid.UUID
    side: Literal["interviewer", "observer"] = "interviewer"


class ParticipantSet(Strict):
    participants: list[ParticipantInput] = Field(min_length=1, max_length=10)

    @field_validator("participants")
    @classmethod
    def distinct(cls, values: list[ParticipantInput]) -> list[ParticipantInput]:
        if len({v.user_id for v in values}) != len(values) or not any(
            v.side == "interviewer" for v in values
        ):
            raise ValueError("Select distinct participants and at least one interviewer.")
        return values


class InterviewFields(Strict):
    round_name: Name
    format: InterviewFormat = "video"
    scheduled_at: AwareDatetime
    duration_min: int = Field(default=45, strict=True, ge=5, le=480)
    location: str | None = Field(default=None, max_length=500, strict=True)
    meeting_url: str | None = Field(default=None, max_length=2000, strict=True)

    @field_validator("meeting_url")
    @classmethod
    def safe_url(cls, value: str | None) -> str | None:
        if value is not None:
            from urllib.parse import urlsplit

            parsed = urlsplit(value)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.username
                or parsed.password
            ):
                raise ValueError("Use an HTTPS meeting URL without embedded credentials.")
        return value


class InterviewCreate(InterviewFields, ParticipantSet):
    application_id: uuid.UUID
    request_id: uuid.UUID


class InterviewPatch(InterviewFields, Expected):
    pass


class ParticipantsPut(ParticipantSet, Expected):
    pass


class InterviewTransition(Expected):
    action: Literal["cancel", "complete", "no_show"]
    reason: Text1000 | None = None


class AttendancePut(Expected):
    response: Attendance


class FeedbackPut(Strict):
    recommendation: Recommendation
    summary: Annotated[
        str, Field(strict=True, max_length=5000), AfterValidator(lambda v: required_text(v, 5000))
    ]


class ParticipantRead(Strict):
    user_id: uuid.UUID | None
    display_name: str
    side: str
    response: Attendance | None
    responded_at: datetime | None


class InterviewRead(Strict):
    company_name: str
    can_manage: bool = False
    id: uuid.UUID
    application_id: uuid.UUID
    applicant_label: str
    job_title: str
    round_name: str
    format: InterviewFormat
    status: InterviewStatus
    scheduled_at: datetime
    duration_min: int
    location: str | None
    meeting_url: str | None
    cancelled_reason: str | None
    version: int
    participants: list[ParticipantRead]
    created_at: datetime
    updated_at: datetime


class InterviewPage(Page):
    items: list[InterviewRead]


class FeedbackRead(FeedbackPut):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    author_id: uuid.UUID | None
    submitted_at: datetime
    updated_at: datetime


class FeedbackPage(Page):
    items: list[FeedbackRead]


class OfferTerms(Strict):
    title: Name
    base_salary: Money = Field(gt=0)
    bonus_amount: Money | None = None
    equity_pct: Equity | None = None
    joining_bonus: Money | None = None
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")
    salary_period: SalaryPeriod = SalaryPeriod.annual
    start_date: date
    expires_on: date
    payment_terms: str | None = Field(default=None, max_length=2000, strict=True)
    bonus_terms: str | None = Field(default=None, max_length=2000, strict=True)
    probation_terms: str | None = Field(default=None, max_length=2000, strict=True)
    notice_terms: str | None = Field(default=None, max_length=2000, strict=True)
    vesting_terms: str | None = Field(default=None, max_length=2000, strict=True)
    exercise_price_terms: str | None = Field(default=None, max_length=2000, strict=True)
    joining_bonus_terms: str | None = Field(default=None, max_length=2000, strict=True)

    @field_validator("base_salary", "bonus_amount", "equity_pct", "joining_bonus", mode="before")
    @classmethod
    def no_float(cls, value: Any) -> Any:
        if isinstance(value, (float, bool)):
            raise ValueError("Use decimal strings or integers, not floats or booleans.")
        return value

    @model_validator(mode="after")
    def dates(self) -> Self:
        if self.expires_on >= self.start_date:
            raise ValueError("Expiry must be before the start date.")
        return self


class OfferCreate(OfferTerms):
    application_id: uuid.UUID
    request_id: uuid.UUID
    document_file_id: uuid.UUID | None = None


class OfferPatch(OfferTerms, Expected):
    document_file_id: uuid.UUID | None = None


class OfferRevision(OfferTerms, Expected):
    request_id: uuid.UUID
    document_file_id: uuid.UUID | None = None


class ApprovalRequest(Expected):
    approver_ids: list[uuid.UUID] = Field(min_length=1, max_length=5)

    @field_validator("approver_ids")
    @classmethod
    def distinct(cls, values: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(set(values)) != len(values):
            raise ValueError("Approvers must be distinct.")
        return values


class ApprovalDecision(Expected):
    decision: Literal["approved", "rejected"]
    note: Text1000 | None = None


class OfferResponse(Expected):
    action: Literal["accept", "decline"]
    decline_reason_id: uuid.UUID | None = None
    decline_detail: (
        Annotated[
            str, Field(strict=True, max_length=500), AfterValidator(lambda v: required_text(v, 500))
        ]
        | None
    ) = None
    share_decline_reason: bool = Field(default=False, strict=True)

    @model_validator(mode="after")
    def valid_reason(self) -> Self:
        if self.action == "accept" and (
            self.decline_reason_id or self.decline_detail or self.share_decline_reason
        ):
            raise ValueError("Decline fields are not accepted when accepting.")
        if (self.decline_reason_id or self.decline_detail) and not self.share_decline_reason:
            raise ValueError("Sharing a decline reason requires explicit consent.")
        return self


class OfferCounter(Expected):
    note: Text500


class OfferSnapshot(Strict):
    id: uuid.UUID
    org_id: uuid.UUID
    title: str
    company_name: str
    location: str | None
    work_mode: str
    employment_type: str
    benefits: list[str]


class OfferRead(OfferTerms):
    id: uuid.UUID
    application_id: uuid.UUID
    status: OfferStatus
    version: int
    terms_version: int
    parent_offer_id: uuid.UUID | None
    job_snapshot: OfferSnapshot
    document_available: bool
    sent_at: datetime | None
    responded_at: datetime | None
    counter_note: str | None
    decline_reason_id: uuid.UUID | None
    decline_detail: str | None
    superseded_at: datetime | None
    created_at: datetime
    updated_at: datetime


class StaffOfferRead(OfferRead):
    applicant_label: str
    pipeline_writable: bool
    owner_id: uuid.UUID | None
    created_by: uuid.UUID | None
    submitted_at: datetime | None


class OfferPage(Page):
    items: list[OfferRead]


class StaffOfferPage(Page):
    items: list[StaffOfferRead]


class ApprovalRead(Strict):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    approver_id: uuid.UUID | None
    status: str
    note: str | None
    decided_at: datetime | None


class ApprovalPage(Page):
    items: list[ApprovalRead]


class DeclineReasonRead(Strict):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    code: str
    label: str


class DeclineReasonPage(Page):
    items: list[DeclineReasonRead]


class TemplateItemInput(Strict):
    section: Annotated[
        str, Field(strict=True, max_length=100), AfterValidator(lambda v: required_text(v, 100))
    ]
    title: Name
    owner_role: Literal["owner", "manager"] | None = None
    due_offset_days: int = Field(default=0, strict=True, ge=-365, le=365)


class OnboardingTemplateInput(Strict):
    name: Name
    items: list[TemplateItemInput] = Field(max_length=50)


class TemplateItemRead(TemplateItemInput):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    display_order: int


class OnboardingTemplateRead(Strict):
    id: uuid.UUID
    name: str
    items: list[TemplateItemRead]
    created_at: datetime
    updated_at: datetime


class TemplatePage(Page):
    items: list[OnboardingTemplateRead]


class HireCreate(Strict):
    offer_id: uuid.UUID
    template_id: uuid.UUID | None = None
    department: Department | None = None
    manager_id: uuid.UUID | None = None
    owner_id: uuid.UUID | None = None


class HirePatch(Expected):
    start_date: date | None = None
    manager_id: uuid.UUID | None = None
    owner_id: uuid.UUID | None = None


class HireTransition(Expected):
    action: Literal["onboard", "activate", "no_show", "cancel"]


class HireRead(Strict):
    job_id: uuid.UUID
    job_title: str
    can_edit: bool
    can_manage_tasks: bool
    can_access_documents: bool
    id: uuid.UUID
    application_id: uuid.UUID
    offer_id: uuid.UUID
    applicant_label: str
    department: Department | None
    manager_id: uuid.UUID | None
    owner_id: uuid.UUID | None
    start_date: date
    status: HireStatus
    version: int
    completed_items: int
    total_items: int
    created_at: datetime
    updated_at: datetime


class HirePage(Page):
    items: list[HireRead]


class TaskPatch(Expected):
    status: TaskStatus | None = None
    note: str | None = Field(default=None, max_length=2000, strict=True)
    owner_id: uuid.UUID | None = None
    due_on: date | None = None


class TaskRead(Strict):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    section: str
    title: str
    owner_id: uuid.UUID | None
    due_on: date
    status: TaskStatus
    note: str | None
    version: int


class TaskPage(Page):
    items: list[TaskRead]


class DocumentCreate(Strict):
    request_id: uuid.UUID
    name: Name
    purpose: Text1000
    retention: Text1000
    due_on: date | None = None


class DocumentPatch(Expected):
    action: Literal["attach", "verify", "reject", "expire"]
    file_id: uuid.UUID | None = None
    reason: Text1000 | None = None

    @model_validator(mode="after")
    def valid(self) -> Self:
        if (self.action == "attach") != (self.file_id is not None):
            raise ValueError("Only attach accepts and requires file_id.")
        if self.action == "reject" and not self.reason:
            raise ValueError("Rejection requires a reason.")
        return self


class DocumentRead(Strict):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    name: str
    purpose: str
    retention: str
    status: DocStatus
    due_on: date | None
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    review_reason: str | None
    version: int


class DocumentPage(Page):
    items: list[DocumentRead]
