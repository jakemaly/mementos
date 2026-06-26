# Walkthrough: LightRAG Graph-Enhanced RAG Integration

## Summary

End-to-end LightRAG integration with Python FastAPI sidecar + Next.js frontend dashboard. 7 sequential features built and verified.

## Files Created

| File | Purpose |
|------|---------|
| `sidecar/main.py` | FastAPI app with LightRAG (lazy init), POST /insert, POST /query, GET /health |
| `sidecar/requirements.txt` | 6 deps: fastapi, uvicorn, lightrag-hku, sentence-transformers, qdrant-client, networkx |
| `app/app/api/rag/ingest/route.ts` | Proxy to sidecar /insert with validation, timeout (60s), error handling |
| `app/app/api/rag/query/route.ts` | Proxy to sidecar /query with mode validation, timeout (120s), error handling |

## Files Modified

| File | Changes |
|------|---------|
| `app/app/page.tsx` | Added RAG Query section: query input, mode dropdown, answer display, text ingestion, file ingestion |
| `app/app/page.module.css` | Added 6 CSS classes for RAG panel (extracted from inline styles) |
| `app/eslint.config.mjs` | Added ignore for test files |

## Key Bugs Fixed During Verification

1. **`.tolist()` crash** — embedding func returned list instead of numpy array, causing `AttributeError: 'list' object has no attribute 'size'` on every insert/query. Fixed: removed `.tolist()`.
2. **Event loop conflict** — `rag.insert()` called from async handler crashed with `RuntimeError`. Fixed: switched to `await rag.ainsert()`.
3. **Missing storage init** — `PipelineNotInitializedError` on every insert. Fixed: added `await rag.initialize_storages()` in lazy init.
4. **Non-dict JSON body** — array/string JSON bodies caused 500 with exposed Python error. Fixed: `isinstance(data, dict)` guard.
5. **Enter key race condition** — concurrent queries with no guard. Fixed: `!ragQuerying` check in onKeyDown.
6. **Missing `.catch()` on `res.json()`** — non-JSON responses threw SyntaxError. Fixed: `.catch(() => ({ error: '...' }))`.

## Running

```bash
# Sidecar
cd sidecar && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Next.js
cd app && npm run dev
```

## Ponytail Decisions

- Single-file sidecar (`main.py`) — no abstractions
- Blocking API — one request at a time for RAG (fine for local dev)
- No markdown rendering library — `white-space: pre-wrap` for answers
- Manual uvicorn start — no Docker or process manager
- `filename` accepted but not used by LightRAG — metadata support deferred
