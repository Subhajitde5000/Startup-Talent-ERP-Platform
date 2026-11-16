from typing import Any

from fastapi import Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


class AuthenticationError(AppError):
    def __init__(self, message: str = "Authentication required.", details: Any = None) -> None:
        super().__init__(
            code="authentication_required",
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details,
        )


class AuthorizationError(AppError):
    def __init__(self, message: str = "Access denied.", details: Any = None) -> None:
        super().__init__(
            code="forbidden",
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            details=details,
        )


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found.", details: Any = None) -> None:
        super().__init__(
            code="not_found",
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            details=details,
        )


class ConflictError(AppError):
    def __init__(self, message: str = "Resource already exists.", details: Any = None) -> None:
        super().__init__(
            code="conflict",
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            details=details,
        )


class RateLimitError(AppError):
    def __init__(
        self,
        message: str = "Too many requests. Please try again later.",
        details: Any = None,
    ) -> None:
        super().__init__(
            code="rate_limit_exceeded",
            message=message,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=details,
        )


class AccountLockedError(AppError):
    def __init__(
        self,
        message: str = "Account temporarily locked due to too many failed attempts. Try again later.",
        details: Any = None,
    ) -> None:
        super().__init__(
            code="account_locked",
            message=message,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=details,
        )


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": jsonable_encoder(exc.details),
            }
        },
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "validation_error",
                "message": "Input validation failed.",
                "details": jsonable_encoder(exc.errors()),
            }
        },
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "internal_server_error",
                "message": "An unexpected server error occurred.",
                "details": None,
            }
        },
    )
