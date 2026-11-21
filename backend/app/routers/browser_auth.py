"""Browser-only session endpoints: tokens never enter JavaScript storage."""
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import forbidden, invalid_token
from app.db.session import get_db
from app.routers.auth import _client_ip
from app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.services import auth_service

router = APIRouter(prefix="/auth/browser", tags=["browser auth"])


def require_browser_header(request: Request) -> None:
    # Non-simple header triggers a CORS preflight, which is restricted to the
    # configured trusted origins. Forms and cross-origin scripts cannot send it.
    if request.headers.get("x-forma-client") != "browser":
        raise forbidden("Browser request header required.")


def set_cookies(response: Response, tokens: TokenResponse, request: Request) -> None:
    settings = get_settings()
    secure = settings.is_prod or request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    response.set_cookie("forma_access", tokens.access_token, max_age=tokens.expires_in, httponly=True, secure=secure, samesite="strict", path=settings.API_V1_PREFIX)
    response.set_cookie("forma_refresh", tokens.refresh_token, max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400, httponly=True, secure=secure, samesite="strict", path=settings.API_V1_PREFIX)


def clear_cookies(response: Response) -> None:
    path = get_settings().API_V1_PREFIX
    response.delete_cookie("forma_access", path=path)
    response.delete_cookie("forma_refresh", path=path)


@router.post("/login", response_model=MessageResponse, dependencies=[Depends(require_browser_header)])
async def login(payload: LoginRequest, request: Request, response: Response, db: Annotated[AsyncSession, Depends(get_db)]) -> MessageResponse:
    tokens = await auth_service.login(db, payload, ip=_client_ip(request), user_agent=request.headers.get("user-agent"))
    set_cookies(response, tokens, request)
    return MessageResponse(message="Signed in.")


@router.post("/verify-email", response_model=MessageResponse, dependencies=[Depends(require_browser_header)])
async def verify(payload: VerifyEmailRequest, request: Request, response: Response, db: Annotated[AsyncSession, Depends(get_db)]) -> MessageResponse:
    tokens = await auth_service.verify_email(db, payload, ip=_client_ip(request), user_agent=request.headers.get("user-agent"))
    set_cookies(response, tokens, request)
    return MessageResponse(message="Email verified.")


@router.post("/refresh", response_model=MessageResponse, dependencies=[Depends(require_browser_header)])
async def refresh(request: Request, response: Response, db: Annotated[AsyncSession, Depends(get_db)]) -> MessageResponse:
    token = request.cookies.get("forma_refresh")
    if not token:
        raise invalid_token()
    tokens = await auth_service.refresh(db, RefreshRequest(refresh_token=token), ip=_client_ip(request), user_agent=request.headers.get("user-agent"))
    set_cookies(response, tokens, request)
    return MessageResponse(message="Session refreshed.")


@router.post("/logout", status_code=204, dependencies=[Depends(require_browser_header)])
async def logout(request: Request, db: Annotated[AsyncSession, Depends(get_db)]) -> Response:
    token = request.cookies.get("forma_refresh")
    if token:
        await auth_service.logout(db, refresh_token=token)
    response = Response(status_code=204)
    clear_cookies(response)
    return response
