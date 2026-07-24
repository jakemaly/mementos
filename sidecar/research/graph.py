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
from research.tools.tavily import tavily_search

logger = logging.getLogger("sidecar")

_MAX_ITERATIONS = 3
_DEADLINE_SECONDS = 90


def _emit(
    trace: list[TraceEvent],
    event_type: str,
    payload: dict,
    iteration: int | None = None,
    parent_id: str | None = None,
    on_event: Any = None,
) -> TraceEvent:
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
    if on_event:
        try:
            on_event(ev)
        except Exception:
            pass
    return ev


# ── Node: Generate brief + sketch ───────────────────────────────────────

async def node_brief(state: ResearchState) -> dict:
    """Phase 1: LLM generates research brief and sketch."""
    trace = state.get("trace", [])
    on_event = state.get("on_event")

    brief, sketch = await generate_brief_and_sketch(
        query=state["query"],
    )

    ev = _emit(trace, "brief_generated", {
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
    }, on_event=on_event)

    return {
        "trace": trace,
        "last_event_id": ev["id"],
        "reasoning_trace": brief["reasoning_trace"],
        "research_brief": brief["brief"],
        "sub_questions": brief.get("sub_questions", []),
        "tool_selection": brief["tools"],
        "query_plan": brief["queries"],
        "expected_concepts": sketch["expected_concepts"],
        "discriminative_terms": sketch["discriminative_terms"],
        "expected_patterns": sketch.get("expected_patterns") or [],
        "preferred_domains": sketch.get("preferred_domains") or [],
    }


# ── Node: Supervisor (decide tools + queries for this iteration) ────────

async def node_supervisor(state: ResearchState) -> dict:
    """Phase 2: ODR Supervisor evaluates evidence, updates sub-questions, and decides next steps."""
    trace = state.get("trace", [])
    on_event = state.get("on_event")
    iteration = state.get("iteration", 0)
    parent_id = state.get("last_event_id")
    sub_questions = list(state.get("sub_questions") or [])
    if not sub_questions:
        queries = state.get("query_plan", {})
        specific_qs = queries.get("specific") or queries.get("overview") or [state["query"]]
        for idx, q in enumerate(specific_qs):
            sub_questions.append({
                "id": f"sq{idx+1}",
                "question": q,
                "status": "unresolved",
            })

    sources = state.get("all_sources", [])

    # Evaluate current sub-questions against gathered sources
    resolved_count = 0
    updated_subs = []
    gaps = []

    for sq in sub_questions:
        q_text = sq["question"].lower()
        # ponytail: simple heuristic scan across snippets for keyword coverage
        matching_snippets = [
            s["snippet"] for s in sources
            if any(w in s["title"].lower() or w in s["snippet"].lower() for w in q_text.split() if len(w) > 3)
        ]
        if matching_snippets and (len(matching_snippets) >= 2 or iteration >= 2):
            status = "resolved"
            resolved_count += 1
            summary = matching_snippets[0][:150] + "..."
        elif matching_snippets:
            status = "partially_resolved"
            summary = matching_snippets[0][:100] + "..."
            gaps.append(f"More detail needed for: {sq['question']}")
        else:
            status = "unresolved"
            summary = "No direct evidence found yet."
            gaps.append(f"Unresolved: {sq['question']}")

        updated_subs.append({
            "id": sq.get("id") or "sq",
            "question": sq["question"],
            "status": status,
            "evidence_summary": summary,
        })

    total_q = len(updated_subs) or 1
    confidence_score = min(100, int((resolved_count / total_q) * 100) + (15 if sources else 0))
    if not sources and iteration == 0:
        confidence_score = 10

    reflection = f"Iteration {iteration}: {len(sources)} sources gathered. {resolved_count}/{total_q} sub-questions resolved."
    gap_analysis = "; ".join(gaps) if gaps else "All key sub-questions adequately covered."

    # Decision logic
    if iteration >= _MAX_ITERATIONS:
        decision = "done"
        reason = "Reached max iterations cutoff"
    elif confidence_score >= 80:
        decision = "done"
        reason = "Confidence threshold reached (>=80%)"
    elif not state.get("query_plan", {}).get("overview") and not state.get("query_plan", {}).get("specific"):
        decision = "done"
        reason = "No remaining search queries"
    else:
        decision = "continue"
        reason = f"Resolving remaining gaps ({len(gaps)} unresolved)"

    # Emit supervisor evaluation event
    eval_ev = _emit(trace, "supervisor_evaluation", {
        "iteration": iteration,
        "reflection": reflection,
        "gap_analysis": gap_analysis,
        "sub_questions": updated_subs,
        "confidence_score": confidence_score,
        "decision": decision,
        "reason": reason,
    }, iteration=iteration, parent_id=parent_id, on_event=on_event)

    ev = _emit(trace, "supervisor_completed" if decision == "done" else "supervisor_started", {
        "decision": decision,
        "reason": reason,
        "confidence_score": confidence_score,
        "tools": ["tavily"],
    }, iteration=iteration, parent_id=eval_ev["id"], on_event=on_event)

    return {
        "trace": trace,
        "supervisor_decision": decision,
        "sub_questions": updated_subs,
        "reflection": reflection,
        "gap_analysis": gap_analysis,
        "confidence_score": confidence_score,
        "last_event_id": ev["id"],
    }


# ── Node: Execute selected tools in parallel ────────────────────────────

async def node_tools(state: ResearchState) -> dict:
    """Execute selected search tools in parallel with failure isolation."""
    trace = state.get("trace", [])
    on_event = state.get("on_event")
    iteration = state.get("iteration", 0)
    parent_id = state.get("last_event_id")
    tools = state.get("tool_selection", ["tavily"])
    queries = state.get("query_plan", {})
    all_query_strings = (queries.get("overview") or []) + (queries.get("specific") or [])
    existing_sources = list(state.get("all_sources", []))

    async def _run_tool(tool: str) -> list[Source]:
        tool_id = _emit(trace, "tool_started", {
            "tool": tool,
            "query_count": len(all_query_strings),
        }, iteration=iteration, parent_id=parent_id, on_event=on_event)

        start = time.monotonic()
        try:
            if tool == "tavily":
                results = await tavily_search(all_query_strings)

                # Emit live sources for the frontend before scoring
                _emit(trace, "sources_discovered", {
                    "tool": tool,
                    "query": all_query_strings[0] if len(all_query_strings) == 1 else all_query_strings,
                    "sources": results,
                }, iteration=iteration, parent_id=tool_id["id"], on_event=on_event)
            else:
                logger.warning("Unknown tool: %s", tool)
                results = []

            elapsed = time.monotonic() - start
            _emit(trace, "tool_completed", {
                "tool": tool,
                "result_count": len(results),
                "duration": round(elapsed, 2),
            }, iteration=iteration, parent_id=tool_id["id"], on_event=on_event)
            return results
        except Exception as e:
            elapsed = time.monotonic() - start
            logger.error("Tool %s failed: %s", tool, e)
            _emit(trace, "tool_failed", {
                "tool": tool,
                "error": str(e),
                "duration": round(elapsed, 2),
            }, iteration=iteration, parent_id=tool_id.get("id"), on_event=on_event)
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

    iter_ev = _emit(trace, "iteration_complete", {
        "total_sources": len(existing_sources),
        "new_sources": len(new_sources),
    }, iteration=iteration, parent_id=parent_id, on_event=on_event)

    return {
        "trace": trace,
        "all_sources": existing_sources,
        "tool_results": new_sources,
        "iteration": iteration + 1,
        "last_event_id": iter_ev["id"],
    }


# ── Node: Score and rank sources ────────────────────────────────────────

async def node_scoring(state: ResearchState) -> dict:
    """Phase 3: Apply SIRA scoring to accumulated sources."""
    trace = state.get("trace", [])
    on_event = state.get("on_event")
    parent_id = state.get("last_event_id")
    sc_ev = _emit(trace, "scoring_started", {"source_count": len(state.get("all_sources", []))}, parent_id=parent_id, on_event=on_event)

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
    }, parent_id=sc_ev["id"], on_event=on_event)

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


def get_graph_topology() -> dict:
    """Return JSON graph topology nodes and edges for UI visualization."""
    return {
        "nodes": [
            {"id": "brief", "label": "Brief Generator", "type": "brief"},
            {"id": "supervisor", "label": "ODR Supervisor", "type": "supervisor"},
            {"id": "tools", "label": "Tavily Web Search", "type": "tool"},
            {"id": "scoring", "label": "SIRA Sketch Scoring", "type": "scoring"},
            {"id": "ingest", "label": "LightRAG Ingest", "type": "ingest"},
        ],
        "edges": [
            {"source": "brief", "target": "supervisor"},
            {"source": "supervisor", "target": "tools", "label": "continue"},
            {"source": "tools", "target": "supervisor"},
            {"source": "supervisor", "target": "scoring", "label": "done"},
            {"source": "scoring", "target": "ingest"},
        ],
    }


# ── Runner with deadline ────────────────────────────────────────────────

async def run_research(
    query: str,
    deadline: float = _DEADLINE_SECONDS,
    on_event: Any = None,
) -> dict:
    """Run the research pipeline with a hard deadline.

    Returns the final ResearchResult dict. On timeout, returns partial results
    with `partial: true` and `timeout_phase` set.
    """
    start = time.monotonic()

    initial_state: ResearchState = {
        "query": query,
        "on_event": on_event,
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
