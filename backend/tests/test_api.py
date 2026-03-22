"""HTTP-level smoke tests (require running from `backend/` so graph data resolves)."""
from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def test_health_ok():
    with TestClient(app) as client:
        r = client.get("/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "healthy"
        assert data.get("graph_loaded") is True


def test_history_requires_authentication():
    with TestClient(app) as client:
        r = client.get("/api/history")
        assert r.status_code == 401


def test_graph_topology_returns_nodes_and_links():
    with TestClient(app) as client:
        r = client.get("/api/graph/topology")
        assert r.status_code == 200
        body = r.json()
        assert "nodes" in body and "links" in body
        assert len(body["nodes"]) > 0
