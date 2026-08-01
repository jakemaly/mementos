# Mementos

A deep-research agent and LightRAG visualization for personal knowledge management.

---

## Run locally

### Prerequisites

* Node.js 20+ & npm
* Python 3.10+
* Docker (for Qdrant Vector DB)

### 1. Set Environment Variables

```bash
cp .env.example .env
# Edit .env and add your API keys.
```

### 2. Start Qdrant

```bash
docker compose -f app/docker-compose.yml up -d
```

### 3. Start the Sidecar

```bash
cd sidecar
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 4. Start the Frontend

```bash
cd app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Repository layout

* `app/` — Next.js frontend
* `sidecar/` — FastAPI and LightRAG service
* `docs/` — design and architecture notes

---

## Features

### Deep Research (SIRA)

Inspired by the [SIRA](https://arxiv.org/abs/2605.06647) paper from Meta. An LLM generates an "expected-response sketch" — core concepts and optimized search phrases from a single prompt — then executes parallel web searches via Tavily, ranks results against the sketch, and ingests the best pages into the local vector DB.

### Graph-Enhanced RAG (LightRAG)

Powered by [LightRAG](https://arxiv.org/abs/2410.05779) from HKU. Documents are parsed into entity-relation knowledge graphs (NetworkX + Qdrant). Four retrieval modes:

* **naive** — standard vector search
* **local** — close entities and neighbors
* **global** — high-level structural topics
* **hybrid** — local detail + global patterns

### Local Semantic Search

384-d embeddings via `all-MiniLM-L6-v2` running locally. Cosine similarity search against ingested documents in Qdrant.

---

## Credits

* **SIRA** — Yang, Zeyu et al. "Superintelligent Retrieval Agent: The Next Frontier of Information Retrieval." arXiv:2605.06647, 2026.
* **LightRAG** — Guo, Zirui et al. "LightRAG: Simple and Fast Retrieval-Augmented Generation." arXiv:2410.05779, 2024.

---

## License

MIT
