# PRD: Personal Agent Memory System ("Brain")

**Owner:** Jake
**Status:** Draft for planning
**Version:** v0.1

## 1. Problem statement

Current agent interactions are stateless across sessions. Every conversation starts cold — the agent doesn't know what was decided yesterday, what tools are currently in use, or how a task was previously approached. The goal is a persistent, self-updating external memory system ("the brain") that gives any agent in Jake's stack continuity, personalization, and procedural competence without manual re-briefing.

## 2. Goals

- Agent retains continuity across sessions (episodic)
- Agent retains accurate, current facts about Jake, his tools, and his projects (semantic)
- Agent improves its own workflows over time based on what's worked (procedural)
- Knowledge from static sources (PDFs, docs, repos, video) and dynamic sources (calendar, inbox, DBs) is unified and queryable
- Retrieval stays efficient — context window is not bloated with raw history
- The system is human-readable and git-trackable (no opaque binary state)

## 3. Non-goals

- Not building a general-purpose multi-tenant memory product — this is single-user (Jake)
- Not replacing existing tools (Cursor, Pi.dev, Hermes) — this is a memory layer they all read/write to
- Not attempting full text-to-SQL or live DB reasoning in v1 — flagged as a future connector, not core scope

## 4. Background

Three memory types are needed and frequently conflated in public discourse:

- **Episodic** — what happened, when. Diary and task logs. Required for "where did I leave off."
- **Semantic** — what's true right now. Read-write facts and preferences that update over time.
- **Procedural** — how to do things. Learned instructions, written as agent-actionable directives, not retrieved data.

These three sit on top of a **Graph + RAG knowledge core** (LightRAG), which is structurally different from flat vector RAG: instead of retrieving isolated similar chunks, it extracts entities and relationships into a graph, so retrieval returns both precise facts (low-level) and connected context (high-level) in one pass.

## 5. System architecture

Three layers, modeled on Karpathy's LLM Wiki compiler pattern:

1. **`raw/`** — immutable source truth. Never edited by the agent. Two subtypes:
   - `raw/static/` — PDFs, repos, docs, video transcripts (slow-changing, ingested once then occasionally re-synced)
   - `raw/dynamic/` — calendar, inbox, DB snapshots (synced on a schedule)
2. **`wiki/`** — agent-owned, LLM-compiled. Contains semantic memory (`entities/`) and procedural memory (`procedures/`)
3. **`diary/` + `tasks/`** — agent-owned, append-only. Episodic memory.

All three layers feed into the LightRAG graph + vector index, which serves as the single retrieval surface for any agent in the stack.

```
brain/
├── AGENTS.md              ← schema / procedural bootstrap, loaded every session
├── index.md                ← navigation map
├── log.md                  ← chronological activity log
├── raw/
│   ├── static/{papers,repos,docs}/
│   └── dynamic/{calendar,inbox}/   ← MCP-connected, not flattened to markdown
├── wiki/
│   ├── entities/{jake.yaml, projects/, tools/}
│   ├── concepts/[topic].md
│   └── procedures/{coding.md, research.md, ...}
└── diary/
    ├── 2026-06-18.md
    └── archive/
```

## 6. Memory type specifications

### 6.1 Episodic memory

- **Write pattern:** timestamped chunks appended throughout the session (`14:30 — researched LightRAG incremental updates, decided to use it over GraphRAG`)
- **End-of-day pass:** auto-summarize the day's chunks into 3-5 bullets; this is what gets retained long-term. Raw timestamped chunks are noise once summarized and can be dropped or archived.
- **Storage:** one file per day (`diary/YYYY-MM-DD.md`), plus a running `tasks/active.yaml` for in-progress work and `tasks/archive/` for completed work
- **Retrieval use case:** "where did I leave off on the legal AI project"

### 6.2 Semantic memory

- **Write pattern:** the agent **queries the graph before writing** to check whether an entity or fact already exists — this is the primary defense against duplicate nodes (e.g. two separate "Python" entities)
- **Conflict resolution:** newest information **overwrites** the old fact directly (no dual-version bitemporal tracking by default). For facts where the change itself is meaningful (e.g. a tool switch, a role change), the old value gets a short deprecation note attached rather than being silently deleted, so the *fact* of change is preserved without polluting the live knowledge base with stale entries
- **Storage:** `.yaml` entity files (`entities/jake.yaml`, `entities/projects/*.yaml`, `entities/tools/*.yaml`) — chosen over markdown for this layer because structured facts diff cleanly and are easy for an LLM to query/update precisely
- **Retrieval use case:** "what stack does Jake currently use," "what's the status of the second-brain project"

### 6.3 Procedural memory

- **Write pattern:** the agent detects repeated patterns from its own diary entries (e.g. it notices the same multi-step approach succeeded 2-3 times) and writes a new `[procedure-name]: ...` entry into the relevant `procedures/*.md` file
- **Storage:** plain markdown instructions, injected directly into context at session start via `AGENTS.md` (or referenced from it) — procedural memory is instructions, not retrieved data, so it doesn't go through the RAG pipeline
- **Retrieval use case:** the agent automatically applies a learned coding workflow without being told the steps again

## 7. Knowledge core: Graph + RAG (LightRAG)

- **Construction:** every new or modified file in `wiki/` triggers entity/relationship extraction (LLM-based triple extraction: `(subject, relation, object)`), which gets merged into the existing graph incrementally — no full reindex
- **Retrieval:** hybrid dual-level —
  - low-level: precise entity-specific facts (vector similarity finds entry nodes, graph returns their direct edges)
  - high-level: thematic/conceptual clusters (broader graph neighborhoods)
  - merged and reranked before injection into context
- **Ranking signals at query time:** relevance (cosine similarity) + recency boost (favor recent diary/entity updates) + graph centrality (favor frequently-linked, well-connected entities)
- **Write path:** the agent writes `.md`/`.yaml` files directly to `wiki/`; LightRAG re-indexes incrementally on detecting the change. No separate graph API call required — the file *is* the source of truth, the graph is a derived index.

## 8. Source connectors

### 8.1 Static sources (one-time or periodic ingest → `raw/static/`)

| Source | Tool |
|---|---|
| PDFs | `docling` (structure-aware extraction) |
| YouTube | `yt-dlp` transcript extraction |
| Repos | README/docstrings/CHANGELOG only, filtered via `.brainignore` |
| Docs sites | `firecrawl` or equivalent clean-markdown crawler |

### 8.2 Dynamic sources (live, not flattened to markdown)

**Decision:** calendars, inboxes, and databases are **not** converted into static markdown snapshots. They are accessed via **MCP connectors or text-to-SQL** at query time, since these sources are higher-fidelity, queryable in their native structured form, and avoid staleness inherent to periodic file dumps.

- Calendar → MCP calendar connector, queried live or cached short-term
- Inbox → MCP email connector, queried live or cached short-term
- Databases → text-to-SQL agent tool, queried live against the actual schema

This keeps `raw/dynamic/` scoped to genuinely append-only logs (if any), not a parallel stale copy of live systems.

## 9. Self-update loop

**Per-session:**
1. Timestamped diary chunks appended live
2. End-of-day: auto-summarize day → diary entry finalized
3. Before any semantic write: query graph for existing entity/fact
4. If exists → overwrite + deprecation note on the old value; if new → create node + edges
5. LightRAG incrementally re-indexes the changed file

**Nightly cron:**
- Lint pass: detect orphan pages, contradictions, missing cross-references
- Dynamic connector health check (not data sync, since dynamic sources are live-queried)

**Less-frequent cron (e.g. monthly):**
- Purge pass: remove deprecated and forgotten knowledge that's aged out, preventing unbounded growth of the deprecation trail

## 10. Retrieval / context efficiency requirements

- The brain is external memory — it must never be loaded wholesale into context
- Only `AGENTS.md` (procedural schema, target <2K tokens) loads every session by default
- All other knowledge — entities, diary, concepts — is retrieved on demand via the hybrid LightRAG query, top-k chunks only
- No raw source documents (`raw/`) are ever directly injected into context; only compiled/extracted wiki content is retrievable

## 11. Open questions for implementation phase

- Exact threshold for "repeated pattern" detection before procedural memory writes a new procedure (count of occurrences? explicit success signal?)
- Whether deprecation notes themselves need a TTL distinct from the general purge cron
- Schema for entity/relationship types in the graph (initial draft: Person, Tool, Project, Concept, Event; uses, enables, related-to, learned-at, owns)
- Embedding model choice for local-first operation (current candidate: `nomic-embed-text` via Ollama)

## 12. Success criteria

- A new session can answer "what was I working on yesterday" without manual context
- A new session reflects current tool/stack preferences without being told
- The agent applies a previously-learned procedure unprompted when a matching task recurs
- Context window usage for a typical query stays within a small, bounded top-k retrieval (not full-document dumps)
- No duplicate entity nodes accumulate over a month of normal use