"""Tests for the LangGraph research pipeline — routing, deadline, failure isolation."""

import asyncio
import time
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from research.graph import (
    _emit,
    _should_continue,
    node_brief,
    node_scoring,
    node_supervisor,
    node_tools,
    run_research,
)
from research.state import QueryPlan, ResearchState, TraceEvent


# ── Helper: minimal state factory ────────────────────────────────────────

def _state(overrides: dict | None = None) -> ResearchState:
    base: ResearchState = {
        "query": "test query",
        "reasoning_trace": [],
        "research_brief": "",
        "tool_selection": ["tavily"],
        "query_plan": QueryPlan(overview=["test"], specific=[]),
        "expected_concepts": ["transformer"],
        "discriminative_terms": ["attention"],
        "expected_patterns": [],
        "preferred_domains": [],
        "iteration": 0,
        "all_sources": [],
        "tool_results": [],
        "supervisor_decision": "continue",
        "ranked_sources": [],
        "trace": [],
    }
    if overrides:
        base.update(overrides)
    return base


# ── Emit helper ──────────────────────────────────────────────────────────

def test_emit_creates_event():
    trace: list[TraceEvent] = []
    ev = _emit(trace, "brief_generated", {"key": "val"})
    assert len(trace) == 1
    assert trace[0] is ev
    assert ev["type"] == "brief_generated"
    assert ev["payload"]["key"] == "val"
    assert "id" in ev
    assert "timestamp" in ev


def test_emit_with_iteration():
    trace: list[TraceEvent] = []
    ev = _emit(trace, "tool_started", {}, iteration=2)
    assert ev["iteration"] == 2


def test_emit_with_parent():
    trace: list[TraceEvent] = []
    ev = _emit(trace, "tool_completed", {}, parent_id="abc123")
    assert ev["parent_id"] == "abc123"


# ── Supervisor routing ──────────────────────────────────────────────────

def test_should_continue_when_continue():
    state = _state({"supervisor_decision": "continue"})
    assert _should_continue(state) == "tools"


def test_should_continue_when_done():
    state = _state({"supervisor_decision": "done"})
    assert _should_continue(state) == "scoring"


# ── Supervisor node ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_supervisor_max_iterations():
    state = _state({"iteration": 3})
    result = await node_supervisor(state)
    assert result["supervisor_decision"] == "done"


@pytest.mark.asyncio
async def test_supervisor_no_queries():
    state = _state({"query_plan": QueryPlan(overview=[], specific=[])})
    result = await node_supervisor(state)
    assert result["supervisor_decision"] == "done"


@pytest.mark.asyncio
async def test_supervisor_continues():
    state = _state()
    result = await node_supervisor(state)
    assert result["supervisor_decision"] == "continue"


# ── Tools node ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_tools_tavily_only():
    with patch("research.graph.tavily_search", new_callable=AsyncMock) as mock_tav:
        mock_tav.return_value = [
            {"url": "https://example.com/1", "title": "R1", "snippet": "s1", "score": 0, "source": "tavily"},
        ]
        state = _state({"tool_selection": ["tavily"]})
        result = await node_tools(state)
        assert len(result["all_sources"]) == 1
        mock_tav.assert_called_once()


@pytest.mark.asyncio
async def test_tools_emits_sources_per_query():
    async def mocked_search(queries, on_query_results=None):
        for query in queries:
            result = [{"url": f"https://example.com/{query}", "title": query, "snippet": query, "score": 0}]
            if on_query_results:
                on_query_results(query, result)
        return [
            {"url": f"https://example.com/{query}", "title": query, "snippet": query, "score": 0}
            for query in queries
        ]

    with patch("research.graph.tavily_search", side_effect=mocked_search):
        state = _state({"query_plan": QueryPlan(overview=["overview"], specific=["specific"])})
        result = await node_tools(state)
        discovered = [e for e in result["trace"] if e["type"] == "sources_discovered"]
        assert [e["payload"]["query"] for e in discovered] == ["overview", "specific"]
        assert [e["payload"]["sources"][0]["url"] for e in discovered] == [
            "https://example.com/overview", "https://example.com/specific"
        ]


@pytest.mark.asyncio
async def test_tools_failure_isolation():
    """Tool failure emits tool_failed trace event cleanly."""
    with patch("research.graph.tavily_search", new_callable=AsyncMock) as mock_tav:
        mock_tav.side_effect = Exception("API error")
        state = _state({"tool_selection": ["tavily"]})
        result = await node_tools(state)
        assert len(result["all_sources"]) == 0
        types = [e["type"] for e in result["trace"]]
        assert "tool_failed" in types


@pytest.mark.asyncio
async def test_tools_dedup():
    """Sources from tools are deduplicated against existing."""
    with patch("research.graph.tavily_search", new_callable=AsyncMock) as mock_tav:
        existing = [{"url": "https://example.com/1", "title": "E", "snippet": "", "score": 0}]
        mock_tav.return_value = [
            {"url": "https://example.com/1/", "title": "Dup", "snippet": "", "score": 0, "source": "tavily"},
            {"url": "https://example.com/2", "title": "New", "snippet": "", "score": 0, "source": "tavily"},
        ]
        state = _state({"all_sources": existing, "tool_selection": ["tavily"]})
        result = await node_tools(state)
        assert len(result["all_sources"]) == 2


@pytest.mark.asyncio
async def test_sources_discovered_precedes_done():
    async def mocked_search(queries, on_query_results=None):
        sources = [{"url": "https://example.com/live", "title": "Live", "snippet": "c1 t1", "score": 0}]
        if on_query_results:
            on_query_results(queries[0], sources)
        return sources

    with (
        patch("research.graph.generate_brief_and_sketch", new_callable=AsyncMock) as mock_gen,
        patch("research.graph.tavily_search", side_effect=mocked_search),
    ):
        mock_gen.return_value = (
            {"reasoning_trace": [], "brief": "scope", "tools": ["tavily"], "queries": {"overview": ["what is X?"], "specific": []}},
            {"expected_concepts": ["c1"], "discriminative_terms": ["t1"], "expected_patterns": [], "preferred_domains": []},
        )
        result = await run_research("what is X?")

    types = [event["type"] for event in result["trace"]]
    assert types.index("sources_discovered") < types.index("done")


# ── Scoring node ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_scoring_scores_sources():
    sources = [
        {"url": "https://en.wikipedia.org/wiki/Transformer", "title": "Transformer attention", "snippet": "Attention mechanism", "score": 0},
        {"url": "https://example.com/noise", "title": "Unrelated", "snippet": "Nothing here", "score": 0},
    ]
    state = _state({
        "all_sources": sources,
        "discriminative_terms": ["attention"],
        "expected_concepts": ["transformer"],
    })
    result = await node_scoring(state)
    assert len(result["ranked_sources"]) == 1
    assert result["ranked_sources"][0]["title"] == "Transformer attention"


@pytest.mark.asyncio
async def test_scoring_empty_sources():
    state = _state({"all_sources": []})
    result = await node_scoring(state)
    assert result["ranked_sources"] == []


# ── Brief node ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_brief_node_emits_events():
    with patch("research.graph.generate_brief_and_sketch", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = (
            {
                "reasoning_trace": ["step1"],
                "brief": "scope",
                "tools": ["tavily"],
                "queries": {"overview": ["what is X?"], "specific": []},
            },
            {
                "expected_concepts": ["c1"],
                "discriminative_terms": ["t1"],
                "expected_patterns": [],
                "preferred_domains": [],
            },
        )
        state = _state()
        result = await node_brief(state)
        assert result["research_brief"] == "scope"
        types = [e["type"] for e in result["trace"]]
        assert "brief_generated" in types


# ── Full pipeline (mocked) ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_run_research_returns_result():
    with (
        patch("research.graph.generate_brief_and_sketch", new_callable=AsyncMock) as mock_gen,
        patch("research.graph.tavily_search", new_callable=AsyncMock) as mock_tav,
    ):
        mock_gen.return_value = (
            {
                "reasoning_trace": ["step1"],
                "brief": "scope",
                "tools": ["tavily"],
                "queries": {"overview": ["what is X?"], "specific": []},
            },
            {
                "expected_concepts": ["c1"],
                "discriminative_terms": ["t1"],
                "expected_patterns": [],
                "preferred_domains": [],
            },
        )
        mock_tav.return_value = [
            {"url": "https://example.com/1", "title": "Hit", "snippet": "c1 t1", "score": 0, "source": "tavily"},
        ]

        result = await run_research("what is X?")
        assert "brief" in result
        assert "sketch" in result
        assert "sources" in result
        assert "trace" in result
        assert not result.get("partial")


@pytest.mark.asyncio
async def test_run_research_timeout_returns_partial():
    """Timeout produces partial results with scored sources."""
    with (
        patch("research.graph.generate_brief_and_sketch", new_callable=AsyncMock) as mock_gen,
        patch("research.graph.tavily_search", new_callable=AsyncMock) as mock_tav,
    ):
        # Simulate slow execution by sleeping
        async def slow_gen(*a, **kw):
            await asyncio.sleep(10)
            return {}, {}
        mock_gen.side_effect = slow_gen

        result = await run_research("test", deadline=0.1)
        assert result.get("partial") is True
        assert "timeout_phase" in result
        # Trace should contain error event
        types = [e["type"] for e in result["trace"]]
        assert "error" in types
