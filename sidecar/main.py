import asyncio
import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from lightrag.lightrag import QueryParam

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("sidecar")

# ── LightRAG initialization ──────────────────────────────────────────────
# Lazy init on first import — model download happens once, then cached.

def _create_embedding_func():
    """Build a sentence-transformers embedding function for LightRAG."""
    from sentence_transformers import SentenceTransformer
    from lightrag.lightrag import EmbeddingFunc

    model = SentenceTransformer("all-MiniLM-L6-v2")

    async def _embed(texts: list[str]) -> list[list[float]]:
        return model.encode(texts, normalize_embeddings=True)

    return EmbeddingFunc(
        embedding_dim=384,
        func=_embed,
        max_token_size=8192,
        model_name="all-MiniLM-L6-v2",
    )


def _create_llm_func():
    """Build an OpenAI-compatible LLM function from env vars."""
    from lightrag.llm.openai import openai_complete_if_cache

    async def _llm(
        prompt: str,
        system_prompt: str | None = None,
        history_messages: list | None = None,
        **kwargs,
    ) -> str:
        if history_messages is None:
            history_messages = []
        return await openai_complete_if_cache(
            model=os.getenv("OPENAI_MODEL_NAME", "gpt-4o-mini"),
            prompt=prompt,
            system_prompt=system_prompt,
            history_messages=history_messages,
            base_url=os.getenv("OPENAI_API_BASE"),
            api_key=os.getenv("OPENAI_API_KEY"),
            **kwargs,
        )

    return _llm


def _create_rag():
    """Create and return a LightRAG instance with Qdrant + NetworkX."""
    from lightrag import LightRAG

    # ponytail: ensure QDRANT_URL has a default so LightRAG doesn't hard-fail
    os.environ.setdefault("QDRANT_URL", "http://localhost:6333")

    working_dir = Path(__file__).parent / "data"

    rag = LightRAG(
        working_dir=str(working_dir),
        embedding_func=_create_embedding_func(),
        llm_model_func=_create_llm_func(),
        vector_storage="QdrantVectorDBStorage",
        graph_storage="NetworkXStorage",
        vector_db_storage_cls_kwargs={"cosine_better_than_threshold": 0.2},
    )
    logger.info("LightRAG initialized (embedding=%s, vector=Qdrant, graph=NetworkX)", "all-MiniLM-L6-v2")
    return rag


# ponytail: lazy init — defer until first call so Qdrant blips on startup don't kill the server
_rag: "LightRAG | None" = None
_rag_lock = asyncio.Lock()

async def get_rag():
    global _rag
    if _rag is None:
        async with _rag_lock:
            if _rag is None:  # double-check after lock
                _rag = _create_rag()
                await _rag.initialize_storages()
                logger.info("LightRAG storages initialized")
    return _rag


# ── FastAPI app ──────────────────────────────────────────────────────────

app = FastAPI()


@app.exception_handler(Exception)
async def handle_exception(request, exc):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(status_code=500, content={"error": str(exc)})


@app.get("/health")
async def health():
    return JSONResponse({"status": "ok"})


_VALID_MODES = {"naive", "local", "global", "hybrid"}

@app.post("/insert")
async def insert(request: Request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON body"})

    if not isinstance(data, dict):
        return JSONResponse(status_code=400, content={"error": "JSON body must be an object"})

    text = data.get("text")

    if not text or not isinstance(text, str) or not text.strip():
        return JSONResponse(status_code=400, content={"error": "text is required and must be non-empty"})

    filename = data.get("filename")  # ponytail: stored for metadata; not yet used by LightRAG

    try:
        rag = await get_rag()
        track_id = await rag.ainsert(text)
        return JSONResponse({
            "success": True,
            "message": f"Ingested {len(text)} characters",
            "track_id": track_id,
        })
    except Exception as e:
        logger.exception("Insert failed")
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/query")
async def query(request: Request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON body"})

    if not isinstance(data, dict):
        return JSONResponse(status_code=400, content={"error": "JSON body must be an object"})

    q = data.get("query")

    if not q or not isinstance(q, str) or not q.strip():
        return JSONResponse(status_code=400, content={"error": "query is required and must be non-empty"})

    mode = data.get("mode", "hybrid")

    if mode not in _VALID_MODES:
        return JSONResponse(status_code=400, content={"error": f"mode must be one of: {', '.join(sorted(_VALID_MODES))}"})

    try:
        rag = await get_rag()
        answer = await rag.aquery(q, QueryParam(mode=mode))
        return JSONResponse({"answer": answer, "mode": mode})
    except Exception as e:
        logger.exception("Query failed")
        return JSONResponse(status_code=500, content={"error": str(e)})
