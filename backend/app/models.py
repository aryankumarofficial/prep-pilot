from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy import UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base, uid, utcnow

Json = JSON().with_variant(JSONB, "postgresql")


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    full_name: Mapped[str] = mapped_column(String(80))
    target_role: Mapped[str] = mapped_column(String(80), default="Java Developer")
    daily_minutes: Mapped[int] = mapped_column(Integer, default=60)
    target_date: Mapped[date] = mapped_column(Date)
    timezone: Mapped[str] = mapped_column(String(80), default="Asia/Kolkata")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (CheckConstraint("daily_minutes >= 15 AND daily_minutes <= 480"),)


class LoginSession(Base):
    __tablename__ = "login_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    csrf_token: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class RateWindow(Base):
    __tablename__ = "rate_windows"
    key: Mapped[str] = mapped_column(String(180), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class Skill(Base):
    __tablename__ = "skills"
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    base_minutes: Mapped[int] = mapped_column(Integer)


class RoleSkill(Base):
    __tablename__ = "role_skills"
    role: Mapped[str] = mapped_column(String(80), primary_key=True)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"), primary_key=True)
    relevance: Mapped[float] = mapped_column(Float)
    __table_args__ = (CheckConstraint("relevance >= 0 AND relevance <= 1"),)


class Prerequisite(Base):
    __tablename__ = "skill_prerequisites"
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"), primary_key=True)
    prerequisite_id: Mapped[str] = mapped_column(ForeignKey("skills.id"), primary_key=True)
    __table_args__ = (CheckConstraint("skill_id != prerequisite_id"),)


class Resource(Base):
    __tablename__ = "resources"
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    url: Mapped[str] = mapped_column(Text)
    resource_type: Mapped[str] = mapped_column(String(30), default="Documentation")
    difficulty: Mapped[str] = mapped_column(String(30), default="Foundation")
    publisher: Mapped[str] = mapped_column(String(100))
    reviewed_on: Mapped[date] = mapped_column(Date)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Bookmark(Base):
    __tablename__ = "bookmarks"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    resource_id: Mapped[str] = mapped_column(ForeignKey("resources.id"), primary_key=True)


class QuestionVersion(Base):
    __tablename__ = "question_versions"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    question_key: Mapped[str] = mapped_column(String(50))
    revision: Mapped[int] = mapped_column(Integer, default=1)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"), index=True)
    prompt: Mapped[str] = mapped_column(Text)
    options: Mapped[list] = mapped_column(Json)
    correct_option: Mapped[str] = mapped_column(String(5))
    explanation: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[str] = mapped_column(String(20), default="Foundation")
    reviewed_on: Mapped[date] = mapped_column(Date)
    __table_args__ = (UniqueConstraint("question_key", "revision"),)


class Assessment(Base):
    __tablename__ = "assessments"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    kind: Mapped[str] = mapped_column(String(30))
    category: Mapped[str | None] = mapped_column(String(40))
    duration_seconds: Mapped[int] = mapped_column(Integer)
    published: Mapped[bool] = mapped_column(Boolean, default=True)


class AssessmentQuestion(Base):
    __tablename__ = "assessment_questions"
    assessment_id: Mapped[str] = mapped_column(ForeignKey("assessments.id"), primary_key=True)
    question_version_id: Mapped[str] = mapped_column(ForeignKey("question_versions.id"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer)


class Attempt(Base):
    __tablename__ = "assessment_attempts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    assessment_id: Mapped[str] = mapped_column(ForeignKey("assessments.id"), index=True)
    request_key: Mapped[str] = mapped_column(String(36))
    status: Mapped[str] = mapped_column(String(30), default="in_progress")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    score: Mapped[float | None] = mapped_column(Float)
    correct_count: Mapped[int | None] = mapped_column(Integer)
    total_count: Mapped[int] = mapped_column(Integer)
    __table_args__ = (UniqueConstraint("user_id", "request_key"),)


class AttemptQuestion(Base):
    __tablename__ = "attempt_questions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    attempt_id: Mapped[str] = mapped_column(
        ForeignKey("assessment_attempts.id", ondelete="CASCADE"), index=True
    )
    question_version_id: Mapped[str] = mapped_column(ForeignKey("question_versions.id"))
    position: Mapped[int] = mapped_column(Integer)
    snapshot: Mapped[dict] = mapped_column(Json)
    selected_option: Mapped[str | None] = mapped_column(String(5))
    __table_args__ = (UniqueConstraint("attempt_id", "position"),)


class SkillEvidence(Base):
    __tablename__ = "skill_evidence"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"), index=True)
    attempt_id: Mapped[str] = mapped_column(ForeignKey("assessment_attempts.id", ondelete="CASCADE"))
    correct_count: Mapped[int] = mapped_column(Integer)
    total_count: Mapped[int] = mapped_column(Integer)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (UniqueConstraint("attempt_id", "skill_id"),)


class Roadmap(Base):
    __tablename__ = "roadmaps"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    current_version: Mapped[int] = mapped_column(Integer, default=0)
    job_description_id: Mapped[str | None] = mapped_column(
        ForeignKey("job_descriptions.id", ondelete="SET NULL")
    )


class RoadmapVersion(Base):
    __tablename__ = "roadmap_versions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    roadmap_id: Mapped[str] = mapped_column(ForeignKey("roadmaps.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    trigger_key: Mapped[str] = mapped_column(String(100))
    change_reason: Mapped[str] = mapped_column(Text)
    job_title: Mapped[str | None] = mapped_column(String(160))
    target_date: Mapped[date] = mapped_column(Date)
    daily_minutes: Mapped[int] = mapped_column(Integer)
    unscheduled: Mapped[list] = mapped_column(Json)
    evidence: Mapped[list] = mapped_column(Json)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        UniqueConstraint("roadmap_id", "version"),
        UniqueConstraint("roadmap_id", "trigger_key"),
    )


class RoadmapTask(Base):
    __tablename__ = "roadmap_tasks"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    roadmap_id: Mapped[str] = mapped_column(ForeignKey("roadmaps.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[str | None] = mapped_column(ForeignKey("skills.id"))
    title: Mapped[str] = mapped_column(String(200))
    task_type: Mapped[str] = mapped_column(String(30))
    resource_id: Mapped[str | None] = mapped_column(ForeignKey("resources.id"))
    assessment_id: Mapped[str | None] = mapped_column(ForeignKey("assessments.id"))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ScheduledTask(Base):
    __tablename__ = "scheduled_tasks"
    version_id: Mapped[str] = mapped_column(
        ForeignKey("roadmap_versions.id", ondelete="CASCADE"), primary_key=True
    )
    task_id: Mapped[str] = mapped_column(ForeignKey("roadmap_tasks.id", ondelete="CASCADE"), primary_key=True)
    planned_date: Mapped[date] = mapped_column(Date)
    planned_minutes: Mapped[int] = mapped_column(Integer)
    position: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text)
    __table_args__ = (CheckConstraint("planned_minutes > 0"),)


class Resume(Base):
    __tablename__ = "resumes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(180))
    storage_key: Mapped[str] = mapped_column(String(80), unique=True)
    extracted_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class JobDescription(Base):
    __tablename__ = "job_descriptions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    resume_id: Mapped[str | None] = mapped_column(ForeignKey("resumes.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(160))
    raw_text: Mapped[str] = mapped_column(Text)
    analysis: Mapped[dict | None] = mapped_column(Json)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Interview(Base):
    __tablename__ = "interviews"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    job_description_id: Mapped[str | None] = mapped_column(
        ForeignKey("job_descriptions.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(String(30), default="active")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class InterviewTurn(Base):
    __tablename__ = "interview_turns"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    interview_id: Mapped[str] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    question_key: Mapped[str] = mapped_column(String(60))
    question: Mapped[str] = mapped_column(Text)
    rubric: Mapped[str] = mapped_column(Text)
    answer: Mapped[str | None] = mapped_column(Text)
    feedback: Mapped[dict | None] = mapped_column(Json)
    feedback_status: Mapped[str] = mapped_column(String(30), default="pending")
    __table_args__ = (UniqueConstraint("interview_id", "position"),)


class LLMRun(Base):
    __tablename__ = "llm_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(50))
    model: Mapped[str] = mapped_column(String(160))
    prompt_version: Mapped[str] = mapped_column(String(20), default="v1")
    status: Mapped[str] = mapped_column(String(30))
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
