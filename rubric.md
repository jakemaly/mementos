# Rubric: LightRAG Graph-Enhanced RAG Integration

Verification checklist mapped 1:1 to implementation steps. Each step must pass before moving to the next.

## Step 1: Python Sidecar Boilerplate — FastAPI + Health Check

- [ ] `sidecar/requirements.txt` exists and contains: `fastapi`, `uvicorn`, `lightrag-hku`, `sentence-transformers`
- [ ] `sidecar/main.py` exists and defines a FastAPI app
- [ ] `GET /health` returns `{"status": "ok"}` with status 200
- [ ] Server starts with `cd sidecar && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 8000`
- [ ] `curl http://localhost:8000/health` returns `{"status": "ok"}`
- [ ] Sidecar listens on port 8000

---

## Step 2: LightRAG Initialization — Embeddings + Qdrant + NetworkX

- [ ] `sidecar/main.py` imports and configures `LightRAG` from `lightrag`
- [ ] Embedding function uses `SentenceTransformer('all-MiniLM-L6-v2')` and produces 384-dim vectors
- [ ] `vector_storage` is set to `'QdrantVectorDBStorage'`
- [ ] `graph_storage` is set to `'NetworkXStorage'`
- [ ] LLM configured via env vars: `OPENAI_API_BASE`, `OPENAI_API_KEY`, `OPENAI_MODEL_NAME`
- [ ] Qdrant connects to `http://localhost:6333` (or `QDRANT_URL` env var)
- [ ] `sidecar/data/` directory is created on first write (not pre-created)
- [ ] `GET /health` still returns `{"status": "ok"}`
- [ ] Server startup logs show no exceptions related to LightRAG init
- [ ] `pip install -r requirements.txt` succeeds without errors

---

## Step 3: Sidecar Ingestion Endpoint — POST /insert

- [ ] `POST /insert` route exists in `sidecar/main.py`
- [ ] Validates `text` field is present and non-empty → returns 400 on missing/empty
- [ ] `filename` field is optional (no error when omitted)
- [ ] Calls `rag.insert(text)` successfully
- [ ] Returns JSON: `{"success": true, "message": "...", "track_id": "..."}`
- [ ] Exception handling: returns 500 with error message on failure
- [ ] **Manual test:** `curl -X POST http://localhost:8000/insert -H 'Content-Type: application/json' -d '{"text":"Photosynthesis converts sunlight into chemical energy."}'` returns success
- [ ] **Manual test:** `curl -X POST http://localhost:8000/insert -H 'Content-Type: application/json' -d '{"text":""}'` returns 400

---

## Step 4: Sidecar Query Endpoint — POST /query

- [ ] `POST /query` route exists in `sidecar/main.py`
- [ ] Validates `query` field is present and non-empty → returns 400 on missing/empty
- [ ] Validates `mode` is one of `naive`, `local`, `global`, `hybrid` → returns 400 on invalid mode
- [ ] Default mode is `hybrid` when not specified
- [ ] Calls `rag.query(query, QueryParam(mode=mode))` successfully
- [ ] Returns JSON: `{"answer": "...", "mode": "..."}`
- [ ] Exception handling: returns 500 with error message on failure
- [ ] **Manual test:** After ingesting text in Step 3, `curl -X POST http://localhost:8000/query -H 'Content-Type: application/json' -d '{"query":"What is photosynthesis?","mode":"hybrid"}'` returns a synthesized answer
- [ ] **Manual test:** All 4 modes work: `naive`, `local`, `global`, `hybrid`
- [ ] **Manual test:** Omitting `mode` defaults to `hybrid`

---

## Step 5: Next.js API Proxy Routes — /api/rag/ingest and /api/rag/query

- [ ] `app/app/api/rag/ingest/route.ts` exists
- [ ] `app/app/api/rag/query/route.ts` exists
- [ ] **Ingest proxy:** Validates `text` is present and non-empty → returns 400 on invalid
- [ ] **Ingest proxy:** Forwards to `http://localhost:8000/insert` with JSON body `{ text, filename? }`
- [ ] **Ingest proxy:** Returns sidecar response to client on success
- [ ] **Ingest proxy:** Returns 502 when sidecar returns non-200
- [ ] **Ingest proxy:** Returns 503 when sidecar is unreachable (network error)
- [ ] **Query proxy:** Validates `query` is present and non-empty → returns 400 on invalid
- [ ] **Query proxy:** Forwards to `http://localhost:8000/query` with JSON body `{ query, mode? }`
- [ ] **Query proxy:** Returns sidecar response to client on success
- [ ] **Query proxy:** Returns 502 when sidecar returns non-200
- [ ] **Query proxy:** Returns 503 when sidecar is unreachable (network error)
- [ ] `cd app && npm run build` exits 0
- [ ] **Manual test:** `curl -X POST http://localhost:3000/api/rag/query -H 'Content-Type: application/json' -d '{"query":"test"}'` returns proxied response (with sidecar running)

---

## Step 6: Frontend RAG Query Panel — page.tsx

- [ ] RAG Query section renders as a full-width card below existing panels
- [ ] Section title: "LightRAG Query" or similar
- [ ] Query input (text field) is present
- [ ] Mode selector dropdown with options: `naive`, `local`, `global`, `hybrid`
- [ ] "Query" button present and functional
- [ ] Query button calls `POST /api/rag/query` with `{ query, mode }`
- [ ] Loading state shows spinner during query execution
- [ ] Answer renders in a styled container with `white-space: pre-wrap`
- [ ] Text ingestion textarea is present
- [ ] "Ingest" button present and functional
- [ ] File ingestion supports .txt and .md files (drag-and-drop or file picker)
- [ ] File ingestion calls `POST /api/rag/ingest` with `{ text: fileContent, filename: fileName }`
- [ ] Error messages display in existing error banner
- [ ] Success messages display in existing success banner
- [ ] Existing Vector Search panel is unchanged (regression check)
- [ ] Existing Deep Research panel is unchanged (regression check)
- [ ] `cd app && npm run build` exits 0

---

## Step 7: Frontend RAG Styles — page.module.css

- [ ] CSS classes exist for: RAG query input, mode dropdown, query button, answer display, ingestion textarea, file dropzone
- [ ] Uses existing CSS custom properties (`--primary`, `--glass-bg`, `--text-primary`, etc.)
- [ ] Glassmorphism styling matches existing cards
- [ ] Responsive at existing breakpoints (1280px, 768px)
- [ ] No CSS conflicts with existing classes
- [ ] `cd app && npm run build` exits 0

---

## Final Checkpoint

- [ ] All 7 steps pass
- [ ] `cd app && npm run build` exits 0 (full project)
- [ ] No new npm dependencies added to `package.json`
- [ ] Existing routes (`/api/collections`, `/api/ingest`, `/api/query`, `/api/research`) still work unchanged
- [ ] Existing Vector Search and Deep Research UI panels still work unchanged
- [ ] End-to-end flow works: ingest text via frontend → query via frontend → receive synthesized answer
- [ ] All 4 RAG modes (`naive`, `local`, `global`, `hybrid`) produce responses
