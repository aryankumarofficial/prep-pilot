"""Run daily: python -m app.maintenance. Uses the same environment as the API."""

from datetime import timedelta

from sqlalchemy import delete, select

from .config import Settings
from .db import make_database, utcnow
from .models import JobDescription, LoginSession, RateWindow, Resume


def main():
    settings = Settings()
    engine, sessions = make_database(settings.database_url)
    removed = 0
    with sessions.begin() as db:
        expired = db.scalars(
            select(Resume).where(
                Resume.created_at < utcnow() - timedelta(days=settings.resume_retention_days)
            )
        ).all()
        for resume in expired:
            for job in db.scalars(select(JobDescription).where(JobDescription.resume_id == resume.id)):
                job.analysis, job.resume_id = None, None
            (settings.upload_dir.resolve() / resume.storage_key).unlink(missing_ok=True)
            db.delete(resume)
            removed += 1
        db.execute(delete(LoginSession).where(LoginSession.expires_at < utcnow()))
        db.execute(delete(RateWindow).where(RateWindow.expires_at < utcnow()))
    engine.dispose()
    print(f"Removed {removed} expired resumes and expired session/rate-limit records.")


if __name__ == "__main__":
    main()
