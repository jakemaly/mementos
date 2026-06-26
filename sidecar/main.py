import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse

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
_rag: LightRAG | None = None

def get_rag():
    global _rag
    if _rag is None:
        _rag = _create_rag()
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
