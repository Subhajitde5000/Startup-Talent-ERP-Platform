"""Auth router: thin HTTP layer. All logic lives in services."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    AddRoleRequest,
    ChangeEmailRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=201,
    summary="Register a new account",
    description="Creates a user and assigns the chosen role as primary. "
    "Admin role can never be self-registered. Response is generic to avoid "
    "revealing whether an email already exists.",
)
async def register(
    payload: RegisterRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RegisterResponse:
    return await auth_service.register(db, payload, ip=_client_ip(request))


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Log in",
    description="Issues a short-lived access token and a rotating refresh token.",
)
async def login(
    payload: LoginRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    return await auth_service.login(
        db,
        payload,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh tokens (rotation)",
    description="Rotates the refresh token. Reuse of a revoked token revokes the chain.",
)
async def refresh(
    payload: RefreshRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    return await auth_service.refresh(
        db,
        payload,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )


@router.post("/logout", status_code=204, summary="Log out current session")
async def logout(
    payload: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    await auth_service.logout(db, refresh_token=payload.refresh_token)
    return Response(status_code=204)


@router.post("/logout-all", response_model=MessageResponse, summary="Log out everywhere")
async def logout_all(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MessageResponse:
    await auth_service.logout_all(db, user_id=user.id)
    return MessageResponse(message="All sessions revoked.")


@router.post(
    "/verify-email", response_model=MessageResponse, summary="Verify email with 6-digit code"
)
async def verify_email(
    payload: VerifyEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    await auth_service.verify_email(db, payload)
    return MessageResponse(message="Email verified.")


@router.post(
    "/resend-verification", response_model=MessageResponse, summary="Resend verification code"
)
async def resend_verification(
    payload: ResendVerificationRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    await auth_service.resend_verification(db, payload, ip=_client_ip(request))
    return MessageResponse(
        message="If an account exists for this email, a verification code is on its way."
    )


@router.post("/forgot-password", response_model=MessageResponse, summary="Request password reset")
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    await auth_service.forgot_password(db, payload, ip=_client_ip(request))
    return MessageResponse(
        message="If an account exists for this email, a reset link is on its way."
    )


@router.post("/reset-password", response_model=MessageResponse, summary="Reset password with token")
async def reset_password(
    payload: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    await auth_service.reset_password(db, payload)
    return MessageResponse(message="Password updated. Please sign in.")


@router.post("/change-password", response_model=MessageResponse, summary="Change password")
async def change_password(
    payload: ChangePasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MessageResponse:
    await auth_service.change_password(db, user=user, payload=payload)
    return MessageResponse(message="Password changed.")


@router.post("/change-email", response_model=MessageResponse, summary="Change email address")
async def change_email(
    payload: ChangeEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MessageResponse:
    await auth_service.change_email(db, user=user, payload=payload)
    return MessageResponse(message="Email updated. Please verify the new address.")


@router.post("/add-role", response_model=MessageResponse, summary="Add a role to your account")
async def add_role(
    payload: AddRoleRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MessageResponse:
    await auth_service.add_role(db, user=user, payload=payload)
    return MessageResponse(message="Role added.")
