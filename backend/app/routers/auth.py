import redis.asyncio as aioredis
from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.dependencies import get_current_user, get_redis
from app.core.rate_limit import check_email_lockout, check_ip_rate_limit
from app.db.engine import get_db
from app.models.user import User
from app.schemas.auth import (
    ChangeEmailRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserMeResponse,
    VerifyEmailRequest,
)
from app.schemas.common import MessageResponse
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


@router.post(
    "/register",
    response_model=UserMeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def register(
    payload: RegisterRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> UserMeResponse:
    ip = get_client_ip(request)
    await check_ip_rate_limit(redis_client, ip, "register", limit=10, window_seconds=60)
    return await AuthService.register(payload, db, settings, background_tasks)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and obtain tokens",
)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> TokenResponse:
    ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent")

    # 1. IP-level rate limiting
    await check_ip_rate_limit(
        redis_client,
        ip,
        "login",
        limit=settings.LOGIN_MAX_ATTEMPTS_PER_IP,
        window_seconds=60,
    )

    # 2. Per-email lockout check
    await check_email_lockout(
        redis_client,
        payload.email,
        max_attempts=settings.LOGIN_MAX_ATTEMPTS_PER_EMAIL,
    )

    token_response, raw_refresh = await AuthService.login(
        payload=payload,
        ip=ip,
        user_agent=user_agent,
        db=db,
        settings=settings,
        redis_client=redis_client,
    )

    # Set httpOnly cookie for refresh token
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/v1/auth",
    )

    return token_response


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate refresh token and get a new access token",
)
async def refresh_token(
    request: Request,
    response: Response,
    body: RefreshTokenRequest | None = None,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent")

    # If explicit body token provided (for tests / non-browser clients), use it; otherwise use cookie
    raw_token = body.refresh_token if (body and body.refresh_token) else request.cookies.get("refresh_token")

    token_response, new_raw_refresh = await AuthService.refresh_tokens(
        raw_refresh_token=raw_token,
        ip=ip,
        user_agent=user_agent,
        db=db,
        settings=settings,
    )

    response.set_cookie(
        key="refresh_token",
        value=new_raw_refresh,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/v1/auth",
    )

    return token_response


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Revoke current session",
)
async def logout(
    request: Request,
    response: Response,
    body: RefreshTokenRequest | None = None,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    raw_token = body.refresh_token if (body and body.refresh_token) else request.cookies.get("refresh_token")

    await AuthService.logout(raw_token, db)
    response.delete_cookie(key="refresh_token", path="/api/v1/auth")
    return MessageResponse(message="Logged out successfully.")


@router.post(
    "/logout-all",
    response_model=MessageResponse,
    summary="Revoke all active sessions for current user",
)
async def logout_all(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await AuthService.logout_all(current_user.id, db)
    response.delete_cookie(key="refresh_token", path="/api/v1/auth")
    return MessageResponse(message="All sessions revoked.")


@router.post(
    "/verify-email",
    response_model=MessageResponse,
    summary="Verify account email with token",
)
async def verify_email(
    payload: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await AuthService.verify_email(payload.token, db)
    return MessageResponse(message="Email verified successfully.")


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
    summary="Resend verification email",
)
async def resend_verification(
    payload: ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> MessageResponse:
    await AuthService.resend_verification(
        payload=payload,
        db=db,
        settings=settings,
        redis_client=redis_client,
        background_tasks=background_tasks,
    )
    return MessageResponse(
        message="If that email is registered, you will receive an email shortly."
    )


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Request password reset email",
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> MessageResponse:
    ip = get_client_ip(request)
    await check_ip_rate_limit(redis_client, ip, "forgot-password", limit=5, window_seconds=60)
    await AuthService.forgot_password(
        payload=payload,
        ip=ip,
        db=db,
        settings=settings,
        background_tasks=background_tasks,
    )
    return MessageResponse(
        message="If that email is registered, you will receive an email shortly."
    )


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Reset password using token",
)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await AuthService.reset_password(payload, db)
    return MessageResponse(message="Password reset successfully. You can now log in.")


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change password for authenticated user",
)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await AuthService.change_password(current_user, payload, db)
    return MessageResponse(message="Password changed successfully.")


@router.post(
    "/change-email",
    response_model=MessageResponse,
    summary="Change email address for authenticated user",
)
async def change_email(
    payload: ChangeEmailRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    await AuthService.change_email(
        user=current_user,
        payload=payload,
        db=db,
        settings=settings,
        background_tasks=background_tasks,
    )
    return MessageResponse(
        message="Verification email sent to new address. Your email will be updated once verified."
    )
