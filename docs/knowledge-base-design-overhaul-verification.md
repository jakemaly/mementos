# Knowledge Base Design Overhaul — Verification Record

## Implemented deliverables

| Requirement | Evidence |
|---|---|
| Shared responsive shell and authoritative collection state | `app/app/components/app-shell/AppShell.tsx`, `app/app/page.tsx` |
| Collection-aware, streaming LightRAG chat with cancellation | `sidecar/knowledge_base.py`, `sidecar/main.py`, `app/app/api/rag/query/route.ts` |
| Grounded citations and insufficient-evidence handling | `CitationList.tsx`, `RagChat.tsx`, `sidecar/test_knowledge_base_rag.py` |
| Separate Vector Search | `KnowledgeBase.tsx`, `VectorSearch.tsx` |
| Collections drawer and unified two-branch ingestion | `CollectionsDrawer.tsx`, `index-collection-document.ts` |
| Deep Research imports index both vector and graph paths | `app/app/api/research/ingest/route.ts` |
| Legacy dashboard/studio removal | compact `app/app/page.tsx`; deleted `page.module.css` and `test-rag-regression.js` |

## Automated evidence

The following passed at current HEAD:

- `npm run lint` (warnings only in existing lightweight scripts)
- `npm run build`
- `node test-rag-frontend.mjs`
- `node test-rag-routes.mjs`
- `npx tsx test-rag-runtime.mjs`
- `node test-deep-research-frontend.mjs`
- `node test-deep-research-routes.mjs`
- `sidecar/venv/bin/python -m pytest sidecar/test_main.py sidecar/test_knowledge_base_rag.py sidecar/test_step2.py sidecar/test_step3_insert.py sidecar/test_step3_bugs.py sidecar/test_step4_query.py sidecar/test_td_bridge.py`
- Each standalone sidecar verification runner: `test_main.py`, `test_step2.py`, `test_step3_insert.py`, `test_step3_bugs.py`, and `test_step4_query.py`.

## Browser evidence

- Chromium production interaction test passed at 390px: Knowledge Base navigation, Vector Search, Collections drawer open/Escape close, Chat return, no runtime console errors, and `scrollWidth === 390`.
- Headless Chrome captures were inspected at 1440px, 1024px, 768px, and 390px. A 390px navigation clipping defect was corrected.

## Remaining external blocker

Safari/WebKit interactive verification is not available on this Linux host. The cached Playwright WebKit MiniBrowser was attempted in headless mode but exited during EGL/device initialization. This must be rerun on a Safari-capable host before claiming the supported-browser matrix is fully complete.
