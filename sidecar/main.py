import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("sidecar")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: validate critical imports
    try:
        from lightrag import LightRAG  # noqa: F401
        from sentence_transformers import SentenceTransformer  # noqa: F401
        from qdrant_client import QdrantClient  # noqa: F401
        import networkx  # noqa: F401
        logger.info("All critical imports OK")
    except ImportError as e:
        logger.error("Startup import failure: %s", e)
        raise
    yield
    logger.info("Shutting down")


app = FastAPI(lifespan=lifespan)


@app.exception_handler(Exception)
async def handle_exception(request, exc):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(status_code=500, content={"error": str(exc)})


@app.get("/health")
async def health():
    return JSONResponse({"status": "ok"})
