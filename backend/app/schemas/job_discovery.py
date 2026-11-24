"""Applicant-safe discovery contracts; never inherit the management response."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.job import EmploymentType, JobStatus, SalaryPeriod, WorkMode
from app.models.organization import Department
from app.models.startup import StartupStage
from app.schemas.job import JobBenefitRead, JobSkillRead, Money
from app.schemas.job_application import ApplicationStage
from app.schemas.job_screening import ScreeningQuestionRead


class JobSearch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    q: str | None = Field(default=None, max_length=100)
    location: str | None = Field(default=None, max_length=200)
    org_id: uuid.UUID | None = None
    org_type: Literal["employer", "startup"] | None = None
    work_mode: WorkMode | None = None
    employment_type: EmploymentType | None = None
    work_modes: list[WorkMode] = Field(default_factory=list, max_length=3)
    employment_types: list[EmploymentType] = Field(default_factory=list, max_length=5)
    stages: list[StartupStage] = Field(default_factory=list, max_length=5)
    verified_only: bool = False
    department: Department | None = None
    stage: StartupStage | None = None
    sector: str | None = Field(default=None, max_length=100)
    experience_min: int | None = Field(default=None, ge=0, le=32767)
    experience_max: int | None = Field(default=None, ge=0, le=32767)
    skill_ids: list[uuid.UUID] = Field(default_factory=list, max_length=30)
    skills_match: Literal["all", "any"] = "all"
    salary_min: Money | None = None
    salary_max: Money | None = None
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")
    salary_period: SalaryPeriod = SalaryPeriod.annual
    equity_only: bool = False
    posted_days: int | None = Field(default=None, ge=1, le=365)
    sort: Literal["relevance", "newest", "salary", "deadline"] = "newest"
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def ranges(self):
        for low, high in (
            (self.salary_min, self.salary_max),
            (self.experience_min, self.experience_max),
        ):
            if low is not None and high is not None and low > high:
                raise ValueError("Minimum must not exceed maximum.")
        return self


class HiringStartupSearch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    q: str | None = Field(default=None, max_length=100)
    location: str | None = Field(default=None, max_length=200)
    stage: StartupStage | None = None
    sector: str | None = Field(default=None, max_length=100)
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class HiringCompany(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: uuid.UUID
    name: str
    slug: str
    type: Literal["employer", "startup"]
    logo_url: str | None = None
    website: str | None = None
    city: str | None = None
    region: str | None = None
    country: str | None = None
    founded_year: int | None = None
    summary: str | None = None
    stage: StartupStage | None = None
    sector: str | None = None
    verified: bool = False
    open_jobs_count: int = 0


class MarketplaceJob(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: uuid.UUID
    company: HiringCompany
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
    salary_min: Decimal | None
    salary_max: Decimal | None
    currency: str
    salary_period: SalaryPeriod
    salary_visible: bool
    equity_min_pct: Decimal | None
    equity_max_pct: Decimal | None
    experience_min_yrs: int | None
    experience_max_yrs: int | None
    openings: int
    posted_at: datetime | None
    application_deadline: datetime | None = None
    can_apply: bool = False
    own_application_id: uuid.UUID | None = None
    own_application_stage: ApplicationStage | None = None
    screening_questions: list[ScreeningQuestionRead]
    skills: list[JobSkillRead]
    benefits: list[JobBenefitRead]


class MarketplaceJobPage(BaseModel):
    items: list[MarketplaceJob]
    total: int
    limit: int
    offset: int
    has_more: bool


class HiringCompanyPage(BaseModel):
    items: list[HiringCompany]
    total: int
    limit: int
    offset: int
    has_more: bool
