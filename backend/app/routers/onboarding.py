"""7h templates, accepted hires, checklists and private document grants."""

import uuid

from fastapi import APIRouter

from app.routers.files import Store
from app.routers.interviews import HiringRoute, Limit, Offset, errors
from app.routers.jobs import DB, Actor
from app.schemas import hiring_workflow as s
from app.schemas.file import FileDownloadRead
from app.services import onboarding_service as service

router = APIRouter(
    prefix="/organizations/{org_id}",
    tags=["hires and onboarding"],
    route_class=HiringRoute,
    responses=errors,
)


@router.post(
    "/onboarding-templates",
    response_model=s.OnboardingTemplateRead,
    status_code=201,
    summary="Create an organization onboarding template",
)
async def template_create(
    org_id: uuid.UUID, payload: s.OnboardingTemplateInput, db: DB, user: Actor
) -> s.OnboardingTemplateRead:
    return await service.template_create(db, user, org_id, payload)


@router.get(
    "/onboarding-templates",
    response_model=s.TemplatePage,
    summary="List organization onboarding templates",
)
async def template_list(
    org_id: uuid.UUID, db: DB, user: Actor, limit: Limit = 20, offset: Offset = 0
) -> s.TemplatePage:
    return await service.template_list(db, user, org_id, limit, offset)


@router.get(
    "/onboarding-templates/{id_}",
    response_model=s.OnboardingTemplateRead,
    summary="Read a template and its bounded items",
)
async def template_get(
    org_id: uuid.UUID, id_: uuid.UUID, db: DB, user: Actor
) -> s.OnboardingTemplateRead:
    return await service.template_get(db, user, org_id, id_)


@router.put(
    "/onboarding-templates/{id_}",
    response_model=s.OnboardingTemplateRead,
    summary="Replace template items without changing existing hires",
)
async def template_patch(
    org_id: uuid.UUID, id_: uuid.UUID, payload: s.OnboardingTemplateInput, db: DB, user: Actor
) -> s.OnboardingTemplateRead:
    return await service.template_patch(db, user, org_id, id_, payload)


@router.delete(
    "/onboarding-templates/{id_}",
    status_code=204,
    summary="Archive a template without changing copied checklists",
)
async def template_archive(org_id: uuid.UUID, id_: uuid.UUID, db: DB, user: Actor) -> None:
    await service.template_archive(db, user, org_id, id_)


@router.post(
    "/hires",
    response_model=s.HireRead,
    status_code=201,
    summary="Convert a current accepted offer exactly once",
)
async def create(org_id: uuid.UUID, payload: s.HireCreate, db: DB, user: Actor) -> s.HireRead:
    return await service.create(db, user, org_id, payload)


@router.get("/hires", response_model=s.HirePage, summary="List authorized hires")
async def listing(
    org_id: uuid.UUID,
    db: DB,
    user: Actor,
    status: s.HireStatus | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> s.HirePage:
    return await service.listing(db, user, org_id, status, limit, offset)


@router.get(
    "/hires/{id_}", response_model=s.HireRead, summary="Read a scoped hire and checklist progress"
)
async def get(org_id: uuid.UUID, id_: uuid.UUID, db: DB, user: Actor) -> s.HireRead:
    return await service.get(db, user, org_id, id_)


@router.patch(
    "/hires/{id_}",
    response_model=s.HireRead,
    summary="Change onboarding ownership or start date explicitly",
)
async def patch(
    org_id: uuid.UUID, id_: uuid.UUID, payload: s.HirePatch, db: DB, user: Actor
) -> s.HireRead:
    return await service.patch(db, user, org_id, id_, payload)


@router.post(
    "/hires/{id_}/transitions",
    response_model=s.HireRead,
    summary="Manually onboard, activate, cancel or record a no-show",
)
async def transition(
    org_id: uuid.UUID, id_: uuid.UUID, payload: s.HireTransition, db: DB, user: Actor
) -> s.HireRead:
    return await service.transition(db, user, org_id, id_, payload)


@router.get(
    "/hires/{id_}/checklist",
    response_model=s.TaskPage,
    summary="List authorized copied checklist items",
)
async def tasks(
    org_id: uuid.UUID, id_: uuid.UUID, db: DB, user: Actor, limit: Limit = 20, offset: Offset = 0
) -> s.TaskPage:
    return await service.tasks(db, user, org_id, id_, limit, offset)


@router.patch(
    "/hires/{id_}/checklist/{task_id}",
    response_model=s.TaskRead,
    summary="Update a checklist item within manager or assignee scope",
)
async def task_patch(
    org_id: uuid.UUID, id_: uuid.UUID, task_id: uuid.UUID, payload: s.TaskPatch, db: DB, user: Actor
) -> s.TaskRead:
    return await service.task_patch(db, user, org_id, id_, task_id, payload)


@router.get(
    "/hires/{id_}/documents",
    response_model=s.DocumentPage,
    summary="List private hire document requests",
)
async def documents(
    org_id: uuid.UUID, id_: uuid.UUID, db: DB, user: Actor, limit: Limit = 20, offset: Offset = 0
) -> s.DocumentPage:
    return await service.documents(db, user, org_id, id_, limit, offset)


@router.post(
    "/hires/{id_}/documents",
    response_model=s.DocumentRead,
    status_code=201,
    summary="Request a document with explicit purpose and retention",
)
async def document_create(
    org_id: uuid.UUID, id_: uuid.UUID, payload: s.DocumentCreate, db: DB, user: Actor
) -> s.DocumentRead:
    return await service.document_create(db, user, org_id, id_, payload)


@router.patch(
    "/hires/{id_}/documents/{document_id}",
    response_model=s.DocumentRead,
    summary="Attach a clean private file or record a review",
)
async def document_patch(
    org_id: uuid.UUID,
    id_: uuid.UUID,
    document_id: uuid.UUID,
    payload: s.DocumentPatch,
    db: DB,
    user: Actor,
) -> s.DocumentRead:
    return await service.document_patch(db, user, org_id, id_, document_id, payload)


@router.post(
    "/hires/{id_}/documents/{document_id}/download",
    response_model=FileDownloadRead,
    summary="Sign a document only for an explicit private hire grant",
)
async def document_download(
    org_id: uuid.UUID, id_: uuid.UUID, document_id: uuid.UUID, db: DB, user: Actor, storage: Store
) -> FileDownloadRead:
    return await service.document_download(db, user, org_id, id_, document_id, storage)
