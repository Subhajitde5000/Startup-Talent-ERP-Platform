"""Auth request/response schemas (Pydantic v2).

Separate Create/Update/Read schemas; never expose hashes or tokens.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import UserRole

# Roles a user may self-register for. Admin is NEVER self-assignable (Step 15a).
SELF_REGISTER_ROLES = {
    UserRole.startup,
    UserRole.mentor,
    UserRole.investor,
    UserRole.jobseeker,
    UserRole.employer,
}

COMMON_PASSWORDS = {
    "password",
    "password123",
    "12345678",
    "123456789",
    "qwerty123",
    "letmein123",
    "admin1234",
    "forma123",
    "changeme",
    "welcome123",
}


def _validate_password(value: str) -> str:
    if len(value) < 12:
        raise ValueError("Password must be at least 12 characters.")
    if len(value) > 128:
        raise ValueError("Password must be at most 128 characters.")
    if value.lower() in COMMON_PASSWORDS:
        raise ValueError("Password is too common. Choose a stronger password.")
    return value


def _validate_role(value: UserRole) -> UserRole:
    if value not in SELF_REGISTER_ROLES:
        raise ValueError("This role cannot be selected during registration.")
    return value


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    # Optional: the signup screen collects only email + password. When omitted the
    # service derives a placeholder from the email local part; the real name is set
    # in the Step 3 profile screens.
    display_name: str | None = Field(default=None, max_length=160)
    role: UserRole
    locale: str = Field(default="en-IN", max_length=16)
    timezone: str = Field(default="Asia/Kolkata", max_length=64)

    _pw = field_validator("password")(_validate_password)
    _role = field_validator("role")(_validate_role)

    @field_validator("display_name")
    @classmethod
    def _strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class RegisterResponse(BaseModel):
    # Generic: byte-identical whether the email is new or already registered.
    # Deliberately carries no user_id or any other distinguishing field.
    message: str = "If an account exists for this email, a verification code is on its way."


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until access token expiry


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class VerifyEmailRequest(BaseModel):
    # The verification screen is reached right after signup, before any token
    # exists, so the code is bound to the email it was issued for.
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=12, max_length=128)

    _pw = field_validator("new_password")(_validate_password)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)

    _pw = field_validator("new_password")(_validate_password)


class ChangeEmailRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_email: EmailStr


class AddRoleRequest(BaseModel):
    role: UserRole

    _role = field_validator("role")(_validate_role)


class MessageResponse(BaseModel):
    message: str


class UserRead(BaseModel):
    id: UUID
    email: str
    display_name: str
    status: str
    verification: str
    email_verified_at: datetime | None
    roles: list[str]
    primary_role: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
