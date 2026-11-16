from typing import Any

from pydantic import BaseModel, ConfigDict


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Any = None

    model_config = ConfigDict(extra="forbid")


class ErrorResponse(BaseModel):
    error: ErrorDetail

    model_config = ConfigDict(extra="forbid")


class MessageResponse(BaseModel):
    message: str

    model_config = ConfigDict(extra="forbid")
