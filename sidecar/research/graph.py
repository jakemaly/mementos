"""LangGraph research workflow — brief → supervisor → tools → scoring."""

import asyncio
import logging
import time
import uuid

from langgraph.graph import StateGraph

from research.scoring import score_sources
from research.sketch import generate_brief_and_sketch
from research.state import (
    QueryPlan,
    ResearchBrief,
    ResearchState,
    Sketch,
    Source,
    TraceEvent,
)
from research.tools.arxiv import arxiv_search
from research.tools.github import github_search
from research.tools.tavily import tavily_search

logger = logging.getLogger("sidecar")

_MAX_ITERATIONS = 3
_DEADLINE_SECONDS = 90


def _emit(trace: list[TraceEvent], event_type: str, payload: dict, iteration: int | None = None, parent_id: str | None = None) -> TraceEvent:
    ev: TraceEvent = {
        "id": uuid.uuid4().hex[:12],
        "type": event_type,
        "payload": payload,
        "timestamp": time.monotonic(),
    }
    if iteration is not None:
        ev["iteration"] = iteration
    if parent_id is not None:
        ev["parent_id"] = parent_id
    trace.append(ev)
    return ev


# ── Node: Generate brief + sketch ───────────────────────────────────────

async def node_brief(state: ResearchState) -> dict:
    """Phase 1: LLM generates research brief and sketch."""
    trace = state.get("trace", [])
    parent = _emit(trace, "supervisor_started", {"phase": "brief"})

    brief, sketch = await generate_brief_and_sketch(
        query=state["query"],
        domains=state.get("user_domains") or None,
        filetypes=state.get("user_filetypes") or None,
    )

    _emit(trace, "brief_generated", {
        "reasoning": brief["reasoning_trace"],
        "brief": brief["brief"],
        "tools": brief["tools"],
        "queries": brief["queries"],
        "sketch": {
            "expected_concepts": sketch["expected_concepts"],
            "discriminative_terms": sketch["discriminative_terms"],
            "expected_patterns": sketch.get("expected_patterns") or [],
            "preferred_domains": sketch.get("preferred_domains") or [],
        },
    }, parent_id=parent["id"])

    _emit(trace, "supervisor_completed", {"phase": "brief"})

    return {
        "trace": trace,
        "reasoning_trace": brief["reasoning_trace"],
        "research_brief": brief["brief"],
        "tool_selection": brief["tools"],
        "query_plan": brief["queries"],
        "expected_concepts": sketch["expected_concepts"],
        "discriminative_terms": sketch["discriminative_terms"],
        "expected_patterns": sketch.get("expected_patterns") or [],
        "preferred_domains": sketch.get("preferred_domains") or [],
    }


# ── Node: Supervisor (decide tools + queries for this iteration) ────────

async def node_supervisor(state: ResearchState) -> dict:
    """Phase 2: Supervisor reviews findings and decides next actions."""
    trace = state.get("trace", [])
    iteration = state.get("iteration", 0)

    if iteration >= _MAX_ITERATIONS:
        _emit(trace, "supervisor_completed", {"decision": "done", "reason": "max iterations"})
        return {"trace": trace, "supervisor_decision": "done"}

    # ponytail: first iteration uses brief queries directly.
    # Subsequent iterations could use LLM to revise queries, but for now
    # we reuse the original queries with different tool selection.
    # Upgrade: add LLM supervisor node when iteration > 1 behavior is needed.
    queries = state.get("query_plan", {})
    all_query_strings = (queries.get("overview") or []) + (queries.get("specific") or [])

    if not all_query_strings:
        _emit(trace, "supervisor_completed", {"decision": "done", "reason": "no queries"})
        return {"trace": trace, "supervisor_decision": "done"}

    _emit(trace, "supervisor_started", {
        "decision": "continue",
        "tools": state.get("tool_selection", ["tavily"]),
        "query_count": len(all_query_strings),
    }, iteration=iteration)

    return {
        "trace": trace,
        "supervisor_decision": "continue",
    }


# ── Node: Execute selected tools in parallel ────────────────────────────

async def node_tools(state: ResearchState) -> dict:
    """Execute selected search tools in parallel with failure isolation."""
    trace = state.get("trace", [])
    iteration = state.get("iteration", 0)
    tools = state.get("tool_selection", ["tavily"])
    queries = state.get("query_plan", {})
    all_query_strings = (queries.get("overview") or []) + (queries.get("specific") or [])
    existing_sources = list(state.get("all_sources", []))

    async def _run_tool(tool: str) -> list[Source]:
        tool_id = _emit(trace, "tool_started", {
            "tool": tool,
            "query_count": len(all_query_strings),
        }, iteration=iteration)

        start = time.monotonic()
        try:
            if tool == "tavily":
                results = await tavily_search(
                    all_query_strings,
                    include_domains=state.get("user_domains") or None,
                )
            elif tool == "arxiv":
                results = await arxiv_search(all_query_strings)
            elif tool == "github":
                results = await github_search(all_query_strings)
            else:
                logger.warning("Unknown tool: %s", tool)
                results = []

            elapsed = time.monotonic() - start
            _emit(trace, "tool_completed", {
                "tool": tool,
                "result_count": len(results),
                "duration": round(elapsed, 2),
            }, iteration=iteration, parent_id=tool_id["id"])
            return results
        except Exception as e:
            elapsed = time.monotonic() - start
            logger.error("Tool %s failed: %s", tool, e)
            _emit(trace, "tool_failed", {
                "tool": tool,
                "error": str(e),
                "duration": round(elapsed, 2),
            }, iteration=iteration, parent_id=tool_id.get("id"))
            return []

    # Run all selected tools in parallel
    tool_tasks = [_run_tool(t) for t in tools]
    settled = await asyncio.gather(*tool_tasks, return_exceptions=True)

    new_sources: list[Source] = []
    for result in settled:
        if isinstance(result, list):
            new_sources.extend(result)

    # Dedup against existing sources
    seen = {s["url"].lower() for s in existing_sources}
    for s in new_sources:
        if s["url"].lower() not in seen:
            seen.add(s["url"].lower())
            existing_sources.append(s)

    _emit(trace, "iteration_complete", {
        "total_sources": len(existing_sources),
        "new_sources": len(new_sources),
    }, iteration=iteration)

    return {
        "trace": trace,
        "all_sources": existing_sources,
        "tool_results": new_sources,
    }


# ── Node: Score and rank sources ────────────────────────────────────────

async def node_scoring(state: ResearchState) -> dict:
    """Phase 3: Apply SIRA scoring to accumulated sources."""
    trace = state.get("trace", [])
    _emit(trace, "scoring_started", {"source_count": len(state.get("all_sources", []))})

    sketch: Sketch = {
        "expected_concepts": state.get("expected_concepts", []),
        "discriminative_terms": state.get("discriminative_terms", []),
        "expected_patterns": state.get("expected_patterns") or [],
        "preferred_domains": state.get("preferred_domains") or [],
    }

    ranked = score_sources(state.get("all_sources", []), sketch)

    _emit(trace, "sources_ranked", {
        "total_sources": len(ranked),
        "top_score": ranked[0]["score"] if ranked else 0,
    })

    return {
        "trace": trace,
        "ranked_sources": ranked,
    }


# ── Build the graph ─────────────────────────────────────────────────────

def _should_continue(state: ResearchState) -> str:
    """Router: continue to tools or exit to scoring."""
    if state.get("supervisor_decision") == "done":
        return "scoring"
    return "tools"


def build_graph():
    """Build and compile the LangGraph research workflow."""
    graph = StateGraph(ResearchState)

    # Nodes
    graph.add_node("brief", node_brief)
    graph.add_node("supervisor", node_supervisor)
    graph.add_node("tools", node_tools)
    graph.add_node("scoring", node_scoring)

    # Edges
    graph.set_entry_point("brief")
    graph.add_edge("brief", "supervisor")
    graph.add_conditional_edges("supervisor", _should_continue, {"tools": "tools", "scoring": "scoring"})
    graph.add_edge("tools", "supervisor")
    graph.set_finish_point("scoring")

    return graph.compile()


# ── Runner with deadline ────────────────────────────────────────────────

async def run_research(
    query: str,
    domains: list[str] | None = None,
    filetypes: list[str] | None = None,
    deadline: float = _DEADLINE_SECONDS,
) -> dict:
    """Run the research pipeline with a hard deadline.

    Returns the final ResearchResult dict. On timeout, returns partial results
    with `partial: true` and `timeout_phase` set.
    """
    start = time.monotonic()

    initial_state: ResearchState = {
        "query": query,
        "user_domains": domains or [],
        "user_filetypes": filetypes or [],
        "reasoning_trace": [],
        "research_brief": "",
        "tool_selection": ["tavily"],
        "query_plan": QueryPlan(overview=[], specific=[]),
        "expected_concepts": [],
        "discriminative_terms": [],
        "expected_patterns": [],
        "preferred_domains": [],
        "iteration": 0,
        "all_sources": [],
        "tool_results": [],
        "supervisor_decision": "continue",
        "ranked_sources": [],
        "trace": [],
    }

    compiled = build_graph()

    async def _check_deadline() -> bool:
        return (time.monotonic() - start) >= deadline

    try:
        # Run graph with manual iteration to respect deadline
        state = initial_state
        # ponytail: LangGraph's astream doesn't support per-node timeout easily.
        # We wrap the whole invocation in an asyncio.wait_for with a small buffer.
        # Upgrade: use LangGraph's on_chat_chunk callback for per-step deadline checks.
        try:
            final_state = await asyncio.wait_for(
                compiled.ainvoke(state),
                timeout=deadline,
            )
            partial = False
            timeout_phase = None
        except asyncio.TimeoutError:
            logger.warning("Research timed out after %.1fs", deadline)
            # On timeout, score whatever we have
            final_state = state
            if final_state.get("all_sources") and not final_state.get("ranked_sources"):
                sketch = {
                    "expected_concepts": final_state.get("expected_concepts", []),
                    "discriminative_terms": final_state.get("discriminative_terms", []),
                    "expected_patterns": final_state.get("expected_patterns") or [],
                    "preferred_domains": final_state.get("preferred_domains") or [],
                }
                final_state["ranked_sources"] = score_sources(
                    final_state["all_sources"], sketch
                )
            partial = True
            timeout_phase = f"iteration_{final_state.get('iteration', 0)}"

            trace = final_state.get("trace", [])
            _emit(trace, "error", {
                "phase": "timeout",
                "message": f"Research timed out after {deadline}s",
            })
            final_state["trace"] = trace

        # Build result
        brief: ResearchBrief = {
            "reasoning_trace": final_state.get("reasoning_trace", []),
            "brief": final_state.get("research_brief", ""),
            "tools": final_state.get("tool_selection", []),
            "queries": final_state.get("query_plan", QueryPlan(overview=[], specific=[])),
        }

        sketch: Sketch = {
            "expected_concepts": final_state.get("expected_concepts", []),
            "discriminative_terms": final_state.get("discriminative_terms", []),
            "expected_patterns": final_state.get("expected_patterns") or [],
            "preferred_domains": final_state.get("preferred_domains") or [],
        }

        result = {
            "brief": brief,
            "sketch": sketch,
            "sources": final_state.get("ranked_sources", []),
            "trace": final_state.get("trace", []),
        }

        if partial:
            result["partial"] = True
            result["timeout_phase"] = timeout_phase

        # Emit done event
        trace = result["trace"]
        _emit(trace, "done", {
            "source_count": len(result["sources"]),
            "partial": partial,
        })
        result["trace"] = trace

        return result

    except Exception as e:
        logger.exception("Research pipeline failed")
        return {
            "brief": {"reasoning_trace": [], "brief": "", "tools": [], "queries": {"overview": [], "specific": []}},
            "sketch": {"expected_concepts": [], "discriminative_terms": [], "expected_patterns": [], "preferred_domains": []},
            "sources": [],
            "trace": [{
                "id": uuid.uuid4().hex[:12],
                "type": "error",
                "payload": {"phase": "pipeline", "message": str(e)},
                "timestamp": time.monotonic(),
            }],
        }
