import re
import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


class RegisterRoleEnum(str, Enum):
    startup = "startup"
    mentor = "mentor"
    investor = "investor"
    jobseeker = "jobseeker"
    employer = "employer"


def validate_password_strength(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", v):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", v):
        raise ValueError("Password must contain at least one lowercase letter.")
    if not re.search(r"\d", v):
        raise ValueError("Password must contain at least one digit.")
    return v


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    role: RegisterRoleEnum
    phone: str | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return validate_password_strength(v)

    @field_validator("display_name")
    @classmethod
    def check_display_name(cls, v: str) -> str:
        s = v.strip()
        if not s or len(s) > 160:
            raise ValueError("Display name must be between 1 and 160 characters.")
        return s


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    model_config = ConfigDict(extra="forbid")


class RefreshTokenRequest(BaseModel):
    refresh_token: str | None = None

    model_config = ConfigDict(extra="forbid")


class VerifyEmailRequest(BaseModel):
    token: str

    model_config = ConfigDict(extra="forbid")


class ResendVerificationRequest(BaseModel):
    email: EmailStr

    model_config = ConfigDict(extra="forbid")


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    model_config = ConfigDict(extra="forbid")


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    model_config = ConfigDict(extra="forbid")

    @field_validator("new_password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return validate_password_strength(v)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    model_config = ConfigDict(extra="forbid")

    @field_validator("new_password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return validate_password_strength(v)


class ChangeEmailRequest(BaseModel):
    new_email: EmailStr
    current_password: str

    model_config = ConfigDict(extra="forbid")


class UserRoleRead(BaseModel):
    role: str
    is_primary: bool
    granted_at: datetime

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class UserMeResponse(BaseModel):
    id: uuid.UUID
    primary_email: str
    email_verified: bool
    display_name: str
    handle: str | None = None
    avatar_url: str | None = None
    avatar_initials: str | None = None
    phone: str | None = None
    locale: str
    timezone: str
    status: str
    verification: str
    two_factor_enabled: bool
    roles: list[UserRoleRead]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserMeResponse

    model_config = ConfigDict(extra="forbid")
