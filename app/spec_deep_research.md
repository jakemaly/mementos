# Spec: SIRA Deep-Research Framework

## Objective
Add a SIRA (Superintelligent Retrieval Agent) inspired deep-research framework to the Second Brain dashboard.
- Users can input a research query into a dashboard search box.
- Users can optionally filter or restrict searches by domains (e.g., `github.com`, `arxiv.org`) or filetypes (e.g., `pdf`).
- The system generates an "Expected-Response Sketch" using an OpenAI-compatible endpoint. This sketch lists concepts, key terms, entities, and generated query strings.
- The system executes web search queries via Tavily API.
- The system filters retrieved search snippets/pages by matching terms in the generated sketch (lexical/SIRA pruning style).
- The system displays the filtered list of discovered sources with checkboxes.
- **Direct Ingestion Pipeline**: Once the user selects the sources to import:
  1. The server fetches the **full content** of the web pages (using Tavily's extract capabilities or standard HTML scraping).
  2. The full text content is cleaned of HTML tags and boilerplate.
  3. The text is split into chunks based on the user's chunk size/overlap configuration (similar to file ingestion).
  4. Each chunk is embedded using the local feature-extraction model (`Xenova/all-MiniLM-L6-v2`).
  5. The generated vector embeddings, along with source metadata (URL, page title, chunk index, parent text), are stored directly in the selected Qdrant collection.

## Tech Stack
- Next.js 16.2.9 (App Router)
- React 19.2.4
- Tailwind CSS / Vanilla CSS (uses existing dashboard CSS modules)
- Qdrant Client (`@qdrant/js-client-rest`)
- Local Embeddings: `@huggingface/transformers` (`Xenova/all-MiniLM-L6-v2`)
- API Calls: Custom OpenAI-compatible SDK/Fetch endpoint for LLM Sketch generation, Tavily API for search query execution.

## Commands
- Dev Server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`

## Project Structure
We will add/modify the following files:
- `app/app/api/research/route.ts`: API route handling the sketch generation, Tavily search, and SIRA filtering.
- `app/app/api/research/ingest/route.ts`: API route handling the extraction/scraping of full text content of chosen sources, chunking, generating embeddings, and storing in Qdrant.
- `app/app/page.tsx`: UI modifications to add the Deep-Research panel, results list, checkboxes, and ingestion action.
- `app/app/page.module.css`: Stylings for the new panels and lists.

## Code Style
We will write clean, well-typed TypeScript code.
Example of LLM call structure using fetch:
```typescript
const response = await fetch(process.env.OPENAI_API_BASE + '/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: process.env.OPENAI_MODEL_NAME || 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
  }),
});
```

## Testing Strategy
Manual testing of the API routes and UI interface. We will verify that:
1. Expected-Response Sketch is successfully generated.
2. Web searches with domain filters correctly construct queries to Tavily.
3. Filtering based on Sketch concepts is executed correctly.
4. Ingesting selected sources fetches the full web page contents, chunks them, embeds them, and accurately saves them to the selected Qdrant collection.

## Boundaries
- **Always do:** Check that `OPENAI_API_KEY` and `TAVILY_API_KEY` are provided before making requests. Validate that selected collections exist. Ensure chunks have a clean text structure before embedding.
- **Ask first:** Installing new large dependencies for scraping (we should use simple fetch/cheerio or Tavily's built-in `include_raw_content` / search results to avoid installing heavy headless browsers).
- **Never do:** Commit raw API keys or hardcode credentials in source code.

## Success Criteria
- Dashboard contains a dedicated "Deep Research (SIRA)" box.
- Users can specify domain and filetype limits.
- Deep research execution lists source articles with titles, snippets, and checkboxes.
- Checking sources and clicking "Ingest Selected" fetches full webpage content, chunks it, generates embeddings, and adds those items to the Qdrant database, making them queryable via the existing search feature.
- Proper handling of OpenAI-compatible API base URL and model configuration via environment variables.

