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
    applicant_pipeline,
    auth,
    availability,
    commitment,
    dashboard,
    data_room,
    data_room_access,
    deliverable,
    diligence,
    discovery,
    earning,
    files,
    funding_round,
    investor_deal,
    investor_directory,
    investor_discovery,
    investor_engagement,
    investor_hub,
    investor_offer,
    investor_search,
    investor_workspace,
    invites,
    job_applications,
    job_discovery,
    jobs,
    market,
    mentor,
    mentor_workspace,
    mentorship,
    metrics,
    milestones,
    organizations,
    public,
    readiness,
    scorecards,
    session,
    session_review,
    skills,
    stage,
    startup_profile,
    talent,
    task_comments,
    task_labels,
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

    app.include_router(data_room.router, prefix=settings.API_V1_PREFIX)
    app.include_router(data_room_access.router, prefix=settings.API_V1_PREFIX)
    app.include_router(files.router, prefix=settings.API_V1_PREFIX)
    app.include_router(files.local_router, prefix=settings.API_V1_PREFIX)
    app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
    app.include_router(users.router, prefix=settings.API_V1_PREFIX)
    app.include_router(skills.router, prefix=settings.API_V1_PREFIX)
    app.include_router(organizations.router, prefix=settings.API_V1_PREFIX)
    app.include_router(jobs.router, prefix=settings.API_V1_PREFIX)
    app.include_router(job_discovery.router, prefix=settings.API_V1_PREFIX)
    app.include_router(job_applications.router, prefix=settings.API_V1_PREFIX)
    app.include_router(applicant_pipeline.router, prefix=settings.API_V1_PREFIX)
    app.include_router(scorecards.router, prefix=settings.API_V1_PREFIX)
    from app.routers import interviews

    app.include_router(interviews.router, prefix=settings.API_V1_PREFIX)
    app.include_router(interviews.candidate_router, prefix=settings.API_V1_PREFIX)
    from app.routers import job_offers

    app.include_router(job_offers.router, prefix=settings.API_V1_PREFIX)
    app.include_router(job_offers.candidate_router, prefix=settings.API_V1_PREFIX)
    from app.routers import onboarding

    app.include_router(onboarding.router, prefix=settings.API_V1_PREFIX)
    app.include_router(startup_profile.router, prefix=settings.API_V1_PREFIX)
    app.include_router(milestones.router, prefix=settings.API_V1_PREFIX)
    app.include_router(funding_round.router, prefix=settings.API_V1_PREFIX)
    app.include_router(investor_search.router, prefix=settings.API_V1_PREFIX)
    app.include_router(investor_deal.router, prefix=settings.API_V1_PREFIX)
    app.include_router(investor_offer.router, prefix=settings.API_V1_PREFIX)
    app.include_router(commitment.router, prefix=settings.API_V1_PREFIX)
    app.include_router(investor_engagement.router, prefix=settings.API_V1_PREFIX)
    app.include_router(diligence.router, prefix=settings.API_V1_PREFIX)
    app.include_router(investor_workspace.router, prefix=settings.API_V1_PREFIX)
    app.include_router(investor_hub.router, prefix=settings.API_V1_PREFIX)
    app.include_router(investor_directory.router, prefix=settings.API_V1_PREFIX)
    app.include_router(investor_discovery.router, prefix=settings.API_V1_PREFIX)
    app.include_router(tasks.router, prefix=settings.API_V1_PREFIX)
    app.include_router(readiness.router, prefix=settings.API_V1_PREFIX)
    # Step 8f: mentor sign-off through the mentorship it comes from.
    app.include_router(readiness.mentorship_router, prefix=settings.API_V1_PREFIX)
    app.include_router(metrics.router, prefix=settings.API_V1_PREFIX)
    app.include_router(invites.router, prefix=settings.API_V1_PREFIX)
    app.include_router(talent.router, prefix=settings.API_V1_PREFIX)
    app.include_router(mentor_workspace.router, prefix=settings.API_V1_PREFIX)
    app.include_router(mentor.router, prefix=settings.API_V1_PREFIX)
    # Step 8a: the read-only mentor directory (/mentors) and per-startup
    # suggestions. Same service as /mentor-profile, separate path space.
    app.include_router(mentor.directory_router, prefix=settings.API_V1_PREFIX)
    app.include_router(mentor.org_router, prefix=settings.API_V1_PREFIX)
    # Step 8b: mentorship requests. `org_router` carries the org-scoped
    # create (POST /organizations/{id}/mentorships) in house style.
    app.include_router(mentorship.router, prefix=settings.API_V1_PREFIX)
    app.include_router(mentorship.org_router, prefix=settings.API_V1_PREFIX)
    app.include_router(mentorship.mentor_router, prefix=settings.API_V1_PREFIX)
    # Step 8c: mentor weekly availability + the bookable-slot read.
    app.include_router(availability.router, prefix=settings.API_V1_PREFIX)
    app.include_router(availability.public_router, prefix=settings.API_V1_PREFIX)
    # Step 8d: mentoring sessions.
    app.include_router(session_review.router, prefix=settings.API_V1_PREFIX)
    app.include_router(session.router, prefix=settings.API_V1_PREFIX)
    app.include_router(session.mentorship_router, prefix=settings.API_V1_PREFIX)
    # Step 8e: mentor deliverables.
    app.include_router(deliverable.router, prefix=settings.API_V1_PREFIX)
    app.include_router(deliverable.mentorship_router, prefix=settings.API_V1_PREFIX)
    # Step 8h: the mentor's own earnings (read-only).
    app.include_router(earning.router, prefix=settings.API_V1_PREFIX)
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
    # Step 5d: task labels and comments. Both use the /organizations
    # prefix, so they sit next to the task routes they extend.
    app.include_router(task_labels.router, prefix=settings.API_V1_PREFIX)
    app.include_router(task_comments.router, prefix=settings.API_V1_PREFIX)
    # Step 5g: the one read-only dashboard summary.
    app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX)
    return app


app = create_app()
