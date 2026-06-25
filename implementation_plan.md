# Implementation Plan: SIRA Deep-Research Framework

## Overview

5 sequential steps. Each step leaves the codebase in a working state. Build follows the dependency graph: shared utility → API endpoints → UI.

## Architecture Decisions

- **No new npm dependencies.** LLM and Tavily calls use native `fetch`. This is the laziest path — the project already has no HTTP client library, and adding one for two `fetch` calls is overhead.
- **LLM prompt is inline in the route.** No prompt template library needed. One prompt string.
- **Research ingest reuses `splitTextIntoChunks` and `getEmbedding`.** No pipeline abstraction — the route handler does the loop directly, same pattern as `ingest/route.ts`.
- **UI mode toggle in header.** Simplest integration with existing 3-column layout.

## Task List

### Step 1: Extract `splitTextIntoChunks` to `app/lib/text.ts`

**Description:** Move the inline `splitTextIntoChunks` function from `app/app/api/ingest/route.ts` into a shared `app/lib/text.ts`. Update the ingest route to import it. Zero behavioral change.

**Acceptance criteria:**
- [ ] `app/lib/text.ts` exports `splitTextIntoChunks` with identical signature and behavior
- [ ] `app/app/api/ingest/route.ts` imports from `@/lib/text` instead of defining inline
- [ ] `npm run build` succeeds
- [ ] Existing file ingest still works (same chunking output)

**Dependencies:** None

**Files touched:**
- `app/lib/text.ts` (new)
- `app/app/api/ingest/route.ts` (edit — remove inline function, add import)

**Estimated scope:** XS (2 files)

---

### Step 2: Create `POST /api/research` — SIRA Sketch + Tavily Search

**Description:** Build the research endpoint. Takes a query + optional filters. Calls OpenAI-compatible LLM to generate a sketch (summary + search terms). Calls Tavily with top search terms. Deduplicates and returns results.

**Acceptance criteria:**
- [ ] `POST /api/research` validates query (required, non-empty) and collection (required, must exist)
- [ ] LLM call returns sketch with summary + 3-7 search terms
- [ ] Tavily search returns results for top 3 terms
- [ ] Results are deduplicated by URL
- [ ] Domain and filetype filters are passed to Tavily when provided
- [ ] `npm run build` succeeds

**Dependencies:** Step 1 (build must pass first)

**Files touched:**
- `app/app/api/research/route.ts` (new)

**Estimated scope:** S (1 file)

---

### Step 3: Create `POST /api/research/ingest` — Fetch + Chunk + Embed + Upsert

**Description:** Build the research ingest endpoint. Takes a list of URLs. For each URL, fetches full content, extracts text, chunks via `splitTextIntoChunks`, embeds via `getEmbedding`, and upserts to Qdrant. Returns per-URL status.

**Acceptance criteria:**
- [ ] `POST /api/research/ingest` validates urls (required, non-empty array) and collection (required, must exist)
- [ ] Each URL is fetched and text extracted (ponytail: use basic regex to strip HTML tags — no dependency)
- [ ] Text is chunked using imported `splitTextIntoChunks`
- [ ] Each chunk is embedded using `getEmbedding`
- [ ] Points are batch-upserted to Qdrant with payload: text, url, chunk_index, char_start, char_end, total_chunks
- [ ] Returns per-URL status (success/skipped/error)
- [ ] `npm run build` succeeds

**Dependencies:** Step 1 (needs `splitTextIntoChunks` in `lib/text.ts`)

**Files touched:**
- `app/app/api/research/ingest/route.ts` (new)

**Estimated scope:** S (1 file)

---

### Step 4: Update `app/app/page.tsx` — Deep Research UI Panel

**Description:** Add Deep Research panel to the dashboard. Mode toggle in header switches right column between "Vector Search Query" and "Deep Research". Panel includes query input, domain/filetype filters, research button, sketch display, results list with checkboxes, and ingest controls.

**Acceptance criteria:**
- [ ] Header has toggle: "Vector Search" | "Deep Research"
- [ ] Deep Research mode shows: query input, domain filter, filetype filter, "Research" button
- [ ] After research: sketch summary (collapsible), results list with checkboxes, title, snippet, score
- [ ] "Ingest Selected" button appears when results exist, disabled when none checked
- [ ] Ingestion shows progress and per-URL status
- [ ] State management uses existing `useState` pattern (no external state lib)
- [ ] `npm run build` succeeds

**Dependencies:** Step 2 and Step 3 (needs both API routes)

**Files touched:**
- `app/app/page.tsx` (edit — add state, handlers, Deep Research JSX)

**Estimated scope:** M (1 file, but large diff)

---

### Step 5: Update `app/app/page.module.css` — Deep Research Styles

**Description:** Add CSS classes for Deep Research panel elements. Reuse existing design tokens (`--primary`, `--glass-bg`, etc.).

**Acceptance criteria:**
- [ ] Styles for: research query input, filter inputs, sketch summary card, result item with checkbox, ingest button, ingestion progress
- [ ] Visual consistency with existing glassmorphism design
- [ ] Responsive behavior matches existing grid breakpoints
- [ ] `npm run build` succeeds

**Dependencies:** Step 4 (needs the JSX classes)

**Files touched:**
- `app/app/page.module.css` (edit — append new classes)

**Estimated scope:** XS (1 file)

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tavily API rate limits | Medium | Batch search terms, not individual. Tavily allows multiple queries per call. |
| LLM call fails | High | Return empty sketch with Tavily results using the raw query as fallback search term. |
| URL fetch fails (anti-bot, etc.) | Medium | Per-URL error handling — one failed URL doesn't block others. |
| HTML extraction is naive | Low | `ponytail:` comment marks it. Upgrade path: `jsdom` or `cheerio` if needed. |

## Open Questions

- None. All decisions made per ponytail lazy-first principle.
