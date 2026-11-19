"""FastAPI application factory (Step 1 foundation + Step 2 auth)."""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import get_settings
from app.core.exceptions import AppException, error_body
from app.core.logging import RequestIDMiddleware, configure_logging
from app.db.session import engine
from app.routers import (
    analytics,
    auth,
    discovery,
    invites,
    market,
    mentor,
    metrics,
    milestones,
    organizations,
    public,
    readiness,
    skills,
    stage,
    startup_profile,
    talent,
    tasks,
    users,
)

configure_logging()
logger = logging.getLogger("forma")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.APP_NAME,
        version="0.2.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )

    @app.exception_handler(AppException)
    async def _app_exception_handler(_request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=error_body(
                "VALIDATION_ERROR",
                "Request validation failed.",
                jsonable_encoder(exc.errors()),
            ),
        )

    @app.exception_handler(Exception)
    async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s", request.url.path)
        return JSONResponse(
            status_code=500,
            content=error_body("INTERNAL_ERROR", "An unexpected error occurred."),
        )

    @app.get("/health", tags=["health"], summary="Liveness check")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/ready", tags=["health"], summary="Readiness check (database)")
    async def ready() -> dict[str, str]:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready"}

    app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
    app.include_router(users.router, prefix=settings.API_V1_PREFIX)
    app.include_router(skills.router, prefix=settings.API_V1_PREFIX)
    app.include_router(organizations.router, prefix=settings.API_V1_PREFIX)
    app.include_router(startup_profile.router, prefix=settings.API_V1_PREFIX)
    app.include_router(milestones.router, prefix=settings.API_V1_PREFIX)
    app.include_router(tasks.router, prefix=settings.API_V1_PREFIX)
    app.include_router(readiness.router, prefix=settings.API_V1_PREFIX)
    app.include_router(metrics.router, prefix=settings.API_V1_PREFIX)
    app.include_router(invites.router, prefix=settings.API_V1_PREFIX)
    app.include_router(talent.router, prefix=settings.API_V1_PREFIX)
    app.include_router(mentor.router, prefix=settings.API_V1_PREFIX)
    app.include_router(public.router, prefix=settings.API_V1_PREFIX)
    # Step 5h: the startup discovery list. /public/startups (list) and
    # /public/startups/{slug} (detail, in public.py) differ in segment
    # count, so registration order does not matter between them.
    app.include_router(discovery.router, prefix=settings.API_V1_PREFIX)
    # Step 5i/5j: stage summary, history, exit criteria and stage tools.
    app.include_router(stage.router, prefix=settings.API_V1_PREFIX)
    # Steps 5k/5l: business analytics and the market tab.
    app.include_router(analytics.router, prefix=settings.API_V1_PREFIX)
    app.include_router(market.router, prefix=settings.API_V1_PREFIX)
    return app


app = create_app()
