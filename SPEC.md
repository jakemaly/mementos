# Spec: LightRAG Graph-Enhanced RAG Integration

## Objective

Add a Python FastAPI sidecar running LightRAG (graph-enhanced RAG with entity-relation extraction) alongside the existing Next.js dashboard. The sidecar handles ingestion and querying via `lightrag-hku` with `sentence-transformers` embeddings and Qdrant vector storage. The Next.js app proxies requests to the sidecar and exposes a RAG query panel on the dashboard with mode selection (`naive`, `local`, `global`, `hybrid`) and file ingestion support.

**Key difference from existing vector search:** Existing `/api/query` does plain cosine similarity search. LightRAG adds knowledge graph construction (entity extraction, relation discovery) and multi-mode retrieval that leverages graph structure for richer answers.

## Tech Stack

### Sidecar (Python)
- **Framework:** FastAPI + uvicorn
- **RAG Library:** `lightrag-hku` (latest)
- **Embeddings:** `sentence-transformers` (`all-MiniLM-L6-v2`, 384-dim) — matches existing Next.js model
- **Vector Storage:** Qdrant via `lightrag.kg.qdrant_impl.QdrantVectorDBStorage` — local instance on port 6333
- **Graph Storage:** NetworkX via `lightrag.kg.networkx_impl.NetworkXStorage` — persisted to `sidecar/data/`
- **LLM:** OpenAI-compatible API (`OPENAI_API_BASE`, `OPENAI_API_KEY`, `OPENAI_MODEL_NAME` env vars) — reused from existing research routes

### Next.js (existing)
- **Framework:** Next.js 16.2.9 (App Router)
- **Language:** TypeScript
- **Vector DB:** `@qdrant/js-client-rest` — existing (shared Qdrant instance)
- **CSS:** Vanilla CSS modules (existing `page.module.css`)

## Commands

```
# Next.js app
Dev:     npm run dev          (from /home/jake/projects/second-brain/app/)
Build:   npm run build

# Sidecar
Dev:     cd sidecar && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000
```

## Project Structure

```
sidecar/                          (NEW)
├── main.py                       (NEW — FastAPI app with LightRAG init + endpoints)
├── requirements.txt              (NEW — Python dependencies)
└── data/                         (NEW — runtime: NetworkX graph files, KV storage)

app/
├── app/
│   ├── api/
│   │   ├── rag/
│   │   │   ├── ingest/route.ts   (NEW — proxy to sidecar POST /insert)
│   │   │   └── query/route.ts    (NEW — proxy to sidecar POST /query)
│   │   ├── collections/route.ts  (existing, unchanged)
│   │   ├── ingest/route.ts       (existing, unchanged)
│   │   ├── query/route.ts        (existing, unchanged)
│   │   └── research/             (existing, unchanged)
│   ├── page.tsx                  (edit — add RAG Query panel section)
│   ├── page.module.css           (edit — add RAG panel styles)
│   └── ...                       (existing, unchanged)
└── lib/                          (existing, unchanged)
```

## Env Vars

| Var | Purpose | Used By |
|-----|---------|---------|
| `OPENAI_API_BASE` | LLM endpoint URL | Sidecar (LightRAG), existing research routes |
| `OPENAI_API_KEY` | LLM auth | Sidecar (LightRAG), existing research routes |
| `OPENAI_MODEL_NAME` | Model name (e.g. `gpt-4o-mini`) | Sidecar (LightRAG), existing research routes |
| `QDRANT_URL` | Qdrant endpoint (default `http://localhost:6333`) | Sidecar, existing Next.js app |

No new env vars beyond what already exists for the research routes.

## Code Style

- **Sidecar:** Flat `main.py` — no abstractions. FastAPI routes use `Request`/`JSONResponse` or `Response` from `fastapi`. Error handling via try/catch with 500 fallback.
- **Next.js proxy:** Follow existing pattern — `NextResponse.json`, try/catch, input validation at top of handler.
- **CSS:** Reuse existing CSS custom properties (`--primary`, `--glass-bg`, etc.).
- **Naming:** `camelCase` for TS, `snake_case` for Python.

## API Contracts

### Sidecar: POST /insert

**Request:**
```json
{
  "text": "string (required, non-empty)",
  "filename": "string (optional, for metadata)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "string",
  "track_id": "string (LightRAG track ID)"
}
```

**Flow:** Pass text to `rag.insert(text)`. LightRAG handles chunking, embedding, entity extraction, graph construction, and vector upsert.

### Sidecar: POST /query

**Request:**
```json
{
  "query": "string (required, non-empty)",
  "mode": "string (optional, one of: naive, local, global, hybrid, default: hybrid)"
}
```

**Response:**
```json
{
  "answer": "string (LLM-synthesized markdown response)",
  "mode": "string (the mode used)"
}
```

**Flow:** Call `rag.query(query, QueryParam(mode=mode))`. LightRAG retrieves relevant chunks via the selected strategy, constructs context from the knowledge graph, and calls the LLM to synthesize an answer.

### Next.js: POST /api/rag/ingest

**Request:**
```json
{
  "text": "string (required, non-empty)",
  "filename": "string (optional)"
}
```

**Response:** Proxied response from sidecar `/insert`.

**Flow:** Validate input → forward to `http://localhost:8000/insert` → return response.

### Next.js: POST /api/rag/query

**Request:**
```json
{
  "query": "string (required, non-empty)",
  "mode": "string (optional, default: hybrid)"
}
```

**Response:** Proxied response from sidecar `/query`.

**Flow:** Validate input → forward to `http://localhost:8000/query` → return response.

## UI Changes

Add a new section to `page.tsx` below the existing Deep Research section (or as a new full-width section). The RAG Query panel contains:

1. **RAG Query input** (text input)
2. **Mode selector** (dropdown: `naive`, `local`, `global`, `hybrid`)
3. **"Query" button**
4. **Loading state** (spinner + message)
5. **Markdown answer display** (renders the synthesized response)
6. **File/text ingestion area** (textarea for pasting text, or file upload for .txt/.md files)

The existing Vector Search panel (`/api/query`) and Deep Research panel remain unchanged. The RAG panel is a separate, independent section.

**Ponytail note:** No markdown rendering library. The answer is displayed as pre-formatted text (`<pre>` or `white-space: pre-wrap`) — LightRAG returns plain text with basic formatting, not full markdown. If rich markdown rendering is needed later, add `react-markdown`.

## Boundaries

- **Always do:** Validate all inputs at trust boundaries, reuse existing env vars, keep sidecar in a single `main.py`
- **Ask first:** Adding new npm or pip dependencies beyond what is specified
- **Never do:** Modify existing API routes (`/api/collections`, `/api/ingest`, `/api/query`, `/api/research`), modify existing `lib/` files, add test frameworks, add Tailwind

## Success Criteria

1. Sidecar starts on port 8000, health check returns `{"status": "ok"}`
2. LightRAG initializes with sentence-transformers embedding + Qdrant vector storage + NetworkX graph
3. `POST /insert` ingests text and builds the knowledge graph
4. `POST /query` returns synthesized answers for all 4 modes
5. Next.js proxy routes forward to sidecar correctly
6. Dashboard has RAG Query panel with mode selector and answer display
7. File ingestion works end-to-end from frontend through sidecar to LightRAG
8. `npm run build` succeeds with zero errors
