# Local setup

Mementos runs a Next.js app, a FastAPI sidecar, and Qdrant. Use Node.js 20.9+, Python 3.12+, and Docker with Compose. The launcher uses Bash (on Windows, use WSL).

## Quick start

From the repository root:

```bash
cp .env.example .env
```

Edit `.env` with an OpenAI-compatible API key, endpoint and model, plus a Tavily API key for web research. Then run:

```bash
bash start.sh
```

Open [localhost:3000](http://localhost:3000). Press Ctrl+C in the launcher terminal to stop the services. Indexing and research use the configured APIs; embeddings run locally and download models on first use.

## Manual start

Start Qdrant from the repository root:

```bash
docker compose -f app/docker-compose.yml up -d
```

In a second terminal, start the sidecar:

```bash
cd sidecar
python3 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

The sidecar reads the root `.env`. In a third Bash terminal, start the app from the repository root. Export the variables so Next.js also receives the API keys:

```bash
set -a
source .env
set +a
cd app
npm ci
npm run dev
```

Stop the app and sidecar with Ctrl+C, then run `docker compose -f app/docker-compose.yml down` from the root. Data stays in `app/qdrant_storage/` and `sidecar/data/`; generated TouchDesigner snapshots live at `sidecar/graph_dump.json`. These files are ignored by Git.

## Checks

From `app/`:

```bash
npm run lint
npm run build
node test-deep-research-frontend.mjs
node test-deep-research-routes.mjs
node test-rag-frontend.mjs
node test-rag-routes.mjs
npx --yes tsx test-rag-runtime.mjs
```

From `sidecar/`, with its virtual environment activated:

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

## TouchDesigner

The repository includes the Python bridge, graph export, and snapshot contract. Add your own TouchDesigner scene and visual; no `.toe` scene is included. See the [bridge contract](touchdesigner.md) and [media slots](../assets/README.md).
