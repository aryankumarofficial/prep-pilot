import hashlib
import secrets
from datetime import timedelta
from typing import Annotated

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .db import aware, utcnow
from .models import LoginSession, RateWindow, User

passwords = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
DUMMY_HASH = passwords.hash(secrets.token_urlsafe(24))
COOKIE = "preppilot_session"


def database(request: Request):
    with request.app.state.sessions() as db:
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise


# Commit or roll back before any successful response is sent to the browser.
# Request-scoped cleanup runs too late to report a failed commit correctly.
DB = Annotated[Session, Depends(database, scope="function")]


def rate_limit(request: Request, namespace: str, subject: str, limit: int, seconds: int):
    """Atomic database counter shared across API workers; never trust proxy-supplied IPs."""
    now = utcnow()
    window = int(now.timestamp()) // seconds
    digest = hashlib.sha256(subject.encode()).hexdigest()
    key = f"{namespace}:{digest}:{window}"
    with request.app.state.sessions() as db:
        try:
            with db.begin_nested():
                if db.get(RateWindow, key) is None:
                    db.add(RateWindow(key=key, count=0, expires_at=now + timedelta(seconds=seconds * 2)))
                    db.flush()
        except IntegrityError:
            pass  # Another worker initialized this window.
        changed = db.execute(
            update(RateWindow)
            .where(RateWindow.key == key, RateWindow.count < limit)
            .values(count=RateWindow.count + 1)
        ).rowcount
        db.commit()
    if not changed:
        retry = seconds - int(now.timestamp()) % seconds
        raise HTTPException(
            429, "Usage limit reached. Please try again later.", headers={"Retry-After": str(retry)}
        )


def verify_password(hash_value: str, password: str) -> bool:
    try:
        return passwords.verify(hash_value, password)
    except (VerificationError, InvalidHashError):
        return False


def current_user(request: Request, db: DB) -> User:
    raw = request.cookies.get(COOKIE, "")
    session = db.get(LoginSession, hashlib.sha256(raw.encode()).hexdigest()) if raw else None
    if session is None or aware(session.expires_at) <= utcnow():
        raise HTTPException(401, "Please sign in to continue.")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        csrf = request.headers.get("X-CSRF-Token", "")
        if not csrf or not secrets.compare_digest(csrf, session.csrf_token):
            raise HTTPException(403, "Your session needs refreshing. Reload and try again.")
    user = db.get(User, session.user_id)
    if user is None:
        raise HTTPException(401, "Please sign in to continue.")
    request.state.login_session = session
    return user


Student = Annotated[User, Depends(current_user)]


def create_session(request: Request, response: Response, db: Session, user: User):
    old = request.cookies.get(COOKIE)
    if old:
        session = db.get(LoginSession, hashlib.sha256(old.encode()).hexdigest())
        if session:
            db.delete(session)
    raw = secrets.token_urlsafe(48)
    csrf = secrets.token_hex(32)
    hours = request.app.state.settings.session_hours
    db.add(
        LoginSession(
            token_hash=hashlib.sha256(raw.encode()).hexdigest(),
            user_id=user.id,
            csrf_token=csrf,
            expires_at=utcnow() + timedelta(hours=hours),
        )
    )
    response.set_cookie(
        COOKIE,
        raw,
        httponly=True,
        secure=request.app.state.settings.cookie_secure,
        samesite="lax",
        max_age=hours * 3600,
        path="/",
    )
    return csrf


def owned(db: Session, model, record_id: str, user: User, *, lock: bool = False):
    statement = select(model).where(model.id == str(record_id), model.user_id == user.id)
    if lock:
        statement = statement.with_for_update()
    value = db.scalar(statement)
    if value is None:
        raise HTTPException(404, "This record was not found.")
    return value
