from datetime import timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from .db import aware, uid, utcnow
from .evidence import skill_summary
from .models import Attempt, Bookmark, Interview, Resource, Roadmap, RoadmapTask, User
from .roadmaps import local_today, make_plan, plan_payload
from .schemas import CompleteTask, Login, Profile, Recalculate, Register
from .security import COOKIE, DB, DUMMY_HASH, Student, create_session, passwords, rate_limit, verify_password

router = APIRouter(prefix="/api/v1", tags=["Workspace"])


def profile(user):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "target_role": user.target_role,
        "target_date": user.target_date,
        "daily_minutes": user.daily_minutes,
        "timezone": user.timezone,
    }


@router.get("/capabilities")
def capabilities(request: Request):
    return {
        "ai_enabled": request.app.state.settings.ai_enabled,
        "ai_status": request.app.state.settings.ai_status,
        "max_upload_mb": request.app.state.settings.max_upload_mb,
        "roles": ["Java Developer"],
        "resume_retention_days": request.app.state.settings.resume_retention_days,
        "starter_bank": True,
    }


@router.post("/auth/register", status_code=201)
def register(payload: Register, request: Request, response: Response, db: DB):
    rate_limit(request, "register", request.client.host if request.client else "unknown", 10, 3600)
    email = str(payload.email).lower().strip()
    user = User(
        email=email,
        password_hash=passwords.hash(payload.password),
        full_name=payload.full_name,
        target_date=(utcnow().astimezone(ZoneInfo("Asia/Kolkata")) + timedelta(days=30)).date(),
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists. Please sign in.") from error
    csrf = create_session(request, response, db, user)
    return {"user": profile(user), "csrf_token": csrf}


@router.post("/auth/login")
def login(payload: Login, request: Request, response: Response, db: DB):
    rate_limit(request, "login", request.client.host if request.client else "unknown", 20, 900)
    user = db.scalar(select(User).where(User.email == str(payload.email).lower().strip()))
    valid = verify_password(user.password_hash if user else DUMMY_HASH, payload.password)
    if not user or not valid:
        raise HTTPException(401, "The email or password is incorrect.")
    if passwords.check_needs_rehash(user.password_hash):
        user.password_hash = passwords.hash(payload.password)
    csrf = create_session(request, response, db, user)
    return {"user": profile(user), "csrf_token": csrf}


@router.get("/auth/session")
def session(request: Request, user: Student):
    return {"user": profile(user), "csrf_token": request.state.login_session.csrf_token}


@router.post("/auth/logout")
def logout(request: Request, response: Response, db: DB, user: Student):
    db.delete(request.state.login_session)
    response.delete_cookie(
        COOKIE, path="/", secure=request.app.state.settings.cookie_secure, httponly=True, samesite="lax"
    )
    return {"logged_out": True}


@router.patch("/users/me")
def update_profile(payload: Profile, db: DB, user: Student):
    # Lock before updating the row so concurrent submissions share the same ordering.
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    today = utcnow().astimezone(ZoneInfo(payload.timezone)).date()
    if not today <= payload.target_date <= today + timedelta(days=365):
        raise HTTPException(422, "Choose a target date between today and one year from today.")
    for key, value in payload.model_dump().items():
        setattr(user, key, value)
    db.flush()
    if db.scalar(select(Roadmap).where(Roadmap.user_id == user.id)):
        make_plan(
            db,
            user,
            f"profile:{uid()}",
            "Study availability or profile updated. Completed tasks were preserved.",
        )
    return profile(user)


@router.get("/skills")
def skills(db: DB, user: Student):
    return skill_summary(db, user.id)


@router.get("/resources")
def resources(db: DB, user: Student, skill_id: str | None = None):
    saved = set(db.scalars(select(Bookmark.resource_id).where(Bookmark.user_id == user.id)))
    statement = select(Resource).where(Resource.active.is_(True)).order_by(Resource.skill_id)
    if skill_id:
        statement = statement.where(Resource.skill_id == skill_id)
    return [
        {
            "id": r.id,
            "skill_id": r.skill_id,
            "title": r.title,
            "url": r.url,
            "resource_type": r.resource_type,
            "difficulty": r.difficulty,
            "publisher": r.publisher,
            "reviewed_on": r.reviewed_on,
            "bookmarked": r.id in saved,
        }
        for r in db.scalars(statement)
    ]


@router.post("/resources/{resource_id}/bookmark")
def bookmark(resource_id: str, db: DB, user: Student):
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    if not db.get(Resource, resource_id):
        raise HTTPException(404, "This resource was not found.")
    if not db.get(Bookmark, (user.id, resource_id)):
        db.add(Bookmark(user_id=user.id, resource_id=resource_id))
    return {"bookmarked": True}


@router.delete("/resources/{resource_id}/bookmark")
def unbookmark(resource_id: str, db: DB, user: Student):
    record = db.get(Bookmark, (user.id, resource_id))
    if record:
        db.delete(record)
    return {"bookmarked": False}


@router.get("/roadmaps/current")
def get_plan(db: DB, user: Student, version: int | None = None):
    return plan_payload(db, user, version)


@router.post("/roadmaps/recalculate")
@router.post("/roadmaps/generate")
def generate(payload: Recalculate, db: DB, user: Student):
    make_plan(
        db,
        user,
        f"manual:{payload.request_key}",
        "Plan refreshed for the remaining time and current evidence.",
    )
    return plan_payload(db, user)


@router.patch("/roadmap-tasks/{task_id:path}")
def complete(task_id: str, payload: CompleteTask, db: DB, user: Student):
    task = db.scalar(
        select(RoadmapTask).join(Roadmap).where(RoadmapTask.id == task_id, Roadmap.user_id == user.id)
    )
    if not task:
        raise HTTPException(404, "This task was not found.")
    if task.assessment_id:
        raise HTTPException(409, "Complete the linked assessment to finish this milestone.")
    task.completed_at = utcnow() if payload.completed else None
    return {"completed": payload.completed}


@router.get("/dashboard/summary")
def dashboard(db: DB, user: Student):
    scores = skill_summary(db, user.id)
    measured = [s for s in scores if s["score"] is not None]
    plan = plan_payload(db, user)
    attempts = (
        db.execute(
            select(
                Attempt,
            )
            .where(Attempt.user_id == user.id, Attempt.status != "in_progress")
            .order_by(Attempt.submitted_at.desc())
            .limit(30)
        )
        .scalars()
        .all()
    )
    today = local_today(user)
    tasks = plan["tasks"] if plan else []
    upcoming = sorted([t for t in tasks if not t["completed"]], key=lambda t: t["planned_date"])
    if not measured:
        action = {
            "title": "Find your starting point",
            "description": "Take a 15-minute diagnostic to build your first plan.",
            "path": "/assessments",
        }
    elif upcoming:
        action = {"title": upcoming[0]["title"], "description": upcoming[0]["reason"], "path": "/roadmap"}
    else:
        action = {
            "title": "Review your next milestone",
            "description": "Test your progress on a fresh set of questions.",
            "path": "/assessments",
        }
    interviews = db.scalar(select(func.count()).select_from(Interview).where(Interview.user_id == user.id))
    assessment_count = db.scalar(
        select(func.count())
        .select_from(Attempt)
        .where(Attempt.user_id == user.id, Attempt.status != "in_progress")
    )
    return {
        "profile": profile(user),
        "skills": scores,
        "plan": plan,
        "next_action": action,
        "stats": {
            "assessments": assessment_count,
            "interviews": interviews,
            "coverage": round(100 * len(measured) / len(scores)) if scores else 0,
            "completed_tasks": sum(t["completed"] for t in tasks),
            "total_tasks": len(tasks),
            "days_remaining": max(0, (user.target_date - today).days + 1),
        },
        "today": today,
        "recent_results": [
            {"id": a.id, "score": a.score, "assessment_id": a.assessment_id, "date": aware(a.submitted_at)}
            for a in attempts[:8]
        ][::-1],
    }
