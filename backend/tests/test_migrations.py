import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from .test_journey import start


def test_migration_round_trip_and_schema_match(tmp_path):
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{tmp_path / 'migration.db'}", "APP_ENV": "test"}
    for arguments in [["upgrade", "head"], ["downgrade", "base"], ["upgrade", "head"], ["check"]]:
        result = subprocess.run(
            [sys.executable, "-m", "alembic", *arguments], env=env, capture_output=True, text=True
        )
        assert result.returncode == 0, result.stderr


def test_concurrent_postgres_submissions(client, application):
    if application.state.engine.dialect.name != "postgresql":
        pytest.skip("Row-lock concurrency is verified against PostgreSQL in CI")
    attempt = start(client)
    cookies, headers = dict(client.cookies), dict(client.headers)

    def submit():
        with TestClient(application, cookies=cookies, headers=headers) as connection:
            return connection.post(f"/api/v1/attempts/{attempt['id']}/submit")

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: submit(), range(2)))
    assert all(r.status_code == 200 for r in results)
    assert results[0].json()["score"] == results[1].json()["score"]
    assert client.get("/api/v1/roadmaps/current").json()["version"] == 1
