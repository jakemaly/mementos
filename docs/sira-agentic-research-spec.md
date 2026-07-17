# Spec: SIRA Agentic Research Pipeline

## Objective

Replace the current synchronous, single-shot SIRA (Superintelligent Retrieval Agent) deep research pipeline with an **agentic, multi-tool research system** orchestrated by LangGraph in the Python sidecar. The new pipeline self-clarifies research scope, adaptively selects data sources (Tavily, arXiv, GitHub), decomposes queries into hierarchical questions, iteratively refines search strategy based on findings, and streams real-time execution traces to the frontend as a live growing directed acyclic graph (DAG) visualization.

**What changes:**
- Research pipeline moves from Next.js (TypeScript) → Python sidecar (LangGraph)
- Single Tavily search fan-out → adaptive multi-tool search with LLM-driven iteration
- Synchronous POST → SSE streaming with phase-by-phase events
- Static sketch display → live DAG visualization of the research execution graph
- No query decomposition → hierarchical query decomposition (overview + specific sub-questions, max 1 level deep)

**What stays the same:**
- SIRA name and branding
- Source scoring algorithm (SIRA sketch-term filtering)
- Ingestion pipeline (`/api/research/ingest`) — unchanged
- Qdrant vector storage — unchanged
- Frontend MD3 design system — unchanged

---

## ASSUMPTIONS

1. The NVIDIA Nemotron LLM (via OpenAI-compatible endpoint) is capable of structured JSON output for both sketch generation and agentic supervision decisions.
2. Tavily API key is configured and rate limits support ~10 concurrent searches.
3. arXiv API (`export.arxiv.org`) is free, unauthenticated, and returns Atom XML — no API key needed.
4. GitHub REST API (`api.github.com/search/repositories`) works unauthenticated with rate limit of 10 req/min, or with `GITHUB_TOKEN` env var for 5000 req/hour.
5. The sidecar FastAPI server can handle long-running SSE connections (30s max).
6. The frontend runs on the same origin as the Next.js API (no CORS issues for SSE).
7. Polymarket integration is explicitly out of scope for this iteration.

---

## Tech Stack

| Component | Technology | Version/Notes |
|---|---|---|
| Orchestrator | LangGraph (Python) | `langgraph`, `langchain-core`, `langchain-openai` |
| Sidecar framework | FastAPI + Uvicorn | Existing, adding new routes |
| LLM | NVIDIA Nemotron-3-Super-120B | Via OpenAI-compatible endpoint |
| Web search | Tavily API | Existing `TAVILY_API_KEY` |
| Academic papers | arXiv API | Free, no auth, Atom XML parsing |
| Code/repos | GitHub REST API | Optional `GITHUB_TOKEN` env var |
| Streaming | Server-Sent Events (SSE) | Native `text/event-stream` |
| Frontend | Next.js 16 + React 19 | Existing, SSE consumer + DAG viz |
| Vector storage | Qdrant | Existing, unchanged |

---

## Commands

```bash
# Install sidecar dependencies
cd sidecar && source venv/bin/activate && pip install langgraph langchain-core langchain-openai

# Start full stack
./start.sh

# Frontend dev
cd app && npm run dev

# Frontend build
cd app && npm run build
```

---

## Project Structure (changes only)

```
sidecar/
├── main.py                    # FastAPI app — adds /research/stream SSE endpoint
├── research/
│   ├── __init__.py
│   ├── graph.py               # LangGraph state graph definition (supervisor + tools)
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── tavily.py          # Tavily search tool
│   │   ├── arxiv.py           # arXiv search tool (Atom XML parsing)
│   │   └── github.py          # GitHub repo search tool
│   ├── sketch.py              # Research brief + sketch generation (LLM prompt)
│   ├── scoring.py             # SIRA source scoring (port from TS or call via HTTP)
│   └── state.py               # LangGraph state type definitions
```

Existing files touched:
- `sidecar/main.py` — adds `/research/stream` SSE route
- `app/app/api/research/route.ts` — replaced with SSE proxy to sidecar
- `app/app/page.tsx` — DAG visualization component + SSE consumer
- `app/app/page.module.css` — DAG visualization styles

---

## Architecture

### High-Level Flow

```
User Query
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                 │
│  POST /api/research                                 │
│    → returns SSE stream (text/event-stream)         │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Next.js API Route (/api/research/route.ts)         │
│  Proxies to sidecar /research/stream via fetch      │
│  Transforms sidecar SSE → frontend SSE              │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Sidecar (FastAPI, :8000)                           │
│  POST /research/stream                              │
│    │                                                │
│    │  Phase 1: Generate Research Brief (LLM)       │
│    │  ┌─────────────────────────────────────────┐  │
│    │  │ - Self-clarification reasoning trace     │  │
│    │  │ - Research scope & assumptions           │  │
│    │  │ - Tool selection (tavily, arxiv, github) │  │
│    │  │ - Query decomposition (overview + sub)   │  │
│    │  │ - Expected concepts & discriminative     │  │
│    │  └─────────────────────────────────────────┘  │
│    │  → SSE event: "brief_generated"               │
│    │                                                │
│    │  Phase 2: LangGraph Agentic Loop (max 3 iter) │
│    │  ┌─────────────────────────────────────────┐  │
│    │  │  Supervisor Node:                       │  │
│    │  │    - Reviews accumulated findings        │  │
│    │  │    - Decides which tools to call next    │  │
│    │  │    - Can revise search queries           │  │
│    │  │    - Decides when to stop (early exit)   │  │
│    │  │                                          │  │
│    │  │  Tool Nodes (parallel fan-out):          │  │
│    │  │    - TavilySearch → web results          │  │
│    │  │    - ArxivSearch → paper metadata        │  │
│    │  │    - GithubSearch → repo metadata        │  │
│    │  │                                          │  │
│    │  │  → SSE events per tool execution         │  │
│    │  └─────────────────────────────────────────┘  │
│    │                                                │
│    │  Phase 3: Score & Rank Sources                │
│    │  ┌─────────────────────────────────────────┐  │
│    │  │  SIRA sketch-term filtering algorithm   │  │
│    │  │  (same weighted scoring as current TS)  │  │
│    │  └─────────────────────────────────────────┘  │
│    │  → SSE event: "sources_ranked"                │
│    │                                                │
│    │  → SSE event: "done" (final payload)          │
│    │  → Close stream                               │
│    └────────────────────────────────────────────────┘
```

### SSE Event Contract

All events use standard SSE format (`event: <type>\ndata: <json>\n\n`).

| Event Type | Payload | When |
|---|---|---|
| `brief_generated` | `{ reasoning: string[], brief: string, tools: string[], queries: QueryPlan, sketch: Sketch }` | After Phase 1 completes |
| `tool_started` | `{ tool: "tavily"\|"arxiv"\|"github", query: string, iteration: number }` | When a tool node begins |
| `tool_completed` | `{ tool: string, query: string, resultCount: number, duration: number, iteration: number }` | When a tool node finishes |
| `iteration_complete` | `{ iteration: number, totalSources: number, supervisorDecision: string }` | After supervisor evaluates findings |
| `sources_ranked` | `{ totalSources: number, topScore: number }` | After scoring completes |
| `done` | `{ brief: Brief, sketch: Sketch, sources: Source[], trace: TraceEvent[] }` | Final event, complete payload |
| `error` | `{ phase: string, message: string }` | On any failure |

### LangGraph State Definition

```python
class ResearchState(TypedDict):
    # User input
    query: str
    user_domains: list[str]
    user_filetypes: list[str]

    # Phase 1 outputs (brief + sketch)
    reasoning_trace: list[str]
    research_brief: str
    tool_selection: list[str]  # ["tavily", "arxiv", "github"] — subset based on query type
    query_plan: dict  # { "overview": [...], "specific": [...] }
    expected_concepts: list[str]
    discriminative_terms: list[str]
    expected_patterns: list[str]
    preferred_domains: list[str]

    # Phase 2 outputs (agentic loop)
    iteration: int
    all_sources: list[dict]  # accumulated from all tool calls
    tool_results: list[dict]  # results from current iteration
    supervisor_decision: str  # "continue" or "done" with reasoning

    # Phase 3 outputs (scoring)
    ranked_sources: list[dict]

    # Trace (for SSE streaming)
    trace: list[dict]
```

### Tool Selection Logic (in the brief/sketch LLM prompt)

The LLM decides which tools to enable based on query analysis:

| Query Type | Tavily | arXiv | GitHub |
|---|---|---|---|
| Technical/academic (ML, physics, CS) | ✓ | ✓ | maybe |
| Software/tooling | ✓ | | ✓ |
| General knowledge | ✓ | | |
| Person/biography | ✓ | | |
| Comparison (X vs Y) | ✓ | maybe | maybe |

**Default:** Tavily always on. arXiv and GitHub opt-in based on LLM judgment.

### Query Decomposition

The LLM decomposes the user query into at most **one level** of hierarchy:

```json
{
  "overview": ["Who was Henry XIV?"],
  "specific": [
    "When was Henry XIV born?",
    "What wars did Henry XIV fight?",
    "What was Henry XIV's impact on French politics?"
  ]
}
```

- **overview:** 1 high-level, broad question (always present)
- **specific:** 2-5 targeted sub-questions (may be empty for simple queries)
- Each question becomes a search query routed to the selected tools
- Max total queries: 6 (1 overview + 5 specific) to control API cost

### arXiv Tool

- **API:** `GET https://export.arxiv.org/api/query?search_query={q}&max_results=5&sortBy=submittedDate&sortOrder=descending`
- **Response:** Atom XML — parse `<entry>` elements for title, summary, published date, authors, categories, PDF link
- **Rate limiting:** arXiv enforces polite crawling — add `sleep(1.0)` between requests
- **Output format:** Normalized to `Source` schema: `{ url, title, snippet, score: 0, source: "arxiv", metadata: { authors, date, categories } }`

### GitHub Tool

- **API:** `GET https://api.github.com/search/repositories?q={q}&sort=stars&order=desc&per_page=5`
- **Optional auth:** `Authorization: Bearer {GITHUB_TOKEN}` if env var set
- **Fields extracted:** full_name, description, stargazers_count, forks_count, updated_at, language, topics
- **README fetch:** `GET https://api.github.com/repos/{owner}/{repo}/readme?format=raw` — fetch README content as additional snippet (only for top 2 results to conserve rate limit)
- **Output format:** Normalized to `Source` schema: `{ url, title, snippet, score: 0, source: "github", metadata: { stars, forks, language, topics } }`

### Iteration Limits

- **Max iterations:** 3 (initial search → evaluate → revise → evaluate → revise → done)
- **Max wall-clock time:** 30 seconds (hard timeout, closes SSE stream)
- **Early termination:** Supervisor can emit "done" before hitting limits if findings are sufficient
- **Per-iteration:** Supervisor reviews accumulated findings, decides which tools to call and with what queries

### Scoring Algorithm

Same SIRA sketch-term filtering as current implementation, ported to Python or called via the existing `/api/research` scoring logic. Weighted scoring: term matches (50%), pattern matches (30%), domain matches (20%), with adaptive weights.

---

## Frontend: Live DAG Visualization

### Component: `ResearchTrace`

Replaces the static sketch display in the SIRA panel. Renders a **live growing DAG** that mirrors the LangGraph execution.

**Visual design:**
- Nodes appear as they are dispatched by the supervisor
- Node types: `brief` (purple), `tavily` (blue), `arxiv` (orange), `github` (gray), `scoring` (green)
- Connections (edges) animate with a flowing dash when data is in transit
- Completed nodes show result count badges
- Failed nodes show error icon
- The supervisor node sits at the top, with edges branching to tool nodes per iteration

**Node layout:**
```
         [Supervisor]
            │
     ┌──────┼──────┐
     ▼      ▼      ▼
  [Tavily] [arXiv] [GitHub]   ← iteration 1
     │      │      │
     └──────┼──────┘
            ▼
     [Supervisor eval]
            │
     ┌──────┴──────┐     ← iteration 2 (revised queries)
     ▼              ▼
  [Tavily]       [GitHub]
     │              │
     └──────┬───────┘
            ▼
      [Scoring] → [Results]
```

**SSE consumption:**
```typescript
const eventSource = new EventSource(`/api/research/stream?query=${encodeURIComponent(query)}`);
eventSource.addEventListener('brief_generated', (e) => { /* render brief node */ });
eventSource.addEventListener('tool_started', (e) => { /* add tool node, animate edge */ });
eventSource.addEventListener('tool_completed', (e) => { /* mark node done, show count */ });
eventSource.addEventListener('done', (e) => { /* render final sources, close stream */ });
```

### Frontend State

New state variables in `page.tsx`:
```typescript
const [researchTrace, setResearchTrace] = useState<TraceEvent[]>([]);
const [researchBrief, setResearchBrief] = useState<ResearchBrief | null>(null);
const [researchEventSource, setResearchEventSource] = useState<EventSource | null>(null);
```

---

## Code Style

### Python (sidecar)

```python
# Type hints everywhere, TypedDict for state
from typing import TypedDict, NotRequired

# Async throughout
async def search_arxiv(query: str, max_results: int = 5) -> list[Source]:
    ...

# Structured logging
logger.info("Tool %s returned %d results in %.1fs", tool, len(results), elapsed)

# ponytail: comments for deliberate shortcuts
# ponytail: arXiv XML parsed with regex — switch to xml.etree if edge cases appear
```

### TypeScript (frontend)

```typescript
// Existing patterns maintained — inline styles for DAG nodes,
// CSS modules for layout, no new dependencies
```

---

## Testing Strategy

| Layer | Approach | Location |
|---|---|---|
| arXiv tool | Unit test with mocked HTTP responses | `sidecar/test_research_arxiv.py` |
| GitHub tool | Unit test with mocked HTTP responses | `sidecar/test_research_github.py` |
| Sketch generation | Integration test against LLM endpoint | `sidecar/test_research_sketch.py` |
| SSE streaming | Manual verification (no framework) | Browser DevTools Network tab |
| Source scoring | Port existing TS tests or smoke test | `sidecar/test_research_scoring.py` |
| Full pipeline | End-to-end manual test with known query | Dashboard UI |

**No test frameworks added** — use `pytest` (already available via sidecar venv) for Python, manual verification for SSE/frontend.

---

## Boundaries

### Always
- Stream SSE events after every phase completion (never batch)
- Include the full final payload in the `done` event
- Close the SSE stream on timeout, error, or completion
- Normalize all tool results to the `Source` schema before scoring
- Log every tool call with duration and result count

### Ask First
- Adding new tool sources beyond Tavily/arXiv/GitHub
- Changing the iteration limit beyond 3
- Adding external dependencies beyond `langgraph`, `langchain-core`, `langchain-openai`
- Modifying the scoring algorithm weights

### Never
- Block the SSE stream on a single tool failure (use `Promise.allSettled` equivalent)
- Exceed 30 seconds wall-clock time
- Store research traces persistently (in-memory only, ephemeral)
- Add Polymarket or any prediction market integration (out of scope)

---

## Success Criteria

1. **Research brief is visible** — User sees the LLM's reasoning trace, assumptions, and tool selection before search begins.
2. **Live DAG renders accurately** — The frontend graph visualization updates in real-time as each tool executes, showing iterations, tool selections, and result counts.
3. **Tool selection is adaptive** — arXiv and GitHub are only queried when the LLM determines they're relevant to the query type.
4. **Query decomposition works** — Overview and specific sub-questions are generated and each produces search results.
5. **Iteration loop functions** — The supervisor can revise queries based on findings, up to 3 iterations.
6. **Graceful degradation** — If a tool fails (arXiv timeout, GitHub rate limit), the pipeline continues with remaining tools and notes the gap in the trace.
7. **30-second timeout enforced** — The SSE stream closes and returns partial results if the time limit is hit.
8. **Source scoring unchanged** — The SIRA sketch-term filtering produces the same quality rankings as before.
9. **Build passes** — `npm run build` in `app/` completes with zero errors. Sidecar starts without import errors.

---

## Open Questions

1. **GitHub token:** Should we require `GITHUB_TOKEN` in `.env` or work unauthenticated (10 req/min limit)? Unauthenticated is fine for personal use but will rate-limit during heavy research sessions.
2. **Scoring location:** Port the scoring algorithm to Python in the sidecar, or have the sidecar POST results back to Next.js for scoring? Porting to Python keeps the pipeline self-contained in the sidecar.
3. **DAG rendering:** Pure SVG/CSS for the DAG visualization (no D3, per existing spec constraints), or accept a lightweight graph library?
4. **Brief persistence:** Should completed research briefs be stored anywhere, or are they ephemeral (lost on page refresh)?

---

## Migration Path

1. Add LangGraph dependencies to sidecar `requirements.txt`
2. Create `sidecar/research/` module with graph definition, tools, sketch generation
3. Add `POST /research/stream` SSE endpoint to `sidecar/main.py`
4. Replace `app/app/api/research/route.ts` with SSE proxy
5. Update `app/app/page.tsx` with SSE consumer and DAG visualization component
6. Add DAG visualization styles to `app/app/page.module.css`
7. Test end-to-end with a known research query
