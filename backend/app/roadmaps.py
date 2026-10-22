from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select

from .db import aware
from .evidence import skill_summary
from .models import (
    JobDescription,
    Prerequisite,
    Resource,
    Roadmap,
    RoadmapTask,
    RoadmapVersion,
    RoleSkill,
    ScheduledTask,
    User,
)
from .planning import Topic, schedule


def local_today(user):
    return datetime.now(ZoneInfo(user.timezone)).date()


def make_plan(db, user, trigger_key: str, reason: str):
    # Serialize all plan changes for this student, including the first-ever plan.
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    scores = skill_summary(db, user.id)
    if not any(s["score"] is not None for s in scores):
        raise HTTPException(409, "Complete a diagnostic assessment before creating your plan.")
    roadmap = db.scalar(select(Roadmap).where(Roadmap.user_id == user.id))
    if roadmap is None:
        roadmap = Roadmap(user_id=user.id)
        db.add(roadmap)
        db.flush()
    old = db.scalar(
        select(RoadmapVersion).where(
            RoadmapVersion.roadmap_id == roadmap.id, RoadmapVersion.trigger_key == trigger_key
        )
    )
    if old:
        return old
    prerequisites = {}
    for row in db.scalars(select(Prerequisite)):
        prerequisites.setdefault(row.skill_id, []).append(row.prerequisite_id)
    relevance = dict(
        db.execute(
            select(RoleSkill.skill_id, RoleSkill.relevance).where(RoleSkill.role == user.target_role)
        ).all()
    )
    job = db.get(JobDescription, roadmap.job_description_id) if roadmap.job_description_id else None
    if job and job.analysis:
        required = {s["skill_id"] for s in job.analysis["required_skills"]}
        foundations = set()
        remaining = list(required)
        while remaining:
            skill_id = remaining.pop()
            for parent in prerequisites.get(skill_id, []):
                if parent not in foundations:
                    foundations.add(parent)
                    remaining.append(parent)
        # Keep general role foundations while moving explicit JD requirements earlier.
        relevance = {
            skill_id: 1.0 if skill_id in required else 0.95 if skill_id in foundations else value * 0.4
            for skill_id, value in relevance.items()
        }
        reason += f" Target job: {job.title}."
    topics = [
        Topic(
            s["id"],
            s["name"],
            relevance.get(s["id"], 0),
            s["score"],
            tuple(prerequisites.get(s["id"], [])),
            s["reliable"],
        )
        for s in scores
    ]
    completed_rows = db.scalars(
        select(RoadmapTask).where(RoadmapTask.roadmap_id == roadmap.id, RoadmapTask.completed_at.is_not(None))
    ).all()
    completed = {t.id.split("/", 1)[1] for t in completed_rows}
    previous = db.scalar(
        select(RoadmapVersion).where(
            RoadmapVersion.roadmap_id == roadmap.id, RoadmapVersion.version == roadmap.current_version
        )
    )
    today = local_today(user)
    preserved = []
    if previous:
        preserved = db.scalars(
            select(ScheduledTask)
            .join(RoadmapTask)
            .where(ScheduledTask.version_id == previous.id, RoadmapTask.completed_at.is_not(None))
        ).all()
    used_today = sum(t.planned_minutes for t in preserved if t.planned_date == today)
    result = schedule(topics, today, user.target_date, user.daily_minutes, completed, used_today)
    roadmap.current_version += 1
    version = RoadmapVersion(
        roadmap_id=roadmap.id,
        version=roadmap.current_version,
        trigger_key=trigger_key,
        change_reason=reason,
        target_date=user.target_date,
        daily_minutes=user.daily_minutes,
        unscheduled=result["unscheduled"],
        evidence=scores,
        job_title=job.title if job else None,
    )
    # Datetimes in the evidence snapshot are encoded deliberately, not left to the DB JSON adapter.
    version.evidence = [
        {**s, "last_assessed": aware(s["last_assessed"]).isoformat() if s["last_assessed"] else None}
        for s in scores
    ]
    db.add(version)
    db.flush()
    for i, old_task in enumerate(preserved):
        db.add(
            ScheduledTask(
                version_id=version.id,
                task_id=old_task.task_id,
                planned_date=old_task.planned_date,
                planned_minutes=old_task.planned_minutes,
                position=i,
                reason=old_task.reason,
            )
        )
    resource_ids = set(db.scalars(select(Resource.id).where(Resource.active.is_(True))))
    for i, task in enumerate(result["tasks"]):
        task_id = f"{roadmap.id}/{task['key']}"
        if db.get(RoadmapTask, task_id) is None:
            assessment = None
            if task["task_type"] == "mock":
                assessment = "mixed-mock"
            elif task["task_type"] == "revision":
                assessment = f"milestone-{task['key'].rsplit(':', 1)[-1]}"
            db.add(
                RoadmapTask(
                    id=task_id,
                    roadmap_id=roadmap.id,
                    skill_id=task["skill_id"],
                    title=task["title"],
                    task_type=task["task_type"],
                    resource_id=task["skill_id"] if task["skill_id"] in resource_ids else None,
                    assessment_id=assessment,
                )
            )
            db.flush()
        db.add(
            ScheduledTask(
                version_id=version.id,
                task_id=task_id,
                planned_date=task["planned_date"],
                planned_minutes=task["planned_minutes"],
                position=i + len(preserved),
                reason=task["reason"],
            )
        )
    db.flush()
    return version


def plan_payload(db, user, version_number=None):
    roadmap = db.scalar(select(Roadmap).where(Roadmap.user_id == user.id))
    if not roadmap:
        return None
    version = db.scalar(
        select(RoadmapVersion).where(
            RoadmapVersion.roadmap_id == roadmap.id,
            RoadmapVersion.version == (version_number or roadmap.current_version),
        )
    )
    if not version:
        raise HTTPException(404, "This roadmap version was not found.")
    rows = db.execute(
        select(ScheduledTask, RoadmapTask, Resource)
        .join(RoadmapTask, RoadmapTask.id == ScheduledTask.task_id)
        .outerjoin(Resource, RoadmapTask.resource_id == Resource.id)
        .where(ScheduledTask.version_id == version.id)
        .order_by(ScheduledTask.position)
    ).all()
    tasks = [
        {
            "id": t.id,
            "title": t.title,
            "skill_id": t.skill_id,
            "task_type": t.task_type,
            "planned_date": s.planned_date,
            "planned_minutes": s.planned_minutes,
            "reason": s.reason,
            "completed": t.completed_at is not None,
            "assessment_id": t.assessment_id,
            "resource": {"title": r.title, "url": r.url} if r else None,
        }
        for s, t, r in rows
    ]
    versions = db.scalars(
        select(RoadmapVersion)
        .where(RoadmapVersion.roadmap_id == roadmap.id)
        .order_by(RoadmapVersion.version.desc())
    ).all()
    return {
        "id": roadmap.id,
        "version": version.version,
        "current_version": roadmap.current_version,
        "job_title": version.job_title,
        "change_reason": version.change_reason,
        "target_date": version.target_date,
        "daily_minutes": version.daily_minutes,
        "unscheduled": version.unscheduled,
        "created_at": aware(version.created_at),
        "tasks": tasks,
        "evidence": version.evidence,
        "versions": [
            {"version": v.version, "change_reason": v.change_reason, "created_at": aware(v.created_at)}
            for v in versions
        ],
    }
