from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import get_settings
from app.core.exceptions import (
    AppError,
    app_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)
from app.core.logging import get_logger, setup_logging
from app.core.middleware import RequestContextMiddleware
from app.core.rate_limit import close_redis, get_redis_client
from app.db.engine import get_engine
from app.routers import auth, users

logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    setup_logging(settings.ENVIRONMENT)
    logger.info("application_starting", environment=settings.ENVIRONMENT)
    yield
    logger.info("application_shutting_down")
    await close_redis()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Forma API",
        description="Startup & Talent ERP Platform API",
        version="1.0.0",
        docs_url="/api/v1/docs",
        redoc_url="/api/v1/redoc",
        openapi_url="/api/v1/openapi.json",
        lifespan=lifespan,
    )

    # 1. Custom Middleware
    app.add_middleware(RequestContextMiddleware)

    # 2. CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 3. Exception Handlers
    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_error_handler)

    # 4. Health & Readiness
    @app.get("/api/v1/health", tags=["System"])
    async def health_check() -> dict[str, str]:
        return {
            "status": "healthy",
            "environment": settings.ENVIRONMENT,
        }

    @app.get("/api/v1/ready", tags=["System"])
    async def readiness_check() -> dict[str, str]:
        # Check DB
        try:
            engine = get_engine()
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            db_status = "ok"
        except Exception as e:
            logger.error("readiness_db_failure", error=str(e))
            db_status = "unavailable"

        # Check Redis
        try:
            redis_client = await get_redis_client()
            await redis_client.ping()
            redis_status = "ok"
        except Exception as e:
            logger.error("readiness_redis_failure", error=str(e))
            redis_status = "unavailable"

        is_ready = db_status == "ok" and redis_status == "ok"
        return {
            "status": "ready" if is_ready else "degraded",
            "database": db_status,
            "redis": redis_status,
        }

    # 5. Routers
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(users.router, prefix="/api/v1")

    return app


app = create_app()
