from collections import defaultdict
from datetime import timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.db import utcnow
from app.models import Attempt, AttemptQuestion, RoadmapVersion, SkillEvidence
from .conftest import register


def start(client, assessment="diagnostic"):
    response = client.post(f"/api/v1/assessments/{assessment}/attempts", json={"request_key": str(uuid4())})
    assert response.status_code == 201, response.text
    return response.json()


def complete(client, application, assessment="diagnostic", correct=True):
    attempt = start(client, assessment)
    with application.state.sessions() as db:
        answers = {
            q.id: q.snapshot["correct_option"]
            for q in db.scalars(select(AttemptQuestion).where(AttemptQuestion.attempt_id == attempt["id"]))
        }
    for question in attempt["questions"]:
        option = (
            answers[question["id"]]
            if correct
            else next(o["id"] for o in question["options"] if o["id"] != answers[question["id"]])
        )
        response = client.post(
            f"/api/v1/attempts/{attempt['id']}/answers",
            json={"question_id": question["id"], "selected_option": option},
        )
        assert response.status_code == 200, response.text
    response = client.post(f"/api/v1/attempts/{attempt['id']}/submit")
    assert response.status_code == 200, response.text
    return response.json()


def test_complete_adaptive_journey(client, application):
    initial = client.get("/api/v1/dashboard/summary").json()
    assert initial["stats"]["coverage"] == 0
    assert all(s["score"] is None for s in initial["skills"])
    result = complete(client, application, correct=False)
    assert result["score"] == 0
    plan = client.get("/api/v1/roadmaps/current").json()
    assert plan["version"] == 1 and plan["tasks"]
    daily = defaultdict(int)
    for task in plan["tasks"]:
        daily[task["planned_date"]] += task["planned_minutes"]
    assert max(daily.values()) <= plan["daily_minutes"]
    learning = next(t for t in plan["tasks"] if t["task_type"] == "learn")
    path = f"/api/v1/roadmap-tasks/{learning['id']}"
    assert client.patch(path, json={"completed": True}).status_code == 200
    scores_before = client.get("/api/v1/skills").json()
    assert client.get("/api/v1/skills").json() == scores_before
    complete(client, application, "milestone-sql", correct=True)
    updated = client.get("/api/v1/roadmaps/current").json()
    assert updated["version"] == 2
    assert any(t["id"] == learning["id"] and t["completed"] for t in updated["tasks"])
    sql_scores = [s for s in client.get("/api/v1/skills").json() if s["category"] == "DBMS / SQL"]
    assert all(s["score"] > 0 and s["unique_questions"] == 4 for s in sql_scores)
    assert "milestone" in updated["change_reason"]
    assert client.get("/api/v1/roadmaps/current?version=1").json()["version"] == 1


def test_attempt_resume_and_answer_keys_are_private(client):
    attempt = start(client)
    assert all("correct_option" not in q and "explanation" not in q for q in attempt["questions"])
    q = attempt["questions"][0]
    client.post(
        f"/api/v1/attempts/{attempt['id']}/answers", json={"question_id": q["id"], "selected_option": "b"}
    )
    resumed = client.get(f"/api/v1/attempts/{attempt['id']}").json()
    assert resumed["expires_at"] == attempt["expires_at"]
    assert resumed["questions"][0]["selected_option"] == "b"
    assert resumed["questions"][0]["options"] == q["options"]
    assert start(client)["id"] == attempt["id"]


def test_repeated_submission_has_one_result_and_plan(client, application):
    attempt = complete(client, application)
    repeated = client.post(f"/api/v1/attempts/{attempt['id']}/submit", json={"score": 0}).json()
    assert repeated["score"] == 100
    with application.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(RoadmapVersion)) == 1
        assert db.scalar(select(func.count()).select_from(SkillEvidence)) == 12


def test_deadline_enforced_by_server(client, application):
    attempt = start(client)
    with application.state.sessions.begin() as db:
        row = db.get(Attempt, attempt["id"])
        row.expires_at = utcnow() - timedelta(seconds=1)
    q = attempt["questions"][0]
    assert (
        client.post(
            f"/api/v1/attempts/{attempt['id']}/answers", json={"question_id": q["id"], "selected_option": "a"}
        ).status_code
        == 409
    )
    result = client.post(f"/api/v1/attempts/{attempt['id']}/submit").json()
    assert result["status"] == "expired" and result["score"] == 0


def test_cross_user_attempt_and_task_access(client, application):
    result = complete(client, application)
    task = client.get("/api/v1/roadmaps/current").json()["tasks"][0]
    with TestClient(application) as other:
        register(other)
        assert other.get(f"/api/v1/attempts/{result['id']}").status_code == 404
        assert other.post(f"/api/v1/attempts/{result['id']}/submit").status_code == 404
        assert other.patch(f"/api/v1/roadmap-tasks/{task['id']}", json={"completed": True}).status_code == 404
        assert other.get("/api/v1/roadmaps/current").json() is None


def test_manual_recalculation_idempotency(client, application):
    complete(client, application)
    payload = {"request_key": str(uuid4())}
    a = client.post("/api/v1/roadmaps/recalculate", json=payload)
    b = client.post("/api/v1/roadmaps/recalculate", json=payload)
    assert a.status_code == b.status_code == 200
    assert a.json()["version"] == b.json()["version"] == 2


def test_bookmarks_are_persistent_and_private(client, application):
    resource = client.get("/api/v1/resources").json()[0]
    for _ in range(2):
        assert client.post(f"/api/v1/resources/{resource['id']}/bookmark").status_code == 200
    assert client.get("/api/v1/resources").json()[0]["bookmarked"]
    with TestClient(application) as other:
        register(other)
        assert not other.get("/api/v1/resources").json()[0]["bookmarked"]
    client.delete(f"/api/v1/resources/{resource['id']}/bookmark")
    assert not client.get("/api/v1/resources").json()[0]["bookmarked"]


def test_csrf_origin_and_logout(client):
    payload = {"request_key": str(uuid4())}
    token = client.headers.pop("X-CSRF-Token")
    assert client.post("/api/v1/assessments/diagnostic/attempts", json=payload).status_code == 403
    client.headers["X-CSRF-Token"] = token
    assert (
        client.post(
            "/api/v1/assessments/diagnostic/attempts",
            json=payload,
            headers={"Origin": "https://evil.example"},
        ).status_code
        == 403
    )
    assert client.post("/api/v1/auth/logout").status_code == 200
    assert client.get("/api/v1/auth/session").status_code == 401


def test_validation_does_not_echo_password(client):
    secret = "private-short"
    response = client.post(
        "/api/v1/auth/register", json={"email": "invalid", "password": secret, "full_name": "X"}
    )
    assert response.status_code == 422 and secret not in response.text
