import asyncio
import json
import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from lightrag.lightrag import QueryParam

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("sidecar")

# load .env file from current or parent directories
for _p in [Path(".env"), Path("../.env"), Path(__file__).parent / ".env", Path(__file__).parent.parent / ".env"]:
    if _p.exists():
        logger.info("Loading environment variables from %s", _p.resolve())
        with open(_p, encoding="utf-8") as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith("#") and "=" in _line:
                    _k, _v = _line.split("=", 1)
                    _k = _k.strip()
                    _v = _v.strip().strip("'\"")
                    if _k:
                        os.environ.setdefault(_k, _v)
        break


# ── LightRAG initialization ──────────────────────────────────────────────
# Lazy init on first import — model download happens once, then cached.

def _create_embedding_func():
    """Build a sentence-transformers embedding function for LightRAG."""
    from sentence_transformers import SentenceTransformer
    from lightrag.lightrag import EmbeddingFunc

    model = SentenceTransformer("all-MiniLM-L6-v2")

    async def _embed(texts: list[str]) -> list[list[float]]:
        return await asyncio.to_thread(model.encode, texts, normalize_embeddings=True)

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


from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(Exception)
async def handle_exception(request, exc):
    if isinstance(exc, StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
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
        snapshot = await refresh_graph_dump()
        return JSONResponse({
            "success": True,
            "message": f"Ingested {len(text)} characters",
            "track_id": track_id,
            "graph_snapshot_id": snapshot["snapshot_id"],
        })
    except Exception as e:
        logger.exception("Insert failed")
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/query")
async def query(request: Request):
    # Lock-free concurrency: read-only queries run concurrently without a serialization lock
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


# ── TD retrieval bridge (4-mode entity IDs over WebSocket) ────────────────

_GRAPH_DUMP = Path(__file__).parent / "graph_dump.json"
_MODES = ("naive", "local", "global", "hybrid")
_graph_dump_lock = asyncio.Lock()


def _snapshot_id(data: dict) -> str:
    """Stable identifier for the exact graph payload consumed by TD."""
    import hashlib

    encoded = json.dumps(data, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def _load_graph_snapshot() -> dict:
    """Load one complete, atomically-published graph snapshot."""
    if not _GRAPH_DUMP.exists():
        raise FileNotFoundError(f"Run dump_graph.py first; missing {_GRAPH_DUMP}")
    data = json.loads(_GRAPH_DUMP.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("graph_dump.json must contain a JSON object")
    return {**data, "snapshot_id": _snapshot_id(data)}


def _lookups_from_snapshot(snapshot: dict) -> tuple[dict[str, str], dict[tuple[str, str], str]]:
    """entity_name -> qdrant id; (src,tgt) -> relationship qdrant id."""
    name_to_id = snapshot["name_to_id"]
    pair_to_rel: dict[tuple[str, str], str] = {}
    for r in snapshot.get("relationships", []):
        p = r.get("payload") or {}
        src, tgt = p.get("src_id"), p.get("tgt_id")
        if src and tgt:
            pair_to_rel[(src, tgt)] = r["id"]
            pair_to_rel[(tgt, src)] = r["id"]  # ponytail: undirected graph
    return name_to_id, pair_to_rel


def _load_lookups() -> tuple[dict[str, str], dict[tuple[str, str], str]]:
    """Compatibility helper for callers that only need ID lookups."""
    return _lookups_from_snapshot(_load_graph_snapshot())


async def refresh_graph_dump() -> dict:
    """Rebuild and atomically publish the TD graph after a completed insert."""
    async with _graph_dump_lock:
        from dump_graph import dump, write_dump

        data = await asyncio.to_thread(dump)
        await asyncio.to_thread(write_dump, data, _GRAPH_DUMP)
        return _load_graph_snapshot()


@app.get("/td/graph")
async def td_graph():
    """Return the current complete graph plus its immutable snapshot ID."""
    try:
        return JSONResponse(_load_graph_snapshot())
    except Exception as e:
        logger.exception("TD graph snapshot unavailable")
        return JSONResponse(status_code=503, content={"error": str(e)})


@app.post("/td/refresh")
async def td_refresh():
    """Retry graph publication without re-ingesting a document."""
    try:
        snapshot = await refresh_graph_dump()
        return JSONResponse({"success": True, "snapshot_id": snapshot["snapshot_id"]})
    except Exception as e:
        logger.exception("TD graph refresh failed")
        return JSONResponse(status_code=503, content={"error": str(e)})


async def _mode_ids(rag, query: str, mode: str, name_to_id, pair_to_rel) -> dict:
    # ponytail: aquery_data already returns structured entities — skip context parsing
    raw = await rag.aquery_data(query, QueryParam(mode=mode))
    section = (raw or {}).get("data") or {}
    entity_ids = []
    for e in section.get("entities") or []:
        n = e.get("entity_name")
        if n in name_to_id:
            entity_ids.append(name_to_id[n])
    relation_ids = []
    for r in section.get("relationships") or []:
        rid = pair_to_rel.get((r.get("src_id"), r.get("tgt_id")))
        if rid:
            relation_ids.append(rid)
    return {"entity_ids": entity_ids, "relation_ids": relation_ids}


@app.websocket("/ws/retrieval")
async def retrieval_socket(ws: WebSocket):
    await ws.accept()
    rag = await get_rag()
    try:
        while True:
            query = await ws.receive_text()
            try:
                snapshot = _load_graph_snapshot()
                name_to_id, pair_to_rel = _lookups_from_snapshot(snapshot)
            except Exception as e:
                await ws.send_json({"error": str(e)})
                continue

            result = {}
            for mode in _MODES:
                try:
                    result[mode] = await _mode_ids(rag, query, mode, name_to_id, pair_to_rel)
                except Exception as e:
                    logger.exception("retrieval mode=%s failed", mode)
                    result[mode] = {"entity_ids": [], "relation_ids": [], "error": str(e)}
            await ws.send_json({"snapshot_id": snapshot["snapshot_id"], "modes": result})
    except WebSocketDisconnect:
        return


# ── Research SSE endpoint ────────────────────────────────────────────────

from fastapi.responses import StreamingResponse


def _sse_frame(event: str, data: str) -> str:
    return f"event: {event}\ndata: {data}\n\n"


@app.post("/research/stream")
async def research_stream(request: Request):
    """SSE endpoint for the agentic research pipeline.

    Validates request → runs research graph → streams trace events as SSE.
    Emits terminal `done` with full payload. Emits `error` only when no
    useful partial result exists.
    """
    try:
        data = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON body"})

    if not isinstance(data, dict):
        return JSONResponse(status_code=400, content={"error": "JSON body must be an object"})

    query = data.get("query")
    if not query or not isinstance(query, str) or not query.strip():
        return JSONResponse(status_code=400, content={"error": "query is required and must be non-empty"})

    async def event_generator():
        from research.graph import run_research

        queue: asyncio.Queue = asyncio.Queue()

        def _on_event(ev: dict):
            queue.put_nowait(ev)

        task = asyncio.create_task(
            run_research(
                query=query,
                on_event=_on_event,
            )
        )

        try:
            while not task.done() or not queue.empty():
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=0.1)
                    yield _sse_frame(event["type"], json.dumps(event))
                except asyncio.TimeoutError:
                    continue

            result = await task
            yield _sse_frame("done", json.dumps(result))
        except asyncio.CancelledError:
            task.cancel()
            raise
        except Exception as e:
            logger.exception("Research stream failed")
            yield _sse_frame("error", json.dumps({"phase": "stream", "message": str(e)}))
        finally:
            if not task.done():
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
