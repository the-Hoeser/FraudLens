from fastapi.testclient import TestClient

from app.db import reset_database_for_tests
from app.main import app


def test_health_and_empty_dashboard(monkeypatch):
    reset_database_for_tests("sqlite://")
    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json()["status"] == "ok"
        summary = client.get("/api/dashboard/summary")
        assert summary.status_code == 200
        assert summary.json()["transactions_analyzed"] == 0


def test_predictions_refuse_without_trained_model():
    reset_database_for_tests("sqlite://")
    with TestClient(app) as client:
        result = client.get("/api/model/metrics")
        assert result.status_code == 200
        assert result.json()["status"] == "not_evaluated"
