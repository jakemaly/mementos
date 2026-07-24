# Implementation Plan: Knowledge Base Design Overhaul

## Overview

Implement `docs/knowledge-base-design-overhaul-spec.md` as a sequence of small, verifiable slices. The work keeps LightRAG as the graph-enhanced RAG engine, makes it collection-aware, adds grounded streaming chat, unifies vector and graph ingestion, introduces the shared application sidebar, replaces the Knowledge Base dashboard with separate Chat and Vector Search views, and removes only the obsolete ingestion studio and duplicate ingestion UI.

The highest-risk work is first: prove the installed LightRAG version can provide streaming, conversation history, source references, file provenance, and isolated workspaces without loading one embedding model per collection. UI work begins only after those contracts are executable.

## Architecture Decisions

- **LightRAG remains.** Only the standalone LightRAG Graph Ingestion Studio UI is removed.
- **One corpus per Mementos collection.** Use LightRAG's `workspace` support to isolate collection data. Map `default` to the existing unscoped workspace so current graph data remains reachable.
- **Share expensive model resources.** Cache the sentence-transformer embedding function and LLM function once; create lightweight, lazily initialized LightRAG instances per workspace.
- **No invented evidence score.** Treat a response as insufficiently grounded when LightRAG returns no usable referenced chunks. Do not add another ranking model or arbitrary confidence system.
- **One streaming chat contract.** The browser sends query, collection, bounded history, and turn ID. The server emits retrieval status, answer deltas, sources, done, or safe error events.
- **One ingestion service.** Manual files and Deep Research imports call the same document-indexing service, which writes direct-search vectors and inserts the source into the selected LightRAG workspace.
- **Partial ingestion is preserved.** Vector and graph outcomes are reported separately; no distributed rollback is attempted.
- **Shared collection ownership.** The top-level application owns the current collection list and selection and passes them to Deep Research, Knowledge Base, and Collections Manager.
- **No new dependencies.** Use React, CSS Modules, semantic HTML, current LightRAG/Qdrant clients, and the existing lightweight test approach.
- **Highest practical test seams.** Verify browser-facing API contracts, rendered workflows, and sidecar HTTP behavior. Avoid tests tied to private component state or LightRAG internals beyond the small adapter boundary.

## Dependency Graph

```text
LightRAG capability characterization
    │
    ├── Collection workspace registry
    │       ├── Collection-scoped insertion
    │       └── Collection-scoped streaming query
    │               └── Next.js streaming proxy
    │                       └── RAG Chat UI
    │
    └── Structured references
            └── Citations and insufficient-evidence UI

Truthful collection API
    └── Shared collection ownership
            ├── Shared application shell
            ├── Collections drawer
            ├── RAG Chat composer
            └── Vector Search composer

Collection-scoped insertion
    └── Unified indexing service
            ├── Manual file ingestion
            └── Deep Research source ingestion

Shared shell + completed Knowledge Base views
    └── Legacy dashboard and studio deletion
            └── Responsive/accessibility/browser verification
```

## Task List

### Phase 1: Prove and define the LightRAG boundary

## Task 1: Characterize the installed LightRAG capabilities

**Description:** Add a narrow adapter-level test suite that locks down the installed LightRAG features the redesign depends on: `workspace`, streaming queries, conversation history, included references, structured query data, and `file_paths`. Determine the smallest supported route to stream one answer and return structured sources without performing duplicate retrieval. Record that choice in the adapter tests rather than spreading version assumptions through routes and UI code.

**Acceptance criteria:**
- [ ] A runnable test proves how answer chunks and source references are returned by the installed LightRAG version.
- [ ] A runnable test proves conversation history and file provenance can be passed through the public LightRAG API.
- [ ] The selected adapter path performs one retrieval per chat turn and requires no new model call solely for citation formatting.

**Verification:**
- [ ] Tests pass: `sidecar/venv/bin/python -m pytest sidecar/test_knowledge_base_rag.py -k capabilities`
- [ ] Existing query regression passes: `cd sidecar && venv/bin/python test_step4_query.py --static`
- [ ] Review the captured adapter contract against the installed LightRAG signatures.

**Dependencies:** None

**Files likely touched:**
- `sidecar/knowledge_base.py`
- `sidecar/test_knowledge_base_rag.py`

**Estimated scope:** Small: 2 files

## Task 2: Add a collection-scoped LightRAG registry

**Description:** Replace the single global LightRAG object with a lazy registry keyed by validated collection/workspace name. Reuse one embedding model/function and LLM function across all registry entries. Preserve the current graph corpus by mapping the `default` collection to the existing workspace convention. Keep initialization concurrency-safe.

**Acceptance criteria:**
- [ ] Requests for the same collection reuse one initialized LightRAG instance, including concurrent first requests.
- [ ] Different collection names resolve to isolated LightRAG workspaces while sharing expensive model resources.
- [ ] The `default` collection resolves to the existing LightRAG data rather than creating an empty replacement workspace.

**Verification:**
- [ ] Tests pass: `sidecar/venv/bin/python -m pytest sidecar/test_knowledge_base_rag.py -k registry`
- [ ] Existing initialization tests pass: `sidecar/venv/bin/python -m pytest sidecar/test_step2.py sidecar/test_step3_bugs.py`
- [ ] Manual check: initialize two mocked workspaces and confirm their storage identifiers differ.

**Dependencies:** Task 1

**Files likely touched:**
- `sidecar/main.py`
- `sidecar/knowledge_base.py`
- `sidecar/test_knowledge_base_rag.py`

**Estimated scope:** Medium: 3 files

## Task 3: Implement the collection-aware streaming chat endpoint

**Description:** Add the sidecar HTTP endpoint for grounded conversational queries. Validate query, collection, turn ID, and bounded message history; always use internal hybrid retrieval; stream ordered answer events; return structured source records; report insufficient evidence when no usable referenced chunks exist; and cancel active work when the client disconnects.

**Acceptance criteria:**
- [ ] A valid request emits retrieval status, ordered answer deltas, deduplicated sources, and one terminal event.
- [ ] Invalid collection/history/message input returns a safe 4xx response, and no client field can override retrieval mode or model settings.
- [ ] Disconnecting cancels and awaits the active LightRAG/model task; no late events are emitted.

**Verification:**
- [ ] Tests pass: `sidecar/venv/bin/python -m pytest sidecar/test_knowledge_base_rag.py -k stream`
- [ ] Existing sidecar endpoint tests pass: `sidecar/venv/bin/python -m pytest sidecar/test_main.py sidecar/test_step4_query.py`
- [ ] Manual check: inspect one SSE stream for event order and safe error content.

**Dependencies:** Tasks 1–2

**Files likely touched:**
- `sidecar/main.py`
- `sidecar/knowledge_base.py`
- `sidecar/test_knowledge_base_rag.py`

**Estimated scope:** Medium: 3 files

## Task 4: Proxy and type the chat stream in Next.js

**Description:** Define the frontend-facing chat request/event contracts and replace the current one-shot RAG proxy behavior with a validated streaming proxy. Forward only allowlisted fields, propagate browser cancellation, release the sidecar reader, preserve SSE headers, and translate malformed/upstream failures into safe statuses.

**Acceptance criteria:**
- [ ] The proxy forwards only query, collection, bounded history, and turn ID.
- [ ] The sidecar stream reaches the browser without buffering or changing event order.
- [ ] Browser abort cancels the sidecar fetch and reader; malformed JSON and upstream failures have distinct safe responses.

**Verification:**
- [ ] Tests pass: `node test-rag-routes.mjs`
- [ ] Runtime checks pass: `node test-rag-runtime.mjs`
- [ ] Build succeeds: `npm run build`

**Dependencies:** Task 3

**Files likely touched:**
- `app/app/lib/knowledge-base-contracts.ts`
- `app/app/api/rag/query/route.ts`
- `app/test-rag-routes.mjs`
- `app/test-rag-runtime.mjs`

**Estimated scope:** Medium: 4 files

### Checkpoint: LightRAG query foundation

- [ ] Tasks 1–4 tests pass.
- [ ] Existing LightRAG data remains reachable through `default`.
- [ ] Two collections are isolated in adapter/endpoint tests.
- [ ] One browser-facing request streams a grounded answer and sources end to end.
- [ ] Cancelling the browser request stops upstream work.
- [ ] Review the stream contract before building the chat UI.

### Phase 2: Make collections and ingestion truthful

## Task 5: Make collection listing and creation authoritative

**Description:** Remove the synthetic online `default` fallback, fake success behavior, and duplicated name rules from collection APIs. Use one validator for listing/creation/query/ingestion boundaries. Return an explicit unavailable state when Qdrant cannot be reached. LightRAG workspace creation remains lazy, so collection creation only reports success after the required Qdrant collection exists.

**Acceptance criteria:**
- [ ] Offline Qdrant returns an explicit unavailable state and is never represented as a connected `default` collection.
- [ ] Invalid and duplicate names fail consistently; successful creation is confirmed by Qdrant.
- [ ] Collection names accepted here are accepted identically by vector and LightRAG boundaries.

**Verification:**
- [ ] Route checks pass: `node test-rag-routes.mjs`
- [ ] Regression checks pass: `node test-rag-regression.js`
- [ ] Manual check: stop Qdrant and confirm the API reports unavailable without claiming success.

**Dependencies:** Task 2

**Files likely touched:**
- `app/lib/collections.ts`
- `app/app/api/collections/route.ts`
- `app/test-rag-routes.mjs`
- `app/test-rag-regression.js`

**Estimated scope:** Medium: 4 files

## Task 6: Make LightRAG insertion collection-aware

**Description:** Extend the retained LightRAG insertion path to require a validated collection and preserve source provenance through `file_paths`. Route insertion through the collection registry. Keep existing graph extraction behavior and return a stable branch result suitable for unified ingestion.

**Acceptance criteria:**
- [ ] Inserting the same fixture into collection A makes it unavailable to collection B.
- [ ] Filename or URL provenance is stored and can appear in structured query references.
- [ ] Existing insertion error handling and concurrency safety remain intact.

**Verification:**
- [ ] Tests pass: `sidecar/venv/bin/python -m pytest sidecar/test_knowledge_base_rag.py -k insert`
- [ ] Existing insert tests pass: `sidecar/venv/bin/python -m pytest sidecar/test_step3_insert.py sidecar/test_step3_bugs.py`
- [ ] Manual check: query the inserted fixture and inspect its returned source label.

**Dependencies:** Tasks 1–2

**Files likely touched:**
- `sidecar/main.py`
- `sidecar/knowledge_base.py`
- `sidecar/test_knowledge_base_rag.py`
- `sidecar/test_step3_insert.py`

**Estimated scope:** Medium: 4 files

## Task 7: Build one document-indexing service and manual ingest route

**Description:** Extract the existing direct-vector indexing work into one server-side document-indexing service that also calls collection-aware LightRAG insertion. Update manual file ingestion to accept exactly one TXT or Markdown file, use internal chunk defaults, and return separate vector, graph, and overall complete/partial/failed outcomes. Keep successful branch work when the other branch fails.

**Acceptance criteria:**
- [ ] One accepted file is indexed for both direct Vector Search and LightRAG Chat in the selected collection.
- [ ] TXT and Markdown are accepted; unsupported/empty files and invalid collections are rejected before indexing.
- [ ] Complete, vector-only, graph-only, and complete-failure results are reported accurately without rollback.

**Verification:**
- [ ] Route checks pass: `node test-rag-routes.mjs`
- [ ] Runtime checks pass: `node test-rag-runtime.mjs`
- [ ] Build succeeds: `npm run build`

**Dependencies:** Tasks 5–6

**Files likely touched:**
- `app/lib/index-collection-document.ts`
- `app/app/api/ingest/route.ts`
- `app/app/api/rag/ingest/route.ts`
- `app/test-rag-routes.mjs`
- `app/test-rag-runtime.mjs`

**Estimated scope:** Medium: 5 files

## Task 8: Route Deep Research imports through unified indexing

**Description:** Replace Deep Research's direct Qdrant-only indexing with the shared document-indexing service after source content is fetched. Preserve source selection and import UI behavior while making imported pages available to both Vector Search and LightRAG Chat. Continue reporting per-URL failures and total chunk counts accurately.

**Acceptance criteria:**
- [ ] A selected research source is indexed into both branches for the chosen collection.
- [ ] Partial per-source or per-branch failures are not presented as complete success.
- [ ] Existing Deep Research selection, URL deduplication, and import request shape remain unchanged.

**Verification:**
- [ ] Deep Research route checks pass: `node test-deep-research-routes.mjs`
- [ ] RAG route/runtime checks pass: `node test-rag-routes.mjs && node test-rag-runtime.mjs`
- [ ] Manual check: import one research source, then retrieve it through both Knowledge Base modes.

**Dependencies:** Task 7

**Files likely touched:**
- `app/app/api/research/ingest/route.ts`
- `app/lib/index-collection-document.ts`
- `app/test-deep-research-routes.mjs`
- `app/test-rag-runtime.mjs`

**Estimated scope:** Medium: 4 files

### Checkpoint: Collection and ingestion consistency

- [ ] Tasks 5–8 tests pass.
- [ ] Offline storage is represented honestly.
- [ ] Manual TXT/Markdown ingestion populates both indexes.
- [ ] Deep Research imports populate both indexes without changing its UI workflow.
- [ ] Partial ingestion results identify the failed branch and preserve successful work.
- [ ] Existing LightRAG data and retrieval bridge tests still pass.

### Phase 3: Establish the shared application shell

## Task 9: Centralize collection state at the application boundary

**Description:** Move collection loading and selected-collection ownership out of individual feature screens and into the top-level application. Pass the authoritative list, unavailable state, selection, and refresh operation into Deep Research and the upcoming Knowledge Base/Collections surfaces. Remove duplicate collection fetch behavior without adding a global store.

**Acceptance criteria:**
- [ ] Deep Research continues to select and retain a valid target collection using top-level state.
- [ ] One collection refresh updates all mounted feature surfaces consistently.
- [ ] An unavailable collection service disables dependent actions instead of substituting fake data.

**Verification:**
- [ ] Frontend checks pass: `node test-deep-research-frontend.mjs`
- [ ] Route checks pass: `node test-rag-routes.mjs`
- [ ] Build succeeds: `npm run build`

**Dependencies:** Task 5

**Files likely touched:**
- `app/app/page.tsx`
- `app/app/components/deep-research/DeepResearch.tsx`
- `app/app/components/deep-research/ResearchComposer.tsx`
- `app/test-deep-research-frontend.mjs`

**Estimated scope:** Medium: 4 files

## Task 10: Introduce the shared sidebar and responsive shell

**Description:** Build one semantic application shell with Mementos identity, Deep Research, Knowledge Base, Collections, and disabled/future Settings navigation. Keep New research/New chat contextual. Use the shell for both the Deep Research composer and active workspace. Convert it to compact top navigation at narrow widths.

**Acceptance criteria:**
- [ ] The same global navigation is present on every Deep Research and Knowledge Base state at desktop widths.
- [ ] Destination and contextual actions have correct accessible names, selected state, and keyboard focus.
- [ ] Narrow layouts use compact top navigation without horizontal overflow.

**Verification:**
- [ ] Frontend checks pass: `node test-deep-research-frontend.mjs && node test-rag-frontend.mjs`
- [ ] Lint passes: `npm run lint`
- [ ] Manual check: navigate at 1440px, 768px, and 390px using keyboard only.

**Dependencies:** Task 9

**Files likely touched:**
- `app/app/components/app-shell/AppShell.tsx`
- `app/app/components/app-shell/app-shell.module.css`
- `app/app/page.tsx`
- `app/app/components/deep-research/ResearchWorkspace.tsx`
- `app/test-deep-research-frontend.mjs`

**Estimated scope:** Medium: 5 files

## Task 11: Add the hidden Collections drawer

**Description:** Add the sidebar-triggered drawer using the authoritative collection state and unified manual-ingestion endpoint. Support selecting and creating collections and ingesting one TXT/Markdown file. Implement dialog semantics, focus restoration, active-ingestion close protection, accurate partial outcomes, and full-width narrow-screen behavior.

**Acceptance criteria:**
- [ ] The drawer is closed by default and supports select, create, and one-file ingest only.
- [ ] Focus enters the labelled drawer, Escape/close behavior is safe, and focus returns to the trigger.
- [ ] Ingestion retains the file after partial/failure, clears it after complete success, and prevents duplicate submission.

**Verification:**
- [ ] Frontend checks pass: `node test-rag-frontend.mjs`
- [ ] Route/runtime checks pass: `node test-rag-routes.mjs && node test-rag-runtime.mjs`
- [ ] Manual check: use the complete drawer flow at 1440px and 390px with keyboard only.

**Dependencies:** Tasks 7, 9–10

**Files likely touched:**
- `app/app/components/collections/CollectionsDrawer.tsx`
- `app/app/components/collections/collections-drawer.module.css`
- `app/app/components/app-shell/AppShell.tsx`
- `app/app/page.tsx`
- `app/test-rag-frontend.mjs`

**Estimated scope:** Medium: 5 files

### Checkpoint: Shared shell and administration

- [ ] Tasks 9–11 tests pass and the application builds.
- [ ] Deep Research behavior remains intact inside the shared shell.
- [ ] Collections drawer is hidden by default and fully keyboard operable.
- [ ] No fake collection counts, fake online badge, or false creation success remains.
- [ ] Responsive shell works at 1440px, 1024px, 768px, and 390px.

### Phase 4: Replace the Knowledge Base workspace

## Task 12: Build the separate Vector Search view

**Description:** Extract direct vector search from the legacy dashboard into a focused, left-aligned Knowledge Base view. Add the local Chat/Vector Search switch shell, collection selector, 5/10/20 limit selector, compact source/snippet/score results, accessible snippet disclosure, and explicit idle/loading/empty/error states.

**Acceptance criteria:**
- [ ] Knowledge Base has a text-labelled local view switch and retains Vector Search state while temporarily switching views.
- [ ] A search returns source, snippet, and score without showing character offsets or chunk diagnostics.
- [ ] New searches replace results, and changing collection clears them.

**Verification:**
- [ ] Frontend checks pass: `node test-rag-frontend.mjs`
- [ ] Route/runtime checks pass: `node test-rag-routes.mjs && node test-rag-runtime.mjs`
- [ ] Manual check: search with limits 5, 10, and 20 and expand a result by keyboard.

**Dependencies:** Tasks 9–10

**Files likely touched:**
- `app/app/components/knowledge-base/KnowledgeBase.tsx`
- `app/app/components/knowledge-base/VectorSearch.tsx`
- `app/app/components/knowledge-base/knowledge-base.module.css`
- `app/app/page.tsx`
- `app/test-rag-frontend.mjs`

**Estimated scope:** Medium: 5 files

## Task 13: Build session-only streaming RAG Chat

**Description:** Implement the default Chat view against the streaming proxy. Add the left-aligned full-height transcript, sticky multiline composer, collection binding, bounded session history, New chat, Enter/Shift+Enter behavior, Stop propagation, turn IDs, late-event rejection, copy action, and explicit retrieving/streaming/stopped/failed states.

**Acceptance criteria:**
- [ ] Chat is the default Knowledge Base view and maintains follow-up context only for the current browser session.
- [ ] Streaming renders ordered answer text; Stop cancels the active request and late events cannot mutate the stopped turn.
- [ ] Changing collection during a non-empty chat confirms, clears the transcript, and retains the new collection selection.

**Verification:**
- [ ] Frontend checks pass: `node test-rag-frontend.mjs`
- [ ] Route/runtime checks pass: `node test-rag-routes.mjs && node test-rag-runtime.mjs`
- [ ] Manual check: ask a follow-up, stop a second answer, start New chat, and switch collections.

**Dependencies:** Tasks 4, 9–10, 12

**Files likely touched:**
- `app/app/components/knowledge-base/KnowledgeBase.tsx`
- `app/app/components/knowledge-base/RagChat.tsx`
- `app/app/components/knowledge-base/ChatComposer.tsx`
- `app/app/components/knowledge-base/knowledge-base.module.css`
- `app/test-rag-frontend.mjs`

**Estimated scope:** Medium: 5 files

## Task 14: Render grounded citations and insufficient-evidence answers

**Description:** Complete the chat presentation by attaching stream source records to each answer, rendering numbered inline citations and a compact source list, consolidating duplicate sources, safely linking URLs, showing local filenames as text, and clearly representing insufficient evidence or incomplete output.

**Acceptance criteria:**
- [ ] Every grounded answer's inline citation markers resolve to a deduplicated source entry.
- [ ] External sources open safely; local-file sources are non-link text with supporting snippets.
- [ ] No-evidence, stopped, and failed responses cannot be mistaken for completed grounded answers.

**Verification:**
- [ ] Frontend checks pass: `node test-rag-frontend.mjs`
- [ ] Sidecar stream checks pass: `sidecar/venv/bin/python -m pytest sidecar/test_knowledge_base_rag.py -k 'references or insufficient'`
- [ ] Manual check: verify one URL citation, one local-file citation, and one unsupported question.

**Dependencies:** Task 13

**Files likely touched:**
- `app/app/components/knowledge-base/RagChat.tsx`
- `app/app/components/knowledge-base/ChatMessage.tsx`
- `app/app/components/knowledge-base/CitationList.tsx`
- `app/app/components/knowledge-base/knowledge-base.module.css`
- `app/test-rag-frontend.mjs`

**Estimated scope:** Medium: 5 files

### Checkpoint: Core Knowledge Base workflows

- [ ] Tasks 12–14 tests pass and the application builds.
- [ ] Chat is default; Vector Search is separate and one local switch away.
- [ ] Chat supports follow-ups, fresh retrieval, streaming, Stop, Copy, New chat, and collection reset.
- [ ] Grounded answers show working citations; unsupported questions decline clearly.
- [ ] Vector results show only source, snippet, and score.
- [ ] Both views use the selected collection and preserve state while switching views.

### Phase 5: Remove the old dashboard and finish quality gates

## Task 15: Delete superseded Knowledge Base UI and styles

**Description:** After the replacement workflows are complete, remove the old tab-pill dashboard, duplicate Vector DB ingestion panels, standalone LightRAG Graph Ingestion Studio UI, one-shot answer state, exposed mode selector, fake counts, Qdrant-active badge, obsolete handlers, and unused dashboard styles. Trace all route and sidecar callers before deleting anything; retain LightRAG and any non-UI bridge consumers.

**Acceptance criteria:**
- [ ] No duplicate ingestion or LightRAG studio UI remains in the rendered application or reachable client state.
- [ ] LightRAG dependency, insertion/query endpoints needed by the new flow, graph data, and retrieval bridge remain intact.
- [ ] The monolithic page no longer owns obsolete Knowledge Base handlers or dead state.

**Verification:**
- [ ] Search confirms removed labels/state have no live callers: `rg "LightRAG Ingestion Studio|Qdrant Active|ragMode|ragIngestText|sessionCounts" app/app`
- [ ] Lint passes: `npm run lint`
- [ ] Build succeeds: `npm run build`

**Dependencies:** Tasks 11–14

**Files likely touched:**
- `app/app/page.tsx`
- `app/app/page.module.css`
- `app/test-rag-frontend.mjs`
- `app/test-rag-regression.js`

**Estimated scope:** Medium: 4 files

## Task 16: Complete accessibility and responsive behavior

**Description:** Perform the focused UI quality pass required by the Design Constitution: warm matte surfaces, restrained cherry accent, spacing-led hierarchy, semantic controls, visible focus, restrained live regions, reduced motion, touch targets, drawer behavior, sticky-composer viewport handling, and no horizontal/nested-scroll failures at required widths.

**Acceptance criteria:**
- [ ] The interface is keyboard operable with logical focus and no state conveyed only by color.
- [ ] Live regions announce status without announcing every streamed token, and reduced-motion preference is respected.
- [ ] Layouts at 1440px, 1024px, 768px, and 390px have no clipped controls, horizontal overflow, or composer obstruction.

**Verification:**
- [ ] Lint passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: keyboard, reduced motion, responsive widths, and mobile on-screen keyboard behavior.

**Dependencies:** Task 15

**Files likely touched:**
- `app/app/components/app-shell/app-shell.module.css`
- `app/app/components/knowledge-base/knowledge-base.module.css`
- `app/app/components/collections/collections-drawer.module.css`
- `app/app/globals.css`
- `app/test-rag-frontend.mjs`

**Estimated scope:** Medium: 5 files

## Task 17: Run the integrated regression and browser matrix

**Description:** Run all relevant frontend, route, sidecar, build, accessibility, responsive, cancellation, ingestion, and browser checks against the completed implementation. Fix only confirmed regressions against the spec; do not add new features during final verification.

**Acceptance criteria:**
- [ ] All automated commands in the spec pass without skipped required coverage.
- [ ] Chrome, Chromium, and Safari complete the core chat, vector search, drawer ingestion, Deep Research import, and cancellation flows without console errors.
- [ ] Every acceptance criterion in the spec is either evidenced or explicitly reported as blocked before implementation is considered complete.

**Verification:**
- [ ] Run from `app/`: `npm run lint && npm run build`
- [ ] Run from `app/`: `node test-rag-frontend.mjs && node test-rag-routes.mjs && node test-rag-runtime.mjs && node test-deep-research-frontend.mjs && node test-deep-research-routes.mjs`
- [ ] Run from repository root: `sidecar/venv/bin/python -m pytest sidecar/test_main.py sidecar/test_knowledge_base_rag.py sidecar/test_step2.py sidecar/test_step3_insert.py sidecar/test_step3_bugs.py sidecar/test_step4_query.py sidecar/test_td_bridge.py`
- [ ] Manual check: complete the supported-browser and responsive matrix from the spec.

**Dependencies:** Tasks 1–16

**Files likely touched:**
- Relevant test files only if a confirmed behavior gap is found
- `docs/knowledge-base-design-overhaul-plan.md` for final evidence notes if desired

**Estimated scope:** Small: verification-first; code changes only for confirmed defects

### Checkpoint: Complete

- [ ] All automated checks pass.
- [ ] Manual Chrome, Chromium, and Safari checks pass.
- [ ] Deep Research remains functional inside the shared shell.
- [ ] Existing LightRAG data remains available.
- [ ] Knowledge Base matches `docs/design.md` and the approved spec.
- [ ] No obsolete studio, duplicate ingestion, fake status, or exposed implementation control remains.
- [ ] Human review approves the implementation against the spec.

## Parallelization Opportunities

- **After Task 4:** Task 5 (collection truth) and UI shell preparation in Task 9 may proceed in parallel if the collection response contract is fixed first.
- **After Task 7:** Task 8 (Deep Research indexing) and Task 10 (shared shell) are independent.
- **After Task 10:** Task 11 (Collections drawer) and Task 12 (Vector Search UI) can run in parallel because they use separate components and already-defined APIs.
- **After Task 12:** Task 13 must own `KnowledgeBase.tsx`; do not edit that container concurrently without coordination.
- **Task 14 follows Task 13:** citations depend on the settled chat message/event state.
- **Tasks 15–17 are sequential:** deletion must wait for replacements, and final quality checks must run after deletion.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| LightRAG streaming reference format differs from assumptions | High | Task 1 characterizes the installed public API before route/UI work. Keep all version-specific handling in one adapter. |
| Per-collection LightRAG instances reload the embedding model | High | Cache embedding/LLM functions once and test construction counts in Task 2. |
| Workspace naming breaks access to existing graph data | High | Map `default` to the current workspace convention and prove compatibility before creating new workspaces. Never rename/delete existing storage during this work. |
| Citation generation causes duplicate retrieval or another LLM call | High | Use structured LightRAG references from the same turn; reject designs that parse citations with another generation request. |
| Browser Stop does not cancel model work | High | Test cancellation at browser proxy and sidecar seams before building UI polish. |
| Unified ingestion partially succeeds | Medium | Preserve successful work and return explicit vector/graph branch results; no risky distributed rollback. |
| Research source imports become slower due to graph extraction | Medium | Keep per-source outcomes visible, process within existing import flow, and measure integrated behavior before changing concurrency. |
| Shared sidebar refactor regresses Deep Research | Medium | Centralize collections first, preserve Deep Research behavior tests, and checkpoint before replacing Knowledge Base. |
| Existing static frontend tests overfit old source strings | Medium | Prefer behavioral route/runtime checks and update static checks to assert user-visible contracts rather than exact component internals. |
| Sticky composer fails on Safari/mobile viewport changes | Medium | Reserve a dedicated responsive/accessibility task and verify current Safari plus 390px keyboard behavior. |
| Cleanup accidentally removes retained LightRAG bridge code | High | Trace callers before deletion and run `test_td_bridge.py`; delete only obsolete client presentation and dead callers. |

## Open Questions

No product questions are blocking implementation. Task 1 must resolve one dependency-specific implementation choice with evidence:

- Whether the installed LightRAG stream returns structured references directly with `include_references`, or whether the adapter must combine one structured retrieval result with its corresponding stream without repeating retrieval. The chosen path must satisfy the one-retrieval/no-extra-citation-model-call constraints.

## Plan Verification Checklist

- [x] Every implementation task has explicit acceptance criteria.
- [x] Every implementation task has runnable verification steps.
- [x] Dependencies are identified and ordered.
- [x] No planned task exceeds approximately five files.
- [x] High-risk LightRAG assumptions are tested before UI implementation.
- [x] Checkpoints occur after each major phase.
- [x] Parallel work is identified only after shared contracts stabilize.
- [ ] Human has reviewed and approved this plan before implementation begins.
