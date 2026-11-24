"""Strict job inputs; lifecycle, audit and archive fields are never writable."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)

from app.models.job import EmploymentType, JobStatus, JobVisibility, SalaryPeriod, WorkMode
from app.models.organization import Department
from app.schemas.common import clean_text
from app.schemas.job_screening import ScreeningQuestion

Money = Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2, allow_inf_nan=False)]
Equity = Annotated[
    Decimal, Field(ge=0, le=100, max_digits=5, decimal_places=2, allow_inf_nan=False)
]
Years = Annotated[int, Field(ge=0, le=32767, strict=True)]
JobSort = Literal["created_at", "updated_at", "posted_at", "title"]


class JobSkillInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    skill_id: uuid.UUID
    is_required: bool = Field(default=True, strict=True)


class JobSkillRead(JobSkillInput):
    name: str


class JobBenefitRead(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    label: str
    display_order: int


class _JobValidation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator(
        "title",
        "location",
        "description",
        "responsibilities",
        "requirements",
        "what_we_offer",
        mode="before",
        check_fields=False,
    )
    @classmethod
    def trim_text(cls, value: object, info) -> object:
        if not isinstance(value, str):
            return value
        maximum = 200 if info.field_name in {"title", "location"} else 10000
        return clean_text(value, maximum)

    @field_validator("currency", mode="before", check_fields=False)
    @classmethod
    def normalize_currency(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator(
        "salary_min",
        "salary_max",
        "equity_min_pct",
        "equity_max_pct",
        mode="before",
        check_fields=False,
    )
    @classmethod
    def no_float_money(cls, value: object) -> object:
        if isinstance(value, (float, bool)):
            raise ValueError("Use a decimal string or integer, not a floating-point number.")
        return value

    @field_validator("benefits", check_fields=False)
    @classmethod
    def clean_benefits(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        result = []
        for value in values:
            label = clean_text(value, 100)
            if label is None:
                raise ValueError("Benefit labels must not be blank.")
            result.append(label)
        return result

    @model_validator(mode="after")
    def validate_fields(self) -> Self:
        values = self.model_dump(exclude_unset=True)
        required = {
            "screening_questions",
            "title",
            "work_mode",
            "employment_type",
            "currency",
            "salary_period",
            "show_salary_publicly",
            "fair_hiring_confirmed",
            "visibility",
            "openings",
            "skills",
            "benefits",
        }
        if any(value is None for key, value in values.items() if key in required):
            raise ValueError("Non-nullable job fields cannot be null or blank.")
        for low, high in (
            ("salary_min", "salary_max"),
            ("equity_min_pct", "equity_max_pct"),
            ("experience_min_yrs", "experience_max_yrs"),
        ):
            if (
                values.get(low) is not None
                and values.get(high) is not None
                and values[low] > values[high]
            ):
                message = f"{high} must be greater than or equal to {low}."
                raise ValidationError.from_exception_data(
                    type(self).__name__,
                    [
                        {
                            "type": "value_error",
                            "loc": (high,),
                            "input": values[high],
                            "ctx": {"error": ValueError(message)},
                        }
                    ],
                )
        questions = values.get("screening_questions") or []
        if len({q["key"] for q in questions}) != len(questions):
            raise ValueError("Duplicate screening questions are not allowed.")
        skills = values.get("skills") or []
        if len({skill["skill_id"] for skill in skills}) != len(skills):
            raise ValueError("Duplicate skill IDs are not allowed.")
        return self


class JobCreate(_JobValidation):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    responsibilities: str | None = Field(default=None, max_length=10000)
    requirements: str | None = Field(default=None, max_length=10000)
    what_we_offer: str | None = Field(default=None, max_length=10000)
    department: Department | None = None
    location: str | None = Field(default=None, max_length=200)
    work_mode: WorkMode = WorkMode.onsite
    employment_type: EmploymentType = EmploymentType.full_time
    visibility: JobVisibility = JobVisibility.public
    salary_min: Money | None = None
    salary_max: Money | None = None
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")
    salary_period: SalaryPeriod = SalaryPeriod.annual
    show_salary_publicly: bool = Field(default=True, strict=True)
    application_deadline: AwareDatetime | None = None
    screening_questions: list[ScreeningQuestion] = Field(default_factory=list, max_length=8)
    fair_hiring_confirmed: bool = Field(default=False, strict=True)
    equity_min_pct: Equity | None = None
    equity_max_pct: Equity | None = None
    experience_min_yrs: Years | None = None
    experience_max_yrs: Years | None = None
    openings: int = Field(default=1, ge=1, le=32767, strict=True)
    owner_id: uuid.UUID | None = None
    skills: list[JobSkillInput] = Field(default_factory=list, max_length=30)
    benefits: list[Annotated[str, Field(max_length=100)]] = Field(
        default_factory=list, max_length=30
    )


class JobUpdate(_JobValidation):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    responsibilities: str | None = Field(default=None, max_length=10000)
    requirements: str | None = Field(default=None, max_length=10000)
    what_we_offer: str | None = Field(default=None, max_length=10000)
    department: Department | None = None
    location: str | None = Field(default=None, max_length=200)
    work_mode: WorkMode | None = None
    employment_type: EmploymentType | None = None
    visibility: JobVisibility | None = None
    salary_min: Money | None = None
    salary_max: Money | None = None
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    salary_period: SalaryPeriod | None = None
    show_salary_publicly: bool | None = Field(default=None, strict=True)
    application_deadline: AwareDatetime | None = None
    screening_questions: list[ScreeningQuestion] | None = Field(default=None, max_length=8)
    fair_hiring_confirmed: bool | None = Field(default=None, strict=True)
    equity_min_pct: Equity | None = None
    equity_max_pct: Equity | None = None
    experience_min_yrs: Years | None = None
    experience_max_yrs: Years | None = None
    openings: int | None = Field(default=None, ge=1, le=32767, strict=True)
    owner_id: uuid.UUID | None = None
    skills: list[JobSkillInput] | None = Field(default=None, max_length=30)
    benefits: list[Annotated[str, Field(max_length=100)]] | None = Field(
        default=None, max_length=30
    )


class JobRead(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    org_id: uuid.UUID
    title: str
    description: str | None
    responsibilities: str | None
    requirements: str | None
    what_we_offer: str | None
    department: Department | None
    location: str | None
    work_mode: WorkMode
    employment_type: EmploymentType
    status: JobStatus
    visibility: JobVisibility
    salary_min: Decimal | None
    salary_max: Decimal | None
    currency: str
    salary_period: SalaryPeriod
    show_salary_publicly: bool
    application_deadline: datetime | None
    screening_questions: list[ScreeningQuestion]
    fair_hiring_confirmed: bool
    blind_review_enabled: bool
    equity_min_pct: Decimal | None
    equity_max_pct: Decimal | None
    experience_min_yrs: int | None
    experience_max_yrs: int | None
    openings: int
    owner_id: uuid.UUID | None
    posted_at: datetime | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    skills: list[JobSkillRead]
    benefits: list[JobBenefitRead]


class JobPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[JobRead]
    total: int
    limit: int
    offset: int
    has_more: bool


class JobSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int
    by_status: dict[JobStatus, int]


class JobAction(BaseModel):
    """Empty action input deliberately rejects attempts to smuggle writable fields."""

    model_config = ConfigDict(extra="forbid")
