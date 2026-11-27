"""Practice interview service (Step 7p & 7q, job-seeker side).

Every session is strictly scoped to ``user_id == current_user.id`` and
``deleted_at IS NULL``. Foreign or soft-deleted sessions always return 404.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.elements import ColumnElement

from app.core.config import get_settings
from app.core.exceptions import not_found, rate_limited, validation_error
from app.models.ai_usage import AiUsageEvent
from app.models.practice import PracticeDrill, PracticeSession, PracticeTranscriptTurn
from app.models.profile import UserReadiness
from app.models.user import User
from app.schemas.practice import PracticeSessionCreate, PracticeTurnCreate
from app.services import ai_practice_service, job_application_service
from app.services.rate_limiter import rate_limiter

require_seeker = job_application_service.require_seeker

PLATFORM_RUBRIC: list[dict] = [
    {
        "key": "structure",
        "title": "Structural Clarity & STAR Framework",
        "weight_pct": 30,
        "description": (
            "How cleanly your answer communicates the Situation, Task, Action taken, "
            "and measurable Result without meandering."
        ),
        "levels": [
            {
                "label": "Exceptional (90-100%)",
                "description": "Crisp context setting, unambiguous personal actions, quantifiable outcomes.",
            },
            {
                "label": "Competent (70-89%)",
                "description": "Clear story arc; minor ambiguity on individual vs team contribution.",
            },
            {
                "label": "Developing (<70%)",
                "description": "Vague timelines, missing metrics, or abrupt endings.",
            },
        ],
    },
    {
        "key": "technical_rigor",
        "title": "Domain & Technical Depth",
        "weight_pct": 35,
        "description": (
            "Specificity in describing architectural trade-offs, domain execution, "
            "tech stacks, or user research methodologies."
        ),
        "levels": [
            {
                "label": "Exceptional (90-100%)",
                "description": "Names specific tooling, edge cases considered, and trade-offs.",
            },
            {
                "label": "Competent (70-89%)",
                "description": "Accurate terminology with solid general problem-solving rationale.",
            },
            {
                "label": "Developing (<70%)",
                "description": "High-level buzzwords without practical implementation depth.",
            },
        ],
    },
    {
        "key": "empathy",
        "title": "Startup Pace & Ownership Mindset",
        "weight_pct": 20,
        "description": (
            "Demonstrating proactive problem solving, stakeholder empathy, bias for action, "
            "and ability to operate under ambiguity."
        ),
        "levels": [
            {
                "label": "Exceptional (90-100%)",
                "description": "Takes full ownership from discovery through post-launch iteration.",
            },
            {
                "label": "Competent (70-89%)",
                "description": "Collaborative team player who asks good clarifying questions.",
            },
            {
                "label": "Developing (<70%)",
                "description": "Passively waits for instructions or deflects ownership.",
            },
        ],
    },
    {
        "key": "clarity",
        "title": "Pacing & Conciseness",
        "weight_pct": 15,
        "description": "Clear, direct communication with concise framing and minimal filler.",
        "levels": [
            {
                "label": "Exceptional (90-100%)",
                "description": "Focused, well-paced answers with clear takeaways.",
            },
            {
                "label": "Competent (70-89%)",
                "description": "Understandable delivery with occasional tangents.",
            },
            {
                "label": "Developing (<70%)",
                "description": "Overly verbose or lacks a clear conclusion.",
            },
        ],
    },
]

_DEFAULT_PROMPTS: dict[str, list[str]] = {
    "Behavioral & Leadership": [
        "Tell me about a high-stakes conflict or tradeoff you navigated across teams.",
        "Describe a time you took ownership of an ambiguous problem with tight constraints.",
        "Walk me through a launch or decision that didn't go as planned and what you changed.",
        "How do you prioritize competing stakeholder requests when resources are scarce?",
        "Give an example of mentoring or raising the bar for peers under deadline pressure.",
    ],
    "Technical & Architecture": [
        "Walk through a complex system or architecture you designed and the key tradeoffs made.",
        "Describe a performance, reliability, or scalability bottleneck you diagnosed and fixed.",
        "How do you balance shipping quickly in an early-stage startup with maintainability?",
        "Tell me about a technical pushback you gave or received and how it was resolved.",
        "How do you validate quality, edge cases, and observability before shipping to users?",
    ],
    "Founder Culture Fit": [
        "Why do you want to work in an early-stage startup environment right now?",
        "Tell me about a time you wore multiple hats outside your formal role to ship an outcome.",
        "How do you operate when product direction shifts week to week?",
        "Describe a customer insight that changed your product or engineering approach.",
        "What is the hardest feedback you received recently and how did you act on it?",
    ],
}


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def _rate_limit(user: User, limit: int, window: int, kind: str) -> None:
    if not await rate_limiter.check(f"practice:{kind}:{user.id}", limit, window):
        raise rate_limited("Too many requests. Please slow down.")


async def owned_session_or_404(
    db: AsyncSession,
    user: User,
    session_id: uuid.UUID,
    *,
    with_turns: bool = True,
) -> PracticeSession:
    stmt = select(PracticeSession).where(
        PracticeSession.id == session_id,
        PracticeSession.user_id == user.id,
        PracticeSession.deleted_at.is_(None),
    )
    if with_turns:
        stmt = stmt.options(selectinload(PracticeSession.turns))
    session = (await db.execute(stmt)).scalar_one_or_none()
    if session is None:
        raise not_found("Practice session not found.")
    return session


def _serialize_drill(drill: PracticeDrill) -> dict:
    return {
        "id": drill.id,
        "category": drill.category,
        "title": drill.title,
        "difficulty": drill.difficulty,
        "duration_min": drill.duration_min,
        "description": drill.description,
        "prompts": list(drill.prompts or []),
        "rubric": dict(drill.rubric or {}),
        "is_active": drill.is_active,
        "created_at": drill.created_at,
        "updated_at": drill.updated_at,
    }


def _serialize_turn(turn: PracticeTranscriptTurn) -> dict:
    return {
        "id": turn.id,
        "session_id": turn.session_id,
        "speaker": turn.speaker,
        "content": turn.content,
        "question_index": turn.question_index,
        "created_at": turn.created_at,
    }


def _serialize_session_item(session: PracticeSession) -> dict:
    return {
        "id": session.id,
        "drill_id": session.drill_id,
        "title": session.title,
        "target_role": session.target_role,
        "focus_area": session.focus_area,
        "difficulty": session.difficulty,
        "question_count": session.question_count,
        "status": session.status,
        "score": session.score,
        "duration_sec": session.duration_sec,
        "started_at": session.started_at,
        "completed_at": session.completed_at,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
    }


def _serialize_session(session: PracticeSession) -> dict:
    data = _serialize_session_item(session)
    data.update(
        {
            "questions": list(session.questions or []),
            "clarity": session.clarity,
            "structure": session.structure,
            "empathy": session.empathy,
            "technical_rigor": session.technical_rigor,
            "feedback": session.feedback,
            "turns": [_serialize_turn(t) for t in (session.turns or [])],
        }
    )
    return data


def _build_initial_questions(
    *,
    drill: PracticeDrill | None,
    target_role: str | None,
    focus_area: str | None,
    question_count: int,
) -> list[str]:
    if drill is not None and drill.prompts:
        base = [str(p).strip() for p in drill.prompts if str(p).strip()]
    else:
        pool = _DEFAULT_PROMPTS.get(focus_area or "", _DEFAULT_PROMPTS["Behavioral & Leadership"])
        role_prefix = f"For a {target_role} role: " if target_role else ""
        base = [f"{role_prefix}{q}" for q in pool]
    if not base:
        base = list(_DEFAULT_PROMPTS["Behavioral & Leadership"])
    out: list[str] = []
    for i in range(question_count):
        out.append(base[i % len(base)])
    return out


async def list_drills(
    db: AsyncSession,
    user: User,
    *,
    category: str | None = None,
    difficulty: str | None = None,
    q: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(user, settings.PRACTICE_READ_LIMIT, settings.PRACTICE_READ_WINDOW_SECONDS, "read")

    filters: list[ColumnElement[bool]] = [PracticeDrill.is_active.is_(True)]
    if category:
        filters.append(PracticeDrill.category == category)
    if difficulty:
        filters.append(PracticeDrill.difficulty == difficulty)
    if q:
        pattern = f"%{_escape_like(q.strip())}%"
        filters.append(
            or_(
                PracticeDrill.title.ilike(pattern),
                PracticeDrill.description.ilike(pattern),
                PracticeDrill.category.ilike(pattern),
            )
        )

    total = int(
        (await db.execute(select(func.count()).select_from(PracticeDrill).where(*filters))).scalar_one()
    )
    rows = (
        (
            await db.execute(
                select(PracticeDrill)
                .where(*filters)
                .order_by(PracticeDrill.category.asc(), PracticeDrill.title.asc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return {
        "items": [_serialize_drill(d) for d in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": (offset + len(rows)) < total,
    }


async def get_drill(db: AsyncSession, user: User, drill_id: uuid.UUID) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(user, settings.PRACTICE_READ_LIMIT, settings.PRACTICE_READ_WINDOW_SECONDS, "read")

    drill = (
        await db.execute(
            select(PracticeDrill).where(
                PracticeDrill.id == drill_id,
                PracticeDrill.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()
    if drill is None:
        raise not_found("Practice drill not found.")
    return _serialize_drill(drill)


async def create_session(
    db: AsyncSession, user: User, payload: PracticeSessionCreate
) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.PRACTICE_WRITE_LIMIT, settings.PRACTICE_WRITE_WINDOW_SECONDS, "write"
    )

    drill: PracticeDrill | None = None
    if payload.drill_id is not None:
        drill = (
            await db.execute(
                select(PracticeDrill).where(
                    PracticeDrill.id == payload.drill_id,
                    PracticeDrill.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()
        if drill is None:
            raise not_found("Practice drill not found.")

    focus_area = payload.focus_area or (drill.category if drill else "Behavioral & Leadership")
    title = payload.title or (
        drill.title
        if drill
        else f"{payload.target_role or 'Interview'} · {focus_area}"
    )
    difficulty = drill.difficulty if drill and not payload.target_role else payload.difficulty
    questions = _build_initial_questions(
        drill=drill,
        target_role=payload.target_role,
        focus_area=focus_area,
        question_count=payload.question_count,
    )

    session = PracticeSession(
        user_id=user.id,
        drill_id=drill.id if drill else None,
        title=title,
        target_role=payload.target_role,
        focus_area=focus_area,
        difficulty=difficulty,
        question_count=payload.question_count,
        questions=questions,
        status="scheduled",
    )
    db.add(session)
    await db.commit()
    db.expire(session, ["turns"])
    loaded = await owned_session_or_404(db, user, session.id)
    return _serialize_session(loaded)


async def list_sessions(
    db: AsyncSession,
    user: User,
    *,
    status: str | None = None,
    sort: str = "created_at",
    order: str = "desc",
    limit: int = 20,
    offset: int = 0,
) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(user, settings.PRACTICE_READ_LIMIT, settings.PRACTICE_READ_WINDOW_SECONDS, "read")

    filters = [
        PracticeSession.user_id == user.id,
        PracticeSession.deleted_at.is_(None),
    ]
    if status:
        filters.append(PracticeSession.status == status)

    total = int(
        (await db.execute(select(func.count()).select_from(PracticeSession).where(*filters))).scalar_one()
    )
    sort_col = PracticeSession.score if sort == "score" else PracticeSession.created_at
    order_expr = sort_col.asc() if order == "asc" else sort_col.desc()

    rows = (
        (
            await db.execute(
                select(PracticeSession)
                .where(*filters)
                .order_by(order_expr, PracticeSession.id.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return {
        "items": [_serialize_session_item(s) for s in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": (offset + len(rows)) < total,
    }


async def summary(db: AsyncSession, user: User) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(user, settings.PRACTICE_READ_LIMIT, settings.PRACTICE_READ_WINDOW_SECONDS, "read")

    base = [
        PracticeSession.user_id == user.id,
        PracticeSession.deleted_at.is_(None),
    ]
    total_sessions = int(
        (await db.execute(select(func.count()).select_from(PracticeSession).where(*base))).scalar_one()
    )
    completed_sessions = int(
        (
            await db.execute(
                select(func.count())
                .select_from(PracticeSession)
                .where(*base, PracticeSession.status == "completed")
            )
        ).scalar_one()
    )
    avg_raw = (
        await db.execute(
            select(func.avg(PracticeSession.score)).where(
                *base, PracticeSession.score.is_not(None)
            )
        )
    ).scalar_one()
    best_raw = (
        await db.execute(
            select(func.max(PracticeSession.score)).where(
                *base, PracticeSession.score.is_not(None)
            )
        )
    ).scalar_one()
    dur_raw = (
        await db.execute(
            select(func.coalesce(func.sum(PracticeSession.duration_sec), 0)).where(*base)
        )
    ).scalar_one()

    return {
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
        "avg_score": round(float(avg_raw)) if avg_raw is not None else None,
        "best_score": int(best_raw) if best_raw is not None else None,
        "total_practice_min": round(int(dur_raw or 0) / 60),
    }


async def get_session(db: AsyncSession, user: User, session_id: uuid.UUID) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(user, settings.PRACTICE_READ_LIMIT, settings.PRACTICE_READ_WINDOW_SECONDS, "read")
    session = await owned_session_or_404(db, user, session_id)
    return _serialize_session(session)


async def start_session(db: AsyncSession, user: User, session_id: uuid.UUID) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.PRACTICE_WRITE_LIMIT, settings.PRACTICE_WRITE_WINDOW_SECONDS, "write"
    )
    session = await owned_session_or_404(db, user, session_id)
    if session.status in ("completed", "abandoned"):
        raise validation_error("Cannot start a session that is already finished.")

    now = datetime.now(UTC)
    if session.status == "scheduled":
        session.status = "in_progress"
        session.started_at = now
        session.updated_at = now

    if not session.turns and session.questions:
        first_q = str(session.questions[0])
        db.add(
            PracticeTranscriptTurn(
                session_id=session.id,
                speaker="interviewer",
                content=first_q,
                question_index=0,
            )
        )

    await db.commit()
    db.expire(session, ["turns"])
    loaded = await owned_session_or_404(db, user, session.id)
    return _serialize_session(loaded)


async def submit_turn(
    db: AsyncSession,
    user: User,
    session_id: uuid.UUID,
    payload: PracticeTurnCreate,
) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(user, settings.PRACTICE_AI_LIMIT, settings.PRACTICE_AI_WINDOW_SECONDS, "ai")

    session = await owned_session_or_404(db, user, session_id)
    if session.status in ("completed", "abandoned"):
        raise validation_error("Cannot add turns to a finished session.")

    candidate_turns = [t for t in session.turns if t.speaker == "candidate"]
    if len(candidate_turns) >= session.question_count * 2:
        raise validation_error("Maximum turns reached for this session. Request your score report.")

    now = datetime.now(UTC)
    if session.status == "scheduled":
        session.status = "in_progress"
        session.started_at = now

    q_idx = (
        payload.question_index
        if payload.question_index is not None
        else min(len(candidate_turns), max(0, session.question_count - 1))
    )
    candidate_turn = PracticeTranscriptTurn(
        session_id=session.id,
        speaker="candidate",
        content=payload.content,
        question_index=q_idx,
    )
    db.add(candidate_turn)
    await db.flush()

    next_q_idx = q_idx + 1
    is_final = next_q_idx >= session.question_count
    next_prompt = (
        str(session.questions[next_q_idx])
        if not is_final and next_q_idx < len(session.questions)
        else ""
    )

    history_lines = [
        f"{t.speaker.upper()}: {t.content}" for t in session.turns[-6:]
    ] + [f"CANDIDATE: {payload.content}"]
    context_text = (
        f"Target Role: {session.target_role or 'General'}\n"
        f"Focus Area: {session.focus_area or 'Interview'}\n"
        f"Difficulty: {session.difficulty}\n"
        f"Question {q_idx + 1} of {session.question_count}\n"
        + (f"Next planned question: {next_prompt}\n" if next_prompt else "This was the final question.\n")
        + "\n=== RECENT TRANSCRIPT ===\n"
        + "\n".join(history_lines)
    )

    ai_out, model_name, in_tok, out_tok = await ai_practice_service.generate_interviewer_turn(
        context_text
    )

    interviewer_turn = PracticeTranscriptTurn(
        session_id=session.id,
        speaker="interviewer",
        content=ai_out.reply,
        question_index=q_idx if ai_out.is_follow_up else min(next_q_idx, session.question_count - 1),
    )
    db.add(interviewer_turn)
    db.add(
        AiUsageEvent(
            user_id=user.id,
            feature="practice_turn",
            model=model_name,
            input_tokens=in_tok,
            output_tokens=out_tok,
        )
    )
    session.updated_at = now
    await db.commit()
    await db.refresh(candidate_turn)
    await db.refresh(interviewer_turn)

    return {
        "candidate_turn": _serialize_turn(candidate_turn),
        "interviewer_turn": _serialize_turn(interviewer_turn),
        "is_final_question": is_final,
        "ai_notice": ai_practice_service.AI_TURN_NOTICE,
    }


async def delete_session(db: AsyncSession, user: User, session_id: uuid.UUID) -> None:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.PRACTICE_WRITE_LIMIT, settings.PRACTICE_WRITE_WINDOW_SECONDS, "write"
    )
    session = await owned_session_or_404(db, user, session_id, with_turns=False)
    now = datetime.now(UTC)
    session.deleted_at = now
    session.updated_at = now
    await db.commit()


async def get_rubric(db: AsyncSession, user: User) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(user, settings.PRACTICE_READ_LIMIT, settings.PRACTICE_READ_WINDOW_SECONDS, "read")
    return {"criteria": PLATFORM_RUBRIC}


def _compute_weighted_score(*, clarity: int, structure: int, empathy: int, technical_rigor: int) -> int:
    weighted = (
        structure * 0.30
        + technical_rigor * 0.35
        + empathy * 0.20
        + clarity * 0.15
    )
    return max(0, min(100, round(weighted)))


def _build_dimensions(session: PracticeSession, notes: dict[str, str] | None = None) -> list[dict]:
    notes = notes or {}
    return [
        {
            "key": "structure",
            "label": "Structural Clarity & STAR Framework",
            "weight_pct": 30,
            "score": int(session.structure or 0),
            "note": notes.get("structure") or "Evaluated on Situation, Task, Action, and Result framing.",
        },
        {
            "key": "technical_rigor",
            "label": "Domain & Technical Depth",
            "weight_pct": 35,
            "score": int(session.technical_rigor or 0),
            "note": notes.get("technical_rigor") or "Evaluated on domain specificity and trade-off rigor.",
        },
        {
            "key": "empathy",
            "label": "Startup Pace & Ownership Mindset",
            "weight_pct": 20,
            "score": int(session.empathy or 0),
            "note": notes.get("empathy") or "Evaluated on ownership, collaboration, and user empathy.",
        },
        {
            "key": "clarity",
            "label": "Pacing & Conciseness",
            "weight_pct": 15,
            "score": int(session.clarity or 0),
            "note": notes.get("clarity") or "Evaluated on conciseness and clarity of delivery.",
        },
    ]


async def _sync_user_readiness_practice(db: AsyncSession, user_id: uuid.UUID) -> None:
    avg_raw = (
        await db.execute(
            select(func.avg(PracticeSession.score)).where(
                PracticeSession.user_id == user_id,
                PracticeSession.deleted_at.is_(None),
                PracticeSession.score.is_not(None),
            )
        )
    ).scalar_one()
    if avg_raw is None:
        return
    practice_score = max(0, min(100, round(float(avg_raw))))
    row = (
        await db.execute(select(UserReadiness).where(UserReadiness.user_id == user_id))
    ).scalar_one_or_none()
    if row is None:
        return
    row.practice_score = practice_score
    row.overall_score = round((row.profile_complete + row.resume_score + practice_score) / 3)


async def score_session(
    db: AsyncSession,
    user: User,
    session_id: uuid.UUID,
    *,
    duration_sec: int | None = None,
) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(user, settings.PRACTICE_AI_LIMIT, settings.PRACTICE_AI_WINDOW_SECONDS, "ai")

    session = await owned_session_or_404(db, user, session_id)
    candidate_turns = [t for t in session.turns if t.speaker == "candidate"]
    if not candidate_turns:
        raise validation_error("Submit at least one answer before scoring this session.")

    transcript_lines = [
        f"Target Role: {session.target_role or 'General'}",
        f"Focus Area: {session.focus_area or 'Interview'}",
        f"Difficulty: {session.difficulty}",
        "=== TRANSCRIPT ===",
        *[f"{t.speaker.upper()}: {t.content}" for t in session.turns],
    ]
    ai_out, model_name, in_tok, out_tok = await ai_practice_service.score_transcript(
        "\n".join(transcript_lines)
    )

    now = datetime.now(UTC)
    session.clarity = ai_out.clarity
    session.structure = ai_out.structure
    session.empathy = ai_out.empathy
    session.technical_rigor = ai_out.technical_rigor
    session.score = _compute_weighted_score(
        clarity=ai_out.clarity,
        structure=ai_out.structure,
        empathy=ai_out.empathy,
        technical_rigor=ai_out.technical_rigor,
    )
    session.feedback = ai_out.feedback
    session.status = "completed"
    session.completed_at = now
    if duration_sec is not None:
        session.duration_sec = duration_sec
    elif session.started_at is not None and session.duration_sec is None:
        started = session.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=UTC)
        session.duration_sec = max(0, int((now - started).total_seconds()))
    session.updated_at = now

    db.add(
        AiUsageEvent(
            user_id=user.id,
            feature="practice_score",
            model=model_name,
            input_tokens=in_tok,
            output_tokens=out_tok,
        )
    )
    await _sync_user_readiness_practice(db, user.id)
    await db.commit()

    loaded = await owned_session_or_404(db, user, session.id)
    notes = {
        "clarity": ai_out.clarity_note,
        "structure": ai_out.structure_note,
        "empathy": ai_out.empathy_note,
        "technical_rigor": ai_out.technical_rigor_note,
    }
    return {
        "session": _serialize_session(loaded),
        "dimensions": _build_dimensions(loaded, notes),
        "ai_notice": ai_practice_service.AI_SCORE_NOTICE,
    }


async def get_report(db: AsyncSession, user: User, session_id: uuid.UUID) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(user, settings.PRACTICE_READ_LIMIT, settings.PRACTICE_READ_WINDOW_SECONDS, "read")

    session = await owned_session_or_404(db, user, session_id)
    if session.status != "completed" or session.score is None:
        raise validation_error("Session has not been scored yet.")
    return {
        "session": _serialize_session(session),
        "dimensions": _build_dimensions(session),
        "ai_notice": ai_practice_service.AI_SCORE_NOTICE,
    }
