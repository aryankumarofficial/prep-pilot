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


def test_ai_disabled_still_compares_catalogue_skills(client):
    job = create_job(client)
    result = client.post(f"/api/v1/job-descriptions/{job['id']}/analyze")
    assert result.status_code == 200, result.text
    assert result.json()["analysis"]["method"] == "catalogue"
    assert {match["skill_id"] for match in result.json()["analysis"]["required_skills"]} >= {
        "java-types",
        "sql-joins",
    }
    assert result.json()["analysis"]["resume_skills"] == []
    assert (
        client.post(f"/api/v1/job-descriptions/{job['id']}/analyze", json={"method": "ai"}).status_code == 503
    )
    assert client.get("/api/v1/job-descriptions").json()[0]["id"] == job["id"]
    assert client.get("/api/v1/assessments").status_code == 200


def test_catalogue_comparison_persists_resume_evidence_and_can_change_resume(client):
    upload = client.post(
        "/api/v1/resumes", files={"file": ("student.docx", docx_bytes(), "application/octet-stream")}
    ).json()
    job = create_job(client)
    endpoint = f"/api/v1/job-descriptions/{job['id']}/analyze"
    result = client.post(endpoint, json={"method": "catalogue", "resume_id": upload["id"]})
    assert result.status_code == 200, result.text
    compared = result.json()
    assert compared["resume_id"] == upload["id"]
    assert {match["skill_id"] for match in compared["analysis"]["resume_skills"]} >= {
        "java-types",
        "sql-joins",
    }
    assert all(skill["score"] is None for skill in client.get("/api/v1/skills").json())
    assert client.post(endpoint, json={"method": "catalogue"}).json()["analysis"] == compared["analysis"]
    assert client.get("/api/v1/job-descriptions").json()[0]["analysis"] == compared["analysis"]
    detached = client.post(endpoint, json={"method": "catalogue", "resume_id": None}).json()
    assert detached["resume_id"] is None and detached["analysis"]["resume_skills"] == []
    with TestClient(client.app) as other:
        register(other)
        others_job = create_job(other)
        assert (
            other.post(
                f"/api/v1/job-descriptions/{others_job['id']}/analyze",
                json={"method": "catalogue", "resume_id": upload["id"]},
            ).status_code
            == 404
        )
    assert client.delete(f"/api/v1/resumes/{upload['id']}").status_code == 200


def test_unsupported_job_is_an_empty_comparison_not_a_provider_error(client):
    job = client.post(
        "/api/v1/job-descriptions",
        json={
            "title": "Visual Designer",
            "raw_text": "Create illustrations, brand identities and print layouts using Figma.",
        },
    ).json()
    result = client.post(f"/api/v1/job-descriptions/{job['id']}/analyze", json={"method": "catalogue"})
    assert result.status_code == 200
    assert result.json()["analysis"]["required_skills"] == []
    assert client.post(f"/api/v1/job-descriptions/{job['id']}/target").status_code == 409


def test_catalogue_matches_exact_source_without_javascript_or_negative_claims():
    from app.skill_matching import compare_documents

    job = "Use JavaScript for web interfaces. SQL joins are optional. Java and HTTP are required."
    resume = "I have no Java experience. Implemented an HTTP client in JavaScript."
    result = compare_documents(job, resume, {"java-types", "sql-joins", "net-http"})
    assert {match.skill_id for match in result.required_skills} == {"java-types", "net-http"}
    assert {match.skill_id for match in result.resume_skills} == {"net-http"}
    assert all(match.evidence in job for match in result.required_skills)
    assert all(match.evidence in resume for match in result.resume_skills)


def test_ai_configuration_status_and_contact_safe_capabilities(client):
    settings = Settings(_env_file=None, openrouter_api_key="  ", openrouter_model=" test/model ")
    assert not settings.ai_enabled and settings.ai_status == "missing_key"
    settings = Settings(_env_file=None, openrouter_api_key=" test-only ", openrouter_model=" ")
    assert not settings.ai_enabled and settings.ai_status == "missing_model"
    response = client.get("/api/v1/capabilities").json()
    assert response["ai_status"] == "missing_key" and not response["ai_enabled"]
    assert "openrouter_api_key" not in response


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


def test_ai_upgrade_refreshes_an_already_targeted_catalogue_plan(client, application):
    complete(client, application, correct=False)
    job = create_job(client)
    endpoint = f"/api/v1/job-descriptions/{job['id']}/analyze"
    assert client.post(endpoint, json={"method": "catalogue"}).status_code == 200
    before = client.post(f"/api/v1/job-descriptions/{job['id']}/target").json()
    application.state.settings.openrouter_api_key = "test-only"
    application.state.settings.openrouter_model = "test/model"
    application.state.llm = ExtractionAI()
    assert client.post(endpoint, json={"method": "ai"}).json()["analysis"]["method"] == "ai"
    after = client.get("/api/v1/roadmaps/current").json()
    assert after["version"] == before["version"] + 1
    assert client.post(endpoint, json={"method": "ai"}).status_code == 200
    assert client.get("/api/v1/roadmaps/current").json()["version"] == after["version"]


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


@pytest.mark.parametrize("status,phrase", [(401, "credentials"), (402, "credits"), (404, "model")])
def test_llm_reports_actionable_configuration_failures_without_provider_body(status, phrase):
    def handler(request):
        return httpx.Response(status, json={"error": {"message": "private provider detail"}})

    client = LLMClient(
        Settings(_env_file=None, openrouter_api_key="test-only", openrouter_model="test/model"),
        transport=httpx.MockTransport(handler),
    )
    with pytest.raises(AIUnavailable) as error:
        client.structured(SkillExtraction, "instruction", {})
    assert phrase in str(error.value)
    assert "private provider detail" not in str(error.value)
