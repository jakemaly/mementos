# Implementation Plan: LightRAG Graph-Enhanced RAG Integration

## Overview

7 sequential steps. Each step leaves the codebase in a working state. Build follows the dependency graph: sidecar foundation → sidecar endpoints → Next.js proxy → frontend UI.

## Architecture Decisions

- **Single-file sidecar (`main.py`).** No abstractions. LightRAG init at module level, two POST routes.
- **Blocking LightRAG API.** Use `rag.insert()` and `rag.query()` (synchronous) — FastAPI routes handle one request at a time for RAG, which is fine for local dev. Async variants (`ainsert`/`aquery`) add complexity without benefit at this scale.
- **sentence-transformers embedding function.** Pass a callable to LightRAG's `embedding_func` parameter wrapping `SentenceTransformer('all-MiniLM-L6-v2')`. This produces 384-dim vectors matching the existing Next.js embeddings.
- **Qdrant vector storage.** Use `QdrantVectorDBStorage` from `lightrag.kg.qdrant_impl`. LightRAG handles the collection naming internally (prefixes with namespace).
- **LLM via OpenAI-compatible endpoint.** LightRAG's default `llm_model_func` uses the `OPENAI_API_BASE`/`OPENAI_API_KEY` env vars. No custom LLM wrapper needed.
- **No new npm dependencies.** Proxy routes use native `fetch`.

## Task List

### Step 1: Python Sidecar Boilerplate — FastAPI + Health Check

**Description:** Create `sidecar/` directory with `requirements.txt` and `main.py`. Set up FastAPI app with a `GET /health` endpoint returning `{"status": "ok"}`.

**Acceptance criteria:**
- [ ] `sidecar/requirements.txt` lists: `fastapi`, `uvicorn`, `lightrag-hku`, `sentence-transformers`, `qdrant-client`, `networkx`
- [ ] `sidecar/main.py` imports FastAPI, defines app, exposes `GET /health`
- [ ] Server starts on port 8000 with `uvicorn main:app --host 0.0.0.0 --port 8000`
- [ ] `curl http://localhost:8000/health` returns `{"status": "ok"}`

**Dependencies:** None

**Files touched:**
- `sidecar/requirements.txt` (new)
- `sidecar/main.py` (new)

**Estimated scope:** XS (2 files)

---

### Step 2: LightRAG Initialization — Embeddings + Qdrant + NetworkX

**Description:** Initialize LightRAG in `main.py` with:
- `embedding_func` wrapping `SentenceTransformer('all-MiniLM-L6-v2')`
- `vector_storage='QdrantVectorDBStorage'` connecting to Qdrant on localhost:6333
- `graph_storage='NetworkXStorage'` persisting to `sidecar/data/`
- LLM configured via env vars (`OPENAI_API_BASE`, `OPENAI_API_KEY`, `OPENAI_MODEL_NAME`)

**Acceptance criteria:**
- [ ] LightRAG instance created at module level (lazy init on first request is acceptable)
- [ ] Embedding function produces 384-dim vectors
- [ ] Qdrant connection succeeds (no exceptions at startup)
- [ ] `sidecar/data/` directory created on first write
- [ ] `GET /health` still returns `{"status": "ok"}`
- [ ] `sidecar/requirements.txt` updated with any additional dependencies discovered

**Dependencies:** Step 1

**Files touched:**
- `sidecar/main.py` (edit — add LightRAG init)
- `sidecar/requirements.txt` (edit — add dependencies if needed)

**Estimated scope:** M (1 file, config-heavy)

---

### Step 3: Sidecar Ingestion Endpoint — POST /insert

**Description:** Implement `POST /insert` in `main.py`. Accepts JSON body with `text` (required) and `filename` (optional). Calls `rag.insert(text)` to ingest text into LightRAG. Returns success response with track ID.

**Acceptance criteria:**
- [ ] Validates `text` is present and non-empty (400 on invalid)
- [ ] Calls `rag.insert(text)` successfully
- [ ] Returns `{"success": true, "message": "...", "track_id": "..."}`
- [ ] Error handling: catches exceptions, returns 500 with error message
- [ ] Manual test: `curl -X POST http://localhost:8000/insert -H 'Content-Type: application/json' -d '{"text":"The sky is blue because of Rayleigh scattering."}'` returns success

**Dependencies:** Step 2

**Files touched:**
- `sidecar/main.py` (edit — add /insert route)

**Estimated scope:** S (1 file)

---

### Step 4: Sidecar Query Endpoint — POST /query

**Description:** Implement `POST /query` in `main.py`. Accepts JSON body with `query` (required) and `mode` (optional, default `hybrid`, one of `naive|local|global|hybrid`). Calls `rag.query(query, QueryParam(mode=mode))` and returns the synthesized answer.

**Acceptance criteria:**
- [ ] Validates `query` is present and non-empty (400 on invalid)
- [ ] Validates `mode` is one of the 4 allowed values (400 on invalid)
- [ ] Default mode is `hybrid`
- [ ] Calls `rag.query(query, QueryParam(mode=mode))` successfully
- [ ] Returns `{"answer": "...", "mode": "..."}`
- [ ] Error handling: catches exceptions, returns 500 with error message
- [ ] Manual test: After ingesting text in Step 3, `curl -X POST http://localhost:8000/query -H 'Content-Type: application/json' -d '{"query":"Why is the sky blue?","mode":"hybrid"}'` returns a synthesized answer

**Dependencies:** Step 3

**Files touched:**
- `sidecar/main.py` (edit — add /query route)

**Estimated scope:** S (1 file)

---

### Step 5: Next.js API Proxy Routes — /api/rag/ingest and /api/rag/query

**Description:** Create two Next.js API routes that proxy frontend requests to the FastAPI sidecar.

**`POST /api/rag/ingest`:** Accepts `{ text, filename? }`, forwards to `http://localhost:8000/insert`.
**`POST /api/rag/query`:** Accepts `{ query, mode? }`, forwards to `http://localhost:8000/query`.

**Acceptance criteria:**
- [ ] `app/app/api/rag/ingest/route.ts` exists
- [ ] `app/app/api/rag/query/route.ts` exists
- [ ] Both validate required fields (400 on invalid)
- [ ] Both forward to sidecar with correct JSON body
- [ ] Both handle sidecar errors (non-200 response → 502 to client)
- [ ] Both handle network errors (sidecar down → 503 to client)
- [ ] `cd app && npm run build` exits 0

**Dependencies:** Step 4 (sidecar must have endpoints to proxy)

**Files touched:**
- `app/app/api/rag/ingest/route.ts` (new)
- `app/app/api/rag/query/route.ts` (new)

**Estimated scope:** S (2 files)

---

### Step 6: Frontend RAG Query Panel — page.tsx

**Description:** Add a RAG Query section to `page.tsx`. Includes:
- Query input (text)
- Mode selector dropdown (`naive`, `local`, `global`, `hybrid`)
- "Query" button that calls `POST /api/rag/query`
- Loading state (spinner)
- Answer display area (pre-formatted text)
- Text ingestion area: textarea for pasting text + "Ingest" button that calls `POST /api/rag/ingest`
- File ingestion: drag-and-drop or file picker for .txt/.md files

**Acceptance criteria:**
- [ ] RAG Query section renders below existing panels (full-width section like Deep Research)
- [ ] Query input, mode dropdown, and query button are present
- [ ] Query button calls `POST /api/rag/query` with `{ query, mode }`
- [ ] Loading state shows during query
- [ ] Answer renders in a styled container with `white-space: pre-wrap`
- [ ] Text ingestion textarea + "Ingest" button present
- [ ] File ingestion (drag-and-drop or file picker) for .txt/.md
- [ ] File ingestion calls `POST /api/rag/ingest` with `{ text: fileContent, filename: fileName }`
- [ ] Error/success messages use existing banner system
- [ ] `cd app && npm run build` exits 0

**Dependencies:** Step 5 (needs proxy routes)

**Files touched:**
- `app/app/page.tsx` (edit — add RAG state, handlers, JSX)

**Estimated scope:** M (1 file, significant diff)

---

### Step 7: Frontend RAG Styles — page.module.css

**Description:** Add CSS classes for the RAG Query panel. Reuse existing design tokens.

**Acceptance criteria:**
- [ ] Styles for: query input, mode dropdown, query button, answer display area, ingestion textarea, file dropzone (reuse existing `.dropzone` or add `.ragDropzone`)
- [ ] Uses existing CSS custom properties
- [ ] Glassmorphism styling matches existing cards
- [ ] Responsive at existing breakpoints
- [ ] `cd app && npm run build` exits 0

**Dependencies:** Step 6 (needs the JSX classes)

**Files touched:**
- `app/app/page.module.css` (edit — append RAG classes)

**Estimated scope:** XS (1 file)

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| sentence-transformers model download slow | Medium | Model downloads on first request; subsequent starts use cache. Acceptable for dev. |
| LightRAG LLM calls fail (no API key) | High | Sidecar returns 500 with clear error message. User must configure `OPENAI_API_KEY`. |
| Qdrant connection fails | High | Sidecar startup fails with clear error. Ensure Qdrant Docker container is running. |
| LightRAG uses different collection naming than existing app | Low | LightRAG namespaces its collections internally. No conflict with existing Qdrant collections. |
| Memory pressure from embedding model + LightRAG | Low | `all-MiniLM-L6-v2` is ~80MB. Acceptable for local dev. |

## Open Questions

1. **Sidecar process management:** For now, the sidecar is started manually (`uvicorn main:app`). No `docker-compose` integration or process manager. This is the laziest path — add Dockerization only if needed for deployment.
