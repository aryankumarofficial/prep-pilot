import io
import json
from zipfile import ZipFile

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.llm import AIUnavailable, LLMClient
from app.models import JobDescription, Resume
from app.schemas import InterviewFeedback, SkillExtraction
from .conftest import register
from .test_journey import complete


def docx_bytes(
    text="Student project: Java objects and SQL joins. Implemented a library catalogue with tests.",
):
    output = io.BytesIO()
    with ZipFile(output, "w") as archive:
        archive.writestr(
            "word/document.xml",
            f'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>',
        )
    return output.getvalue()


def create_job(client, resume_id=None):
    response = client.post(
        "/api/v1/job-descriptions",
        json={
            "title": "Junior Java Developer",
            "raw_text": "We require Java objects and SQL joins for a junior developer working on backend services.",
            "resume_id": resume_id,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_resume_extraction_and_cross_user_deletion(client, application):
    upload = client.post(
        "/api/v1/resumes",
        files={
            "file": (
                "resume.docx",
                docx_bytes(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
    )
    assert upload.status_code == 201, upload.text
    resume = upload.json()
    assert "extracted_text" not in resume and "storage_key" not in resume
    job = create_job(client, resume["id"])
    with application.state.sessions.begin() as db:
        row = db.get(Resume, resume["id"])
        path = application.state.settings.upload_dir / row.storage_key
        assert path.exists() and "Java objects" in row.extracted_text
        db.get(JobDescription, job["id"]).analysis = {"private": "source snippet"}
    with TestClient(application) as other:
        register(other)
        assert other.delete(f"/api/v1/resumes/{resume['id']}").status_code == 404
        assert other.get("/api/v1/resumes").json() == []
        assert other.post(f"/api/v1/job-descriptions/{job['id']}/analyze").status_code == 404
    assert client.delete(f"/api/v1/resumes/{resume['id']}").status_code == 200
    assert not path.exists()
    assert client.get("/api/v1/job-descriptions").json()[0]["analysis"] is None


@pytest.mark.parametrize(
    "filename,content,mime",
    [
        ("resume.pdf", b"not a pdf", "application/pdf"),
        ("resume.exe", b"MZ", "application/octet-stream"),
        (
            "resume.docx",
            docx_bytes("too short"),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
    ],
)
def test_invalid_uploads(client, filename, content, mime):
    response = client.post("/api/v1/resumes", files={"file": (filename, content, mime)})
    assert response.status_code == 422
    assert client.get("/api/v1/resumes").json() == []


def test_ai_disabled_preserves_draft_and_core_features(client):
    job = create_job(client)
    assert client.post(f"/api/v1/job-descriptions/{job['id']}/analyze").status_code == 503
    assert client.get("/api/v1/job-descriptions").json()[0]["id"] == job["id"]
    assert client.get("/api/v1/assessments").status_code == 200


class ExtractionAI:
    def structured(self, schema, instruction, data):
        return schema.model_validate(
            {"required_skills": [{"skill_id": "sql-joins", "evidence": "SQL joins"}], "resume_skills": []}
        ), {"prompt_tokens": 100, "completion_tokens": 30}


def test_verified_job_requirements_change_plan_priority(client, application):
    complete(client, application, correct=False)
    old = client.get("/api/v1/roadmaps/current").json()
    job = create_job(client)
    application.state.settings.openrouter_api_key = "test-only"
    application.state.settings.openrouter_model = "test/model"
    application.state.llm = ExtractionAI()
    assert client.post(f"/api/v1/job-descriptions/{job['id']}/analyze").status_code == 200
    targeted = client.post(f"/api/v1/job-descriptions/{job['id']}/target")
    assert targeted.status_code == 200, targeted.text
    plan = targeted.json()
    assert plan["version"] == old["version"] + 1 and plan["job_title"] == job["title"]
    first_sql_before = next(i for i, t in enumerate(old["tasks"]) if t["skill_id"] == "sql-select")
    first_sql_after = next(i for i, t in enumerate(plan["tasks"]) if t["skill_id"] == "sql-select")
    assert first_sql_after < first_sql_before
    assert client.post(f"/api/v1/job-descriptions/{job['id']}/target").json()["version"] == plan["version"]


def test_semantically_false_ai_evidence_is_rejected(client, application):
    class BadAI:
        def structured(self, schema, instruction, data):
            return schema.model_validate(
                {
                    "required_skills": [{"skill_id": "sql-joins", "evidence": "invented quote"}],
                    "resume_skills": [],
                }
            ), {"prompt_tokens": 0, "completion_tokens": 0}

    application.state.settings.openrouter_api_key = "test-only"
    application.state.settings.openrouter_model = "test/model"
    application.state.llm = BadAI()
    job = create_job(client)
    assert client.post(f"/api/v1/job-descriptions/{job['id']}/analyze").status_code == 503
    assert client.get("/api/v1/job-descriptions").json()[0]["analysis"] is None


def test_interview_persistence_idempotency_and_unscored_fallback(client, application):
    session = client.post("/api/v1/interviews", json={}).json()
    payload = {
        "turn_id": session["turns"][0]["id"],
        "answer": "I would explain the concept and demonstrate it with an example.",
    }
    first = client.post(f"/api/v1/interviews/{session['id']}/turns", json=payload)
    assert first.status_code == 200, first.text
    assert len(first.json()["turns"]) == 2
    assert first.json()["turns"][0]["feedback_status"] == "unavailable"
    second = client.post(f"/api/v1/interviews/{session['id']}/turns", json=payload)
    assert len(second.json()["turns"]) == 2 and second.json()["score"] is None
    assert client.get(f"/api/v1/interviews/{session['id']}").json()["turns"][0]["answer"] == payload["answer"]
    with TestClient(application) as other:
        register(other)
        assert other.get(f"/api/v1/interviews/{session['id']}").status_code == 404
        assert other.post(f"/api/v1/interviews/{session['id']}/finish").status_code == 404
    finished = client.post(f"/api/v1/interviews/{session['id']}/finish").json()
    assert finished["score"] is None and finished["status"] == "finished"


@pytest.mark.parametrize("kind", ["bad-json", "empty", "timeout", "busy"])
def test_llm_failure_contract(kind):
    def handler(request):
        if kind == "timeout":
            raise httpx.ReadTimeout("timeout")
        if kind == "busy":
            return httpx.Response(429, headers={"Retry-After": "60"})
        return httpx.Response(
            200, json={"choices": [{"message": {"content": "not json" if kind == "bad-json" else ""}}]}
        )

    settings = Settings(openrouter_api_key="test-only", openrouter_model="test/model")
    client = LLMClient(settings, transport=httpx.MockTransport(handler))
    with pytest.raises(AIUnavailable):
        client.structured(SkillExtraction, "test instruction", {"source": "private text"})


def test_llm_validates_schema_and_sends_privacy_requirements():
    def handler(request):
        payload = json.loads(request.content)
        assert payload["provider"]["require_parameters"] and payload["provider"]["zdr"]
        assert payload["provider"]["data_collection"] == "deny"
        assert payload["response_format"]["type"] == "json_schema"
        answer = {
            "correctness": 2,
            "clarity": 3,
            "completeness": 2,
            "examples": 1,
            "strengths": ["Clear opening"],
            "improvements": ["Give a specific example"],
            "follow_up": None,
        }
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": json.dumps(answer)}}],
                "usage": {"prompt_tokens": 40, "completion_tokens": 30},
            },
        )

    client = LLMClient(
        Settings(openrouter_api_key="test-only", openrouter_model="test/model"),
        transport=httpx.MockTransport(handler),
    )
    result, usage = client.structured(InterviewFeedback, "test instruction", {})
    assert result.correctness == 2 and usage["prompt_tokens"] == 40
