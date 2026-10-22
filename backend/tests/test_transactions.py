from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_failed_commit_never_reports_a_saved_bookmark(client, application, monkeypatch):
    resource = client.get("/api/v1/resources").json()[0]

    def fail_commit(self):
        raise RuntimeError("Synthetic database commit failure")

    monkeypatch.setattr(Session, "commit", fail_commit)
    with TestClient(
        application, raise_server_exceptions=False, cookies=dict(client.cookies), headers=dict(client.headers)
    ) as connection:
        response = connection.post(f"/api/v1/resources/{resource['id']}/bookmark")
    assert response.status_code == 500
    assert response.json()["error"]["message"] == "Something went wrong. Please try again."
