"""Contract tests for the TouchDesigner graph snapshot bridge."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from fastapi.testclient import TestClient

import main


def write_dump(path: Path, *, entity_id: str = "entity-1") -> dict:
    data = {
        "entities": [{"id": entity_id, "xyz": [0.0, 1.0, 2.0], "payload": {}}],
        "relationships": [],
        "edges": [],
        "name_to_id": {"Entity": entity_id},
        "meta": {},
    }
    path.write_text(json.dumps(data), encoding="utf-8")
    return data


def test_graph_endpoint_returns_a_versioned_complete_snapshot(tmp_path, monkeypatch):
    dump_path = tmp_path / "graph_dump.json"
    graph = write_dump(dump_path)
    monkeypatch.setattr(main, "_GRAPH_DUMP", dump_path)

    with TestClient(main.app) as client:
        response = client.get("/td/graph")

    assert response.status_code == 200
    payload = response.json()
    assert payload["entities"] == graph["entities"]
    assert payload["edges"] == graph["edges"]
    assert payload["snapshot_id"] == hashlib.sha256(
        json.dumps(graph, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def test_graph_endpoint_reports_missing_snapshot(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "_GRAPH_DUMP", tmp_path / "missing.json")

    with TestClient(main.app) as client:
        response = client.get("/td/graph")

    assert response.status_code == 503
    assert "Run dump_graph.py first" in response.json()["error"]


def test_retrieval_response_uses_the_same_snapshot_as_its_entity_ids(tmp_path, monkeypatch):
    dump_path = tmp_path / "graph_dump.json"
    graph = write_dump(dump_path, entity_id="entity-current")
    monkeypatch.setattr(main, "_GRAPH_DUMP", dump_path)

    class FakeRag:
        pass

    async def fake_get_rag():
        return FakeRag()

    async def fake_mode_ids(rag, query, mode, name_to_id, pair_to_rel):
        assert name_to_id == {"Entity": "entity-current"}
        return {"entity_ids": [name_to_id["Entity"]], "relation_ids": []}

    monkeypatch.setattr(main, "get_rag", fake_get_rag)
    monkeypatch.setattr(main, "_mode_ids", fake_mode_ids)

    with TestClient(main.app) as client:
        with client.websocket_connect("/ws/retrieval") as websocket:
            websocket.send_text("Which entity?")
            payload = websocket.receive_json()

    assert payload["snapshot_id"] == hashlib.sha256(
        json.dumps(graph, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    assert set(payload["modes"]) == {"naive", "local", "global", "hybrid"}
    assert all(result["entity_ids"] == ["entity-current"] for result in payload["modes"].values())


def test_insert_refreshes_the_graph_before_returning_success(monkeypatch):
    class FakeRag:
        async def ainsert(self, text):
            assert text == "New knowledge"
            return "track-1"

    async def fake_get_rag():
        return FakeRag()

    async def fake_refresh():
        return {"snapshot_id": "fresh-snapshot"}

    monkeypatch.setattr(main, "get_rag", fake_get_rag)
    monkeypatch.setattr(main, "refresh_graph_dump", fake_refresh)

    with TestClient(main.app) as client:
        response = client.post("/insert", json={"text": "New knowledge"})

    assert response.status_code == 200
    assert response.json()["graph_snapshot_id"] == "fresh-snapshot"


def test_requirements_pin_the_structured_retrieval_api_version():
    requirements = (Path(__file__).parent / "requirements.txt").read_text(encoding="utf-8")
    assert "lightrag-hku==1.5.4" in requirements
    assert "numpy==2.5.0" in requirements
    assert "scikit-learn==1.9.0" in requirements
