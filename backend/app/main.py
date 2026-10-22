import logging
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from starlette.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import api, assessments
from .config import Settings
from .db import make_database
from .llm import LLMClient

log = logging.getLogger("preppilot")


class RequestGuard:
    def __init__(self, app, settings):
        self.app, self.settings = app, settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope["headers"])
        request_id = str(uuid4())
        scope.setdefault("state", {})["request_id"] = request_id

        async def fail(status, message):
            await JSONResponse(
                {"error": {"code": status, "message": message, "request_id": request_id}}, status_code=status
            )(scope, receive, send)

        origin = headers.get(b"origin", b"").decode()
        if (
            scope["method"] not in {"GET", "HEAD", "OPTIONS"}
            and origin
            and origin not in self.settings.frontend_origins
        ):
            return await fail(403, "This request origin is not allowed.")
        # Bound bytes before multipart parsing can spool unbounded input to disk.
        limit = (self.settings.max_upload_mb + 1) * 1024 * 1024
        content_length = headers.get(b"content-length", b"0")
        try:
            if int(content_length) > limit:
                return await fail(413, "This upload is too large.")
        except ValueError:
            return await fail(400, "Invalid Content-Length.")
        chunks, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body = message.get("body", b"")
            size += len(body)
            if size > limit:
                return await fail(413, "This upload is too large.")
            chunks.append(body)
            if not message.get("more_body", False):
                break
        supplied = False

        async def replay():
            nonlocal supplied
            if not supplied:
                supplied = True
                return {"type": "http.request", "body": b"".join(chunks), "more_body": False}
            return await receive()

        async def secured(message):
            if message["type"] == "http.response.start":
                message["headers"] = list(message["headers"]) + [
                    (b"x-request-id", request_id.encode()),
                    (b"x-content-type-options", b"nosniff"),
                    (b"referrer-policy", b"strict-origin-when-cross-origin"),
                    (b"x-frame-options", b"DENY"),
                    (b"cache-control", b"no-store"),
                    (
                        b"content-security-policy",
                        (
                            b"default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https://fastapi.tiangolo.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
                            if scope["path"] == "/docs" and self.settings.app_env != "production"
                            else b"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
                        ),
                    ),
                ]
            await send(message)

        await self.app(scope, replay, secured)


def create_app(settings: Settings | None = None):
    settings = settings or Settings()
    engine, sessions = make_database(settings.database_url)

    @asynccontextmanager
    async def lifespan(app):
        yield
        engine.dispose()

    app = FastAPI(
        title="PrepPilot AI",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.app_env != "production" else None,
        redoc_url=None,
    )
    app.state.settings, app.state.engine, app.state.sessions = settings, engine, sessions
    app.state.llm = LLMClient(settings)
    app.add_middleware(RequestGuard, settings=settings)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
    )

    @app.exception_handler(StarletteHTTPException)
    async def expected_error(request: Request, error: StarletteHTTPException):
        return JSONResponse(
            {
                "error": {
                    "code": error.status_code,
                    "message": error.detail,
                    "request_id": request.state.request_id,
                }
            },
            status_code=error.status_code,
            headers=error.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def invalid_input(request: Request, error: RequestValidationError):
        # Do not echo submitted passwords, resume text or other sensitive values.
        fields = [".".join(str(v) for v in e["loc"][1:]) for e in error.errors()]
        return JSONResponse(
            {
                "error": {
                    "code": 422,
                    "message": "Check these fields: " + ", ".join(fields),
                    "request_id": request.state.request_id,
                }
            },
            status_code=422,
        )

    @app.exception_handler(Exception)
    async def unexpected(request: Request, error: Exception):
        log.error("request_failed request_id=%s type=%s", request.state.request_id, type(error).__name__)
        return JSONResponse(
            {
                "error": {
                    "code": 500,
                    "message": "Something went wrong. Please try again.",
                    "request_id": request.state.request_id,
                }
            },
            status_code=500,
        )

    @app.get("/health/live")
    def live():
        return {"status": "ok"}

    @app.get("/health/ready")
    def ready():
        try:
            with engine.connect() as connection:
                count = connection.execute(
                    text("SELECT count(*) FROM assessments WHERE published = true")
                ).scalar()
                if not count:
                    return JSONResponse({"status": "unavailable"}, status_code=503)
            return {"status": "ready"}
        except Exception:
            return JSONResponse({"status": "unavailable"}, status_code=503)

    app.include_router(api.router)
    app.include_router(assessments.router)
    from . import ai_routes

    app.include_router(ai_routes.router)
    dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    if dist.is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{path:path}")
        def frontend(path: str):
            if path == "api" or path.startswith("api/") or path.startswith("health/"):
                raise HTTPException(404, "This endpoint was not found.")
            return FileResponse(dist / "index.html")

    return app


app = create_app()
