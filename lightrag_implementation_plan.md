# Implementation Plan: End-to-End LightRAG Integration

This document outlines the step-by-step development process to implement the end-to-end RAG system. It is structured using vertical slicing to ensure every checkpoint yields testable and working software.

---

## Architecture Decisions & Integration Strategy

* **Python FastAPI Sidecar**: Chosen to use the official Python `lightrag-hku` library, which contains all graph-enhanced RAG logic, and run it locally.
* **NetworkX + Local Storage**: NetworkX will act as our local graph database (stored as GML/pickle in a sidecar volume). This removes the need for Neo4j and simplifies local data file management.
* **sentence-transformers**: We will load the same `all-MiniLM-L6-v2` embedding model in Python so that the generated embedding vectors are aligned with Next.js.
* **Selectable Query Modes**: The UI dashboard will expose a selector to test/compare all 4 LightRAG query modes (`naive`, `local`, `global`, `hybrid`).

---

## Phase 1: Python Sidecar & LightRAG Foundation

### Task 1: Python Sidecar Boilerplate & FastAPI Setup
**Description:** Set up the initial `sidecar` directory, virtual environment, and python package dependencies. Expose a simple FastAPI application with a health check.

**Acceptance criteria:**
- `sidecar/requirements.txt` defines FastAPI, uvicorn, and dependencies.
- FastAPI server starts on port 8000.
- `GET http://localhost:8000/health` returns `{"status": "ok"}`.

**Verification:**
- Run: `cd sidecar && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt`
- Run: `uvicorn main:app --host 0.0.0.0 --port 8000`
- Manual check: Run `curl http://localhost:8000/health` and verify output.

**Dependencies:** None
**Files likely touched:**
- `sidecar/requirements.txt`
- `sidecar/main.py`
**Estimated scope:** Small

---

### Task 2: LightRAG Initialization with Qdrant & Local Embeddings
**Description:** Configure LightRAG in `sidecar/main.py` to use local `sentence-transformers` for embedding (model: `all-MiniLM-L6-v2`) and connect to Qdrant (using `QDRANT_URL` or localhost:6333) for vector storage. Configure it to write NetworkX graph data under `sidecar/data/`.

**Acceptance criteria:**
- FastAPI startup logic initializes LightRAG.
- LightRAG successfully creates/connects to the collection in Qdrant.
- `sidecar/data/` folder is initialized for graph file persistence.

**Verification:**
- Run uvicorn server and check log output to verify embedding models download/initialize and Qdrant client connects without exceptions.

**Dependencies:** Task 1
**Files likely touched:**
- `sidecar/main.py`
- `sidecar/requirements.txt`
**Estimated scope:** Medium

---

### Checkpoint: Foundation
- [ ] FastAPI server starts and runs on port 8000.
- [ ] LightRAG instance is loaded and connected to Qdrant vector database.

---

## Phase 2: RAG Ingestion & Querying (End-to-End)

### Task 3: Ingestion and Query Endpoints in Sidecar
**Description:** Implement FastAPI POST routes `/insert` (to accept and index raw text in LightRAG) and POST `/query` (to query LightRAG using `naive`, `local`, `global`, or `hybrid` mode and get synthesized text response).

**Acceptance criteria:**
- `POST /insert` successfully ingests text, extracts entity-relation graphs, updates local files, and upserts vectors to Qdrant.
- `POST /query` returns markdown answers using the specified query mode and the OpenAI-compatible LLM.

**Verification:**
- Open Swagger UI at `http://localhost:8000/docs`.
- Run a manual `/insert` with a snippet of text, then verify that `/query` returns a coherent response based on that text.

**Dependencies:** Task 2
**Files likely touched:**
- `sidecar/main.py`
**Estimated scope:** Medium

---

### Task 4: Next.js API Proxy Routes
**Description:** Add Next.js API routes `/api/rag/ingest` and `/api/rag/query` in the Next.js app to proxy frontend dashboard requests directly to the FastAPI sidecar on port 8000.

**Acceptance criteria:**
- Next.js API endpoints accept client-side requests and proxy them with proper error handling to the sidecar.

**Verification:**
- Run curl/Postman queries against `http://localhost:3000/api/rag/query` and verify forwarding to FastAPI.

**Dependencies:** Task 3
**Files likely touched:**
- `app/app/api/rag/ingest/route.ts`
- `app/app/api/rag/query/route.ts`
**Estimated scope:** Small

---

### Task 5: Frontend Ingestion & Query Dashboard Panel
**Description:** Add UI panels to `/app/page.tsx` for LightRAG. Include controls for uploading/indexing text and a RAG Query window with a dropdown to select RAG modes (`naive`, `local`, `global`, `hybrid`) and show the generated markdown answer.

**Acceptance criteria:**
- Dashboard features a dedicated RAG Query interface.
- Dropdown allows selecting all four RAG modes.
- Synthesized markdown is fully readable and styled nicely.
- Ingestion pane supports loading files directly into the LightRAG pipeline.

**Verification:**
- Run `npm run build` inside `app` to ensure compilation succeeds.
- Open the dashboard in a web browser, run a RAG ingestion, and perform queries to test output.

**Dependencies:** Task 4
**Files likely touched:**
- `app/app/page.tsx`
- `app/app/page.module.css`
**Estimated scope:** Medium

---

### Checkpoint: Complete Integration
- [ ] End-to-end document ingestion from frontend to LightRAG works.
- [ ] RAG answers are successfully retrieved, synthesized, and displayed on the dashboard for all four modes.
- [ ] All build, lint, and type check commands pass.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Local Sentence-Transformer model downloading speed / local memory limits | Medium | Use lightweight model (`all-MiniLM-L6-v2`), cache downloaded models locally, and verify startup logs. |

## Open Questions

1. **Venv vs Docker**: Should the python sidecar be launched directly via a local virtual environment (recommended for development), or should we add it to the `docker-compose.yml` right away?
2. **Text Chunking**: Should we align chunking parameters (chunk size, overlap) in the sidecar with the values selected on the Next.js dashboard, or let LightRAG use its own default internal chunking (typically 600 tokens)?
