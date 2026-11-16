"""Application exceptions and consistent error format.

Every error response is:
    { "error": { "code": "...", "message": "...", "details": ... } }
"""

from typing import Any


class AppException(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


def error_body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details}}


# Common codes (stable, machine-readable for the frontend)
class AuthError(AppException):
    pass


def invalid_credentials() -> AuthError:
    # Generic: never reveal whether the email exists or which field failed.
    return AuthError("INVALID_CREDENTIALS", "Invalid email or password.", 401)


def invalid_token(message: str = "Invalid or expired token.") -> AuthError:
    return AuthError("INVALID_TOKEN", message, 401)


def token_expired() -> AuthError:
    return AuthError("TOKEN_EXPIRED", "Token has expired.", 401)


def token_reused() -> AuthError:
    return AuthError("TOKEN_REUSED", "Refresh token reuse detected.", 401)


def email_not_verified() -> AuthError:
    return AuthError(
        "EMAIL_NOT_VERIFIED",
        "Please verify your email to continue.",
        403,
    )


def account_suspended() -> AuthError:
    return AuthError(
        "ACCOUNT_SUSPENDED",
        "Your account has been suspended.",
        403,
    )


def account_inactive() -> AuthError:
    return AuthError(
        "ACCOUNT_INACTIVE",
        "Your account is not active.",
        403,
    )


def forbidden(message: str = "You do not have permission to perform this action.") -> AuthError:
    return AuthError("FORBIDDEN", message, 403)


def rate_limited(message: str = "Too many requests. Please try again later.") -> AuthError:
    return AuthError("RATE_LIMITED", message, 429)


def validation_error(message: str, details: Any = None) -> AppException:
    return AppException("VALIDATION_ERROR", message, 422, details)


def conflict(message: str) -> AppException:
    return AppException("CONFLICT", message, 409)


def not_found(message: str = "Resource not found.") -> AppException:
    return AppException("NOT_FOUND", message, 404)
