# second-brain: Graph-RAG & Memory Dashboard

An interactive, AI-enhanced memory layer for personal knowledge management. second-brain combines local vector similarity search, deep web-research pipelines (SIRA), and graph-enhanced RAG networks (LightRAG) into a unified glassmorphic workspace.

---

## 🚀 How to Run the Program (Quick Start)

To start the complete application (Qdrant database, FastAPI sidecar, and Next.js frontend), follow these steps:

### 1. Set Environment Variables
Ensure you have configured the required API keys and endpoint configurations in your shell:
```bash
export OPENAI_API_KEY="your-llm-api-key"
export OPENAI_API_BASE="https://api.openai.com/v1" # Or custom LLM endpoint
export OPENAI_MODEL_NAME="gpt-4o-mini"             # Model of choice
export TAVILY_API_KEY="your-tavily-search-key"
```

### 2. Start the Qdrant Vector Database
Spin up the local Qdrant instance via Docker Compose:
```bash
docker compose -f app/docker-compose.yml up -d
```

### 3. Run the Python FastAPI Sidecar
Initialize the virtual environment, install requirements, and run the server:
```bash
cd sidecar
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 4. Run the Next.js Frontend
In a new terminal, install Node.js dependencies and start the development server:
```bash
cd app
npm install
npm run dev
```

### 5. Access the Dashboard
Open your web browser and navigate to:
* **Dashboard:** [http://localhost:3000](http://localhost:3000)
* **Sidecar API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---


## 🌟 Key Features

### 1. Local Semantic Vector Search
* **Local Embeddings**: Generates 384-dimensional normalized embeddings on the fly using `@huggingface/transformers` (`all-MiniLM-L6-v2`) running locally.
* **Vector DB storage**: Indexes document chunks and search vectors into a high-performance [Qdrant](https://qdrant.tech/) vector database.
* **Similarity Retrieval**: Matches query vectors against ingested notes via cosine similarity scoring, returning metadata tags and character offsets.

### 2. Deep Research Pipeline (SIRA)
* **Search, Investigate, Research, Analyze**: Leverages an LLM to generate an "expected-response sketch" containing core concepts and optimized search phrases from a single prompt.
* **Parallel Web Crawling**: Executes searches in parallel across the Tavily Search API.
* **Sketch-Term Filtering**: Ranks and filters search snippets against the generated LLM sketch keywords before ingesting selected pages back into the local vector DB.

### 3. Graph-Enhanced RAG Integration (LightRAG)
* **Knowledge Graphs**: Utilizes `lightrag-hku` to parse raw documents into entity-relation graphs, backed by local NetworkX and Qdrant storage.
* **4-Mode Retrieval**: Allows users to dynamically query the knowledge base in four modes:
  * `naive`: Standard vector search (ignores relations).
  * `local`: Focuses on close entities and neighboring node relationships.
  * `global`: Synthesizes global topics and high-level structural links.
  * `hybrid`: Merges local detail with global graph patterns.

---

## 🏗️ Architecture & Data Flow

```mermaid
graph TD
    User([User]) <--> Dashboard[Next.js Frontend Dashboard]
    Dashboard <--> NextAPI[Next.js API Routes]
    
    subgraph Next.js API Routes
        QueryAPI[/api/query]
        IngestAPI[/api/ingest]
        ResearchAPI[/api/research]
        RAGAPI[/api/rag/*]
    end
    
    subgraph Python FastAPI Sidecar [Port 8000]
        LightRAG[LightRAG HKU Engine]
        EmbedModel[Local sentence-transformers]
    end

    QueryAPI <--> Qdrant[(Qdrant Vector DB)]
    IngestAPI --> Qdrant
    ResearchAPI <--> Tavily[Tavily Search API]
    ResearchAPI <--> OpenAI[OpenAI / LLM API]
    
    RAGAPI <--> LightRAG
    LightRAG <--> Qdrant
    LightRAG <--> NetX[(Local NetworkX GML)]
    LightRAG <--> OpenAI
```

---

## 🛠️ Technology Stack

* **Frontend**: Next.js 16 (App Router), TypeScript, Vanilla CSS Modules.
* **Vector DB**: Qdrant (rest client client in Next.js & native Python client in sidecar).
* **Graph DB**: NetworkX (local file-based GML).
* **RAG Framework**: `lightrag-hku` (FastAPI sidecar).
* **Embeddings**: Local Hugging Face `all-MiniLM-L6-v2` (running via Javascript in Next.js and via Python `sentence-transformers` in sidecar).
* **APIs**: OpenAI-compatible LLM endpoint & Tavily Search API.

---

## 🚀 Getting Started

### 📋 Prerequisites
* Node.js 20+ & npm
* Python 3.10+
* Docker (for Qdrant Vector DB)

### 1. Vector Database Setup
Launch the Qdrant container:
```bash
docker compose -f app/docker-compose.yml up -d
```

### 2. Python FastAPI Sidecar Setup
Create virtual environment and launch sidecar:
```bash
cd sidecar
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Next.js Frontend Dashboard Setup
Install packages and run the Next.js dev server:
```bash
cd app
npm install
npm run dev
```

Open `http://localhost:3000` to view the dashboard.

---

## ⚙️ Environment Variables

The project reads settings from your environment variables:

| Variable | Description | Required? |
|---|---|---|
| `OPENAI_API_KEY` | Authentication key for the LLM API | Yes |
| `OPENAI_API_BASE` | URL for the OpenAI-compatible endpoint | Yes |
| `OPENAI_MODEL_NAME`| Model to use (e.g., `gpt-4o-mini`, `llama3`) | Yes |
| `TAVILY_API_KEY` | Tavily Search API auth token for SIRA research | Yes |
| `QDRANT_URL` | Qdrant host address (default: `http://localhost:6333`) | No |

---

## 📂 Project Structure

```
second-brain/
├── app/                           # Next.js Frontend Application
│   ├── app/
│   │   ├── api/
│   │   │   ├── query/             # Local similarity search proxy
│   │   │   ├── ingest/            # Local document ingestion proxy
│   │   │   ├── research/          # SIRA research & crawl proxy
│   │   │   └── rag/               # LightRAG sidecar query/ingest proxy
│   │   ├── page.tsx               # Main Dashboard UI
│   │   └── page.module.css        # Dashboard Styles
│   └── lib/                       # Next.js DB & Embedding Configs
├── sidecar/                       # Python FastAPI Service
│   ├── main.py                    # Sidecar endpoints & LightRAG wrapper
│   ├── requirements.txt           # Python dependencies
│   ├── data/                      # Local NetworkX graph database folder
│   └── test_*.py                  # Automated integration tests
└── README.md
```

---

## 🧪 Testing

You can run the automated static and HTTP integration test suites inside the `/sidecar` directory:
```bash
cd sidecar
source venv/bin/activate

# Run the document ingestion test suite (POST /insert)
python test_step3_insert.py

# Run the query capability test suite (POST /query)
python test_step4_query.py
```
