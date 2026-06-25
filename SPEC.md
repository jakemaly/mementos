# Spec: SIRA Deep-Research Framework

## Objective

Add a "Deep Research" panel to the Second Brain dashboard that lets a user enter a research query, get AI-generated search terms (SIRA sketch), see Tavily web results with checkboxes, and optionally ingest selected results into Qdrant for later vector search.

**SIRA = Search, Investigate, Research, Analyze.** The sketch step uses an LLM to turn a natural-language query into focused search terms. Tavily fetches results. The user picks which ones to ingest. Ingestion fetches full page content, chunks, embeds, and upserts to Qdrant — reusing the existing ingest pipeline.

## Tech Stack

- **Framework:** Next.js 16.2.9 (App Router)
- **Language:** TypeScript
- **Embeddings:** `@huggingface/transformers` (Xenova/all-MiniLM-L6-v2, 384-dim) — existing
- **Vector DB:** `@qdrant/js-client-rest` — existing
- **LLM:** OpenAI-compatible API (`OPENAI_API_BASE`, `OPENAI_API_KEY`, `OPENAI_MODEL_NAME` env vars) — uses native `fetch`, no new dependency
- **Web Search:** Tavily API (`TAVILY_API_KEY` env var) — uses native `fetch`, no new dependency
- **CSS:** Vanilla CSS modules (existing `page.module.css`), no new CSS framework

## Commands

```
Dev:     npm run dev          (from /home/jake/projects/second-brain/app/)
Build:   npm run build
Lint:    npm run lint
Start:   npm start
```

## Project Structure

```
app/
├── app/
│   ├── api/
│   │   ├── collections/route.ts   (existing)
│   │   ├── ingest/route.ts        (existing — will remove splitTextIntoChunks)
│   │   ├── query/route.ts         (existing)
│   │   ├── research/route.ts      (NEW — SIRA sketch generation)
│   │   └── research/ingest/route.ts (NEW — fetch + chunk + embed + upsert)
│   ├── page.tsx                   (existing — will add Deep Research panel)
│   ├── page.module.css            (existing — will add Deep Research styles)
│   ├── globals.css                (existing, unchanged)
│   └── layout.tsx                 (existing, unchanged)
├── lib/
│   ├── embeddings.ts              (existing, unchanged)
│   ├── qdrant.ts                  (existing, unchanged)
│   └── text.ts                    (NEW — splitTextIntoChunks extracted here)
├── package.json                   (unchanged — no new dependencies)
└── ...
```

## New Env Vars

| Var | Purpose | Required? |
|-----|---------|-----------|
| `OPENAI_API_BASE` | LLM endpoint URL | Yes |
| `OPENAI_API_KEY` | LLM auth | Yes |
| `OPENAI_MODEL_NAME` | Model to use (e.g. `gpt-4o-mini`) | Yes |
| `TAVILY_API_KEY` | Tavily search auth | Yes |

## Code Style

- Follow existing patterns: `NextResponse.json`, try/catch with 500 fallback, input validation at top of handler
- No new abstractions — functions are flat, no interfaces unless needed for TS
- Naming: `camelCase` for functions/vars, `PascalCase` for React components
- CSS: reuse existing CSS custom properties (`--primary`, `--glass-bg`, etc.)

## API Contracts

### POST /api/research

**Request:**
```json
{
  "query": "string (required, non-empty)",
  "collection": "string (required, must exist in Qdrant)",
  "domainFilter": "string (optional, e.g. 'github.com')",
  "filetypeFilter": "string (optional, e.g. 'pdf')"
}
```

**Response:**
```json
{
  "sketch": {
    "summary": "string — LLM-generated overview",
    "searchTerms": ["string"] — 3-7 focused search terms
  },
  "results": [
    {
      "url": "string",
      "title": "string",
      "snippet": "string",
      "score": "number (Tavily relevance 0-1)",
      "selected": "boolean (default false)"
    }
  ]
}
```

**Flow:** LLM generates sketch → Tavily searches with top 3 terms → deduplicates results → returns sketch + results.

### POST /api/research/ingest

**Request:**
```json
{
  "urls": ["string"] — list of URLs to fetch and ingest,
  "collection": "string (required, must exist in Qdrant)",
  "chunkSize": "number (optional, default 500)",
  "chunkOverlap": "number (optional, default 50)"
}
```

**Response:**
```json
{
  "success": true,
  "ingested": [
    {
      "url": "string",
      "chunksCount": "number",
      "status": "success | skipped | error",
      "error": "string (optional, only if error)"
    }
  ],
  "totalChunks": "number"
}
```

**Flow:** For each URL, fetch full HTML → extract text → chunk via `splitTextIntoChunks` → embed via `getEmbedding` → batch upsert to Qdrant.

## UI Changes

The existing `page.tsx` has a 3-column grid: Config | File Ingest | Search Query. The Deep Research panel replaces the Search Query section (right column) when the user selects "Deep Research" mode. A toggle button in the header or above the right column switches between "Vector Search" and "Deep Research" modes.

**Deep Research Panel contains:**
1. Query input (text, wider than current search)
2. Optional domain filter (text input) and filetype filter (text input)
3. "Research" button
4. Loading state (spinner + message)
5. Sketch summary (collapsible)
6. Results list with checkboxes, title, snippet, score badge
7. "Ingest Selected" button (disabled when none selected)
8. Ingestion progress and summary

## Testing Strategy

No test framework exists in the project. Ponytail mode: no test framework addition. Each step is verified manually via `npm run build` and browser testing.

## Boundaries

- **Always do:** Validate all inputs at trust boundaries, reuse existing `getEmbedding`/`qdrant`/`splitTextIntoChunks`, keep CSS in existing module
- **Ask first:** Adding new npm dependencies, changing existing API contracts
- **Never do:** Add test frameworks, add Tailwind, change existing API routes' response format, modify `embeddings.ts` or `qdrant.ts`

## Success Criteria

1. `splitTextIntoChunks` lives in `app/lib/text.ts` and is imported by `app/app/api/ingest/route.ts` (no functional change)
2. `POST /api/research` returns a sketch + Tavily results for a valid query
3. `POST /api/research/ingest` fetches URLs, chunks, embeds, and upserts to Qdrant
4. Dashboard has a Deep Research panel with query input, filters, results with checkboxes, and ingestion controls
5. `npm run build` succeeds with zero errors
