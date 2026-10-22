import secrets
from collections import defaultdict
from datetime import timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from .db import aware, utcnow
from .models import (
    Assessment,
    AssessmentQuestion,
    Attempt,
    AttemptQuestion,
    QuestionVersion,
    Roadmap,
    RoadmapTask,
)
from .models import RoadmapVersion, SkillEvidence, User
from .roadmaps import make_plan
from .schemas import SaveAnswer, StartAttempt
from .security import DB, Student, owned

router = APIRouter(prefix="/api/v1", tags=["Assessments"])


def attempt_payload(db, attempt):
    assessment = db.get(Assessment, attempt.assessment_id)
    finished = attempt.status != "in_progress"
    plan_update = (
        db.scalar(
            select(RoadmapVersion.version)
            .join(Roadmap)
            .where(Roadmap.user_id == attempt.user_id, RoadmapVersion.trigger_key == f"attempt:{attempt.id}")
        )
        if finished
        else None
    )
    questions = []
    for q in db.scalars(
        select(AttemptQuestion)
        .where(AttemptQuestion.attempt_id == attempt.id)
        .order_by(AttemptQuestion.position)
    ):
        value = {
            "id": q.id,
            "prompt": q.snapshot["prompt"],
            "options": q.snapshot["options"],
            "skill_id": q.snapshot["skill_id"],
            "selected_option": q.selected_option,
        }
        if finished:
            value.update(
                {
                    "correct_option": q.snapshot["correct_option"],
                    "explanation": q.snapshot["explanation"],
                    "source_url": q.snapshot["source_url"],
                    "is_correct": q.selected_option == q.snapshot["correct_option"],
                }
            )
        questions.append(value)
    return {
        "id": attempt.id,
        "assessment_id": attempt.assessment_id,
        "title": assessment.title,
        "status": attempt.status,
        "started_at": aware(attempt.started_at),
        "expires_at": aware(attempt.expires_at),
        "server_now": utcnow(),
        "plan_update_version": plan_update,
        "score": attempt.score,
        "correct_count": attempt.correct_count,
        "total_count": attempt.total_count,
        "submitted_at": aware(attempt.submitted_at) if attempt.submitted_at else None,
        "questions": questions,
    }


@router.get("/assessments")
def list_assessments(db: DB, user: Student):
    counts = defaultdict(int)
    for row in db.scalars(select(AssessmentQuestion)):
        counts[row.assessment_id] += 1
    return [
        {
            "id": a.id,
            "title": a.title,
            "kind": a.kind,
            "category": a.category,
            "duration_seconds": a.duration_seconds,
            "question_count": counts[a.id],
        }
        for a in db.scalars(select(Assessment).where(Assessment.published.is_(True)).order_by(Assessment.id))
    ]


@router.post("/assessments/{assessment_id}/attempts", status_code=201)
def start(assessment_id: str, payload: StartAttempt, db: DB, user: Student):
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    assessment = db.get(Assessment, assessment_id)
    if not assessment or not assessment.published:
        raise HTTPException(404, "This assessment is not available.")
    prior = db.scalar(
        select(Attempt).where(Attempt.user_id == user.id, Attempt.request_key == str(payload.request_key))
    )
    if prior:
        if prior.assessment_id != assessment_id:
            raise HTTPException(409, "This request key belongs to another assessment.")
        return attempt_payload(db, prior)
    ongoing = db.scalar(
        select(Attempt).where(
            Attempt.user_id == user.id,
            Attempt.assessment_id == assessment_id,
            Attempt.status == "in_progress",
        )
    )
    if ongoing:
        return attempt_payload(db, ongoing)
    question_ids = db.scalars(
        select(AssessmentQuestion.question_version_id).where(
            AssessmentQuestion.assessment_id == assessment_id
        )
    ).all()
    versions = list(db.scalars(select(QuestionVersion).where(QuestionVersion.id.in_(question_ids))))
    if not versions:
        raise HTTPException(409, "This assessment has no published questions.")
    secrets.SystemRandom().shuffle(versions)
    attempt = Attempt(
        user_id=user.id,
        assessment_id=assessment.id,
        request_key=str(payload.request_key),
        expires_at=utcnow() + timedelta(seconds=assessment.duration_seconds),
        total_count=len(versions),
    )
    db.add(attempt)
    db.flush()
    for i, q in enumerate(versions):
        options = list(q.options)
        secrets.SystemRandom().shuffle(options)
        snapshot = {
            "prompt": q.prompt,
            "options": options,
            "skill_id": q.skill_id,
            "correct_option": q.correct_option,
            "explanation": q.explanation,
            "source_url": q.source_url,
        }
        db.add(
            AttemptQuestion(attempt_id=attempt.id, question_version_id=q.id, position=i, snapshot=snapshot)
        )
    db.flush()
    return attempt_payload(db, attempt)


@router.get("/attempts")
def history(db: DB, user: Student):
    rows = db.execute(
        select(Attempt, Assessment)
        .join(Assessment)
        .where(Attempt.user_id == user.id)
        .order_by(Attempt.started_at.desc())
        .limit(50)
    ).all()
    return [
        {
            "id": a.id,
            "title": test.title,
            "assessment_id": test.id,
            "status": a.status,
            "score": a.score,
            "started_at": aware(a.started_at),
            "total_count": a.total_count,
        }
        for a, test in rows
    ]


@router.get("/attempts/{attempt_id}")
def get_attempt(attempt_id: str, db: DB, user: Student):
    return attempt_payload(db, owned(db, Attempt, attempt_id, user))


@router.post("/attempts/{attempt_id}/answers")
def save(attempt_id: str, payload: SaveAnswer, db: DB, user: Student):
    attempt = owned(db, Attempt, attempt_id, user, lock=True)
    if attempt.status != "in_progress" or utcnow() >= aware(attempt.expires_at):
        raise HTTPException(409, "The assessment has ended. Submit it to see your results.")
    question = db.scalar(
        select(AttemptQuestion).where(
            AttemptQuestion.id == str(payload.question_id), AttemptQuestion.attempt_id == attempt.id
        )
    )
    if question is None:
        raise HTTPException(404, "This question is not part of the attempt.")
    question.selected_option = payload.selected_option
    return {"saved": True, "question_id": question.id, "selected_option": question.selected_option}


@router.post("/attempts/{attempt_id}/submit")
def submit(attempt_id: str, db: DB, user: Student):
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    attempt = owned(db, Attempt, attempt_id, user, lock=True)
    if attempt.status != "in_progress":
        return attempt_payload(db, attempt)
    now = utcnow()
    attempt.status = "expired" if now >= aware(attempt.expires_at) else "submitted"
    attempt.submitted_at = now
    by_skill = defaultdict(lambda: [0, 0])
    for q in db.scalars(select(AttemptQuestion).where(AttemptQuestion.attempt_id == attempt.id)):
        if q.selected_option is None:
            continue  # Omitted items lower the test score, but are not measured skill evidence.
        by_skill[q.snapshot["skill_id"]][0] += int(q.selected_option == q.snapshot["correct_option"])
        by_skill[q.snapshot["skill_id"]][1] += 1
    attempt.correct_count = sum(values[0] for values in by_skill.values())
    attempt.score = round(100 * attempt.correct_count / attempt.total_count, 1)
    for skill_id, (correct, total) in by_skill.items():
        db.add(
            SkillEvidence(
                user_id=user.id,
                skill_id=skill_id,
                attempt_id=attempt.id,
                correct_count=correct,
                total_count=total,
                observed_at=now,
            )
        )
    roadmap = db.scalar(select(Roadmap).where(Roadmap.user_id == user.id))
    if roadmap and by_skill:
        task = db.scalar(
            select(RoadmapTask)
            .where(
                RoadmapTask.roadmap_id == roadmap.id,
                RoadmapTask.assessment_id == attempt.assessment_id,
                RoadmapTask.completed_at.is_(None),
            )
            .order_by(RoadmapTask.id)
        )
        if task:
            task.completed_at = now
    db.flush()
    assessment = db.get(Assessment, attempt.assessment_id)
    if by_skill:
        make_plan(
            db,
            user,
            f"attempt:{attempt.id}",
            f"{assessment.title} completed at {attempt.score:g}%. Future tasks reprioritized using answered-question evidence.",
        )
    return attempt_payload(db, attempt)
