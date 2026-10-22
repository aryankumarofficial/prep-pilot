import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import make_url

from app.config import Settings
from app.db import Base
from app.main import create_app
from app.seed import seed


@pytest.fixture
def application(tmp_path):
    url = os.getenv("TEST_DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    if url.startswith("postgresql") and not (make_url(url).database or "").endswith("_test"):
        raise RuntimeError("Tests only reset PostgreSQL databases whose name ends in _test")
    app = create_app(
        Settings(
            app_env="test",
            database_url=url,
            upload_dir=tmp_path / "uploads",
            frontend_origins=["http://testserver"],
            openrouter_api_key="",
            openrouter_model="",
        )
    )
    Base.metadata.drop_all(app.state.engine)
    Base.metadata.create_all(app.state.engine)
    with app.state.sessions.begin() as db:
        seed(db)
    yield app
    Base.metadata.drop_all(app.state.engine)
    app.state.engine.dispose()


def register(client, email=None):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email or f"{uuid4()}@example.com",
            "password": "A long test password 123!",
            "full_name": "Test Student",
        },
    )
    assert response.status_code == 201, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    return response.json()["user"]


@pytest.fixture
def client(application):
    with TestClient(application) as c:
        register(c)
        yield c
