# Rubric: SIRA Deep-Research Framework

Verification checklist mapped 1:1 to implementation steps. Each step must pass before moving to the next.

## Step 1: Extract `splitTextIntoChunks` to `app/lib/text.ts`

- [ ] `app/lib/text.ts` exists and exports `splitTextIntoChunks`
- [ ] Function signature matches original: `(text: string, chunkSize: number, chunkOverlap: number) => { text: string; charStart: number; charEnd: number }[]`
- [ ] `app/app/api/ingest/route.ts` imports `splitTextIntoChunks` from `@/lib/text`
- [ ] `app/app/api/ingest/route.ts` no longer contains inline `splitTextIntoChunks` definition
- [ ] `cd app && npm run build` exits 0
- [ ] **Regression:** Existing file ingest flow still works (same chunking output for same input)

## Step 2: Create `POST /api/research` — SIRA Sketch + Tavily Search

- [ ] `app/app/api/research/route.ts` exists
- [ ] Validates `query` is a non-empty string (400 on invalid)
- [ ] Validates `collection` exists in Qdrant (404 on missing)
- [ ] Validates `domainFilter` and `filetypeFilter` are optional strings
- [ ] Calls OpenAI-compatible LLM endpoint for sketch generation
- [ ] Uses `OPENAI_API_BASE`, `OPENAI_API_KEY`, `OPENAI_MODEL_NAME` env vars
- [ ] Sketch response contains `summary` (string) and `searchTerms` (array of 3-7 strings)
- [ ] Calls Tavily API with top search terms and optional filters
- [ ] Uses `TAVILY_API_KEY` env var
- [ ] Results are deduplicated by URL
- [ ] Response shape: `{ sketch: { summary, searchTerms }, results: [{ url, title, snippet, score, selected }] }`
- [ ] LLM failure fallback: uses raw query as search term
- [ ] `cd app && npm run build` exits 0
- [ ] **Manual test:** `curl -X POST http://localhost:3000/api/research -H 'Content-Type: application/json' -d '{"query":"test","collection":"test-col"}'` returns sketch + results (with valid env vars)

## Step 3: Create `POST /api/research/ingest` — Fetch + Chunk + Embed + Upsert

- [ ] `app/app/api/research/ingest/route.ts` exists
- [ ] Validates `urls` is a non-empty array of strings (400 on invalid)
- [ ] Validates `collection` exists in Qdrant (404 on missing)
- [ ] `chunkSize` defaults to 500, `chunkOverlap` defaults to 50
- [ ] Imports `splitTextIntoChunks` from `@/lib/text`
- [ ] Imports `getEmbedding` from `@/lib/embeddings`
- [ ] Imports `qdrant` from `@/lib/qdrant`
- [ ] Fetches each URL and extracts text content
- [ ] ponytail: comment exists documenting naive HTML stripping approach
- [ ] Chunks text using `splitTextIntoChunks`
- [ ] Embeds each chunk using `getEmbedding`
- [ ] Upserts points to Qdrant with payload: `{ text, url, chunk_index, char_start, char_end, total_chunks }`
- [ ] Per-URL error handling: one failed URL doesn't block others
- [ ] Response shape: `{ success: true, ingested: [{ url, chunksCount, status, error? }], totalChunks }`
- [ ] `cd app && npm run build` exits 0

## Step 4: Update `app/app/page.tsx` — Deep Research UI Panel

- [ ] Header contains mode toggle: "Vector Search" | "Deep Research"
- [ ] Default mode is "Vector Search" (existing behavior preserved)
- [ ] Toggling to "Deep Research" replaces right column with research panel
- [ ] Research panel has: query input, domain filter input, filetype filter input, "Research" button
- [ ] Research button calls `POST /api/research` with correct payload
- [ ] Loading state shows spinner + message during research
- [ ] Sketch summary renders after research completes (collapsible)
- [ ] Results list renders with: checkbox, title, snippet, score badge
- [ ] Checkboxes track selected state per result
- [ ] "Ingest Selected" button appears when results exist
- [ ] "Ingest Selected" is disabled when no results are checked
- [ ] Clicking "Ingest Selected" calls `POST /api/research/ingest` with selected URLs + current collection
- [ ] Ingestion progress shows per-URL status
- [ ] Error states display in existing error banner
- [ ] Success states display in existing success banner
- [ ] `cd app && npm run build` exits 0

## Step 5: Update `app/app/page.module.css` — Deep Research Styles

- [ ] CSS classes exist for: research inputs, sketch card, result items with checkboxes, ingest button, progress display
- [ ] Uses existing CSS custom properties (`--primary`, `--glass-bg`, `--text-primary`, etc.)
- [ ] Glassmorphism styling matches existing cards
- [ ] Responsive at existing breakpoints (1280px, 768px)
- [ ] No CSS conflicts with existing classes
- [ ] `cd app && npm run build` exits 0

## Final Checkpoint

- [ ] All 5 steps pass
- [ ] `cd app && npm run build` exits 0 (full project)
- [ ] No new npm dependencies added to `package.json`
- [ ] Existing routes (`/api/collections`, `/api/ingest`, `/api/query`) still work unchanged
- [ ] Existing Vector Search mode in UI still works unchanged
