"""Tests for the SSE research endpoint."""

import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_research_stream_missing_query():
    resp = client.post("/research/stream", json={})
    assert resp.status_code == 400
    assert "query" in resp.json()["error"]


def test_research_stream_empty_query():
    resp = client.post("/research/stream", json={"query": "  "})
    assert resp.status_code == 400


def test_research_stream_invalid_body():
    resp = client.post("/research/stream", content=b"not json", headers={"Content-Type": "application/json"})
    assert resp.status_code == 400


def test_research_stream_emits_events():
    """SSE endpoint streams trace events and final done."""
    with patch("research.graph.run_research", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = {
            "brief": {"reasoning_trace": [], "brief": "", "tools": [], "queries": {"overview": [], "specific": []}},
            "sketch": {"expected_concepts": [], "discriminative_terms": [], "expected_patterns": [], "preferred_domains": []},
            "sources": [],
            "trace": [
                {"id": "a", "type": "brief_generated", "payload": {}, "timestamp": 0},
                {"id": "b", "type": "done", "payload": {"source_count": 0, "partial": False}, "timestamp": 1},
            ],
        }

        resp = client.post("/research/stream", json={"query": "test"})
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]

        body = resp.text
        assert "event: brief_generated" in body
        assert "event: done" in body
        # Final done payload
        assert json.dumps(mock_run.return_value) in body
