"""Shared wire contracts for the SIRA agentic research pipeline."""

from typing import Any, Literal, NotRequired, TypedDict


# ── Request input ────────────────────────────────────────────────────────

class ResearchRequest(TypedDict):
    query: str
    domains: NotRequired[list[str]]
    filetypes: NotRequired[list[str]]


# ── Phase 1: Brief + Sketch ─────────────────────────────────────────────

class QueryPlan(TypedDict):
    overview: list[str]
    specific: list[str]


class ResearchBrief(TypedDict):
    reasoning_trace: list[str]
    brief: str
    tools: list[str]  # e.g. ["tavily", "arxiv", "github"]
    queries: QueryPlan


class Sketch(TypedDict):
    expected_concepts: list[str]
    discriminative_terms: list[str]
    expected_patterns: NotRequired[list[str]]
    preferred_domains: NotRequired[list[str]]


# ── Phase 2: Normalized Source ──────────────────────────────────────────

class Source(TypedDict):
    url: str
    title: str
    snippet: str
    score: float
    source: NotRequired[Literal["tavily", "arxiv", "github"]]
    metadata: NotRequired[dict[str, Any]]


# ── Phase 2: SSE Trace Events ───────────────────────────────────────────

class TraceEvent(TypedDict):
    id: str
    parent_id: NotRequired[str]
    type: Literal[
        "supervisor_started",
        "supervisor_completed",
        "brief_generated",
        "tool_started",
        "tool_completed",
        "tool_failed",
        "iteration_complete",
        "scoring_started",
        "sources_ranked",
        "done",
        "error",
    ]
    payload: dict[str, Any]
    iteration: NotRequired[int]
    timestamp: float


# ── Phase 3: Final payload ──────────────────────────────────────────────

class ResearchResult(TypedDict):
    brief: ResearchBrief
    sketch: Sketch
    sources: list[Source]
    trace: list[TraceEvent]
    partial: NotRequired[bool]
    timeout_phase: NotRequired[str]


# ── LangGraph state ─────────────────────────────────────────────────────

class ResearchState(TypedDict):
    # User input
    query: str
    user_domains: list[str]
    user_filetypes: list[str]

    # Phase 1 outputs
    reasoning_trace: list[str]
    research_brief: str
    tool_selection: list[str]
    query_plan: QueryPlan
    expected_concepts: list[str]
    discriminative_terms: list[str]
    expected_patterns: list[str]
    preferred_domains: list[str]

    # Phase 2 outputs
    iteration: int
    all_sources: list[Source]
    tool_results: list[Source]
    supervisor_decision: str  # "continue" | "done"

    # Phase 3 outputs
    ranked_sources: list[Source]

    # Trace (for SSE streaming)
    trace: list[TraceEvent]
