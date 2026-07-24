# Implementation Plan: Deep Research Design Overhaul

## Status

Implementation complete through Task 15. Automated, configured-service, Chromium, Playwright WebKit, and user-confirmed Safari verification pass, including a real zero-source multi-iteration run and successful browser-side subset import.

## Source of truth

- Product and design requirements: `docs/deep-research-design-overhaul-spec.md`
- Design constitution: `docs/design.md`
- Existing research pipeline: `sidecar/research/graph.py`
- Existing Deep Research UI: `app/app/page.tsx`

## Overview

Replace the current Deep Research dashboard with a single-purpose prompt-to-research-to-ingestion flow. The work proceeds contract-first: simplify the request, add live source and cancellation semantics, then replace the frontend incrementally with a composer and fixed four-pane workspace. Knowledge Base & Search remains functionally unchanged.

No dependency is added. The graph remains a small event-derived SVG implementation rather than adopting a graph library.

## Planning assumptions

1. The collection picker lists existing collections only. Collection creation and management remain outside this overhaul.
2. The initial wordmark may expose the existing Knowledge Base destination through a minimal menu so that screen remains reachable without restoring dashboard navigation.
3. The active workspace sidebar contains navigation, New research, and a non-functional/settings destination only if an existing destination can be used; no settings product is built.
4. “Sources appear as soon as they land” means one `sources_discovered` SSE event per completed search query, before scoring and the terminal `done` event.
5. Cancellation uses connection abort propagation; no cancellation endpoint or persisted run record is added.
6. Existing generated `preferred_domains` remain in the sketch and scoring. Only user-supplied domain/file-type filters are removed.
7. Existing deterministic supervisor summaries are displayed. No additional model call is added.

## Existing baseline

These are pre-existing failures, not work introduced by this plan:

- `cd app && npm run build` fails because `ResearchTrace.tsx` reads a nonexistent `TraceEvent.parent_ids`. The component is replaced and deleted by this overhaul.
- `cd app && npm run lint` reports 25 errors across research and unrelated Knowledge Base/API files. This plan fixes errors in touched Deep Research files but does not expand into unrelated cleanup.
- `cd app && node test-rag-frontend.mjs` has two stale static assertions.
- `cd app && node test-rag-runtime.mjs` is documented incorrectly; it requires its TS runtime invocation rather than plain `node`.
- Sidecar research tests currently have four stale failures: incorrect brief-event expectations, mocked SSE events that are never queued, an outdated arXiv tool expectation, and an obsolete Tavily mock target.

Final verification therefore requires:

- all new and touched-file checks to pass;
- production build to pass;
- no new repo-wide lint errors;
- unrelated baseline lint findings to be listed rather than silently fixed.

A separate cleanup may make repo-wide `npm run lint` fully green. That is not required to redesign Deep Research.

## Dependency graph

```text
Request and event contracts
    ├── remove domain/file-type plumbing
    ├── live source events
    ├── cancellation propagation
    └── ingestion result semantics
            │
            ▼
Frontend run state and SSE consumer
    ├── composer
    ├── event-derived graph
    ├── sketch + observability
    └── source selection + ingestion
            │
            ▼
Fixed workspace layout and responsive styling
            │
            ▼
Delete superseded UI and verify full flow
```

The contract tasks are sequential because they share `research.graph` and wire types. Once the frontend run shell exists, graph and read-only sketch/timeline presentation can be implemented independently, but integration into shared run state remains sequential.

---

# Phase 1: Simplify and stabilize backend contracts

## Task 1: Remove prompt filter mechanics

**Description:** Remove domain and file-type hints from brief/sketch generation while preserving agent-generated preferred domains. Keep the rest of the pipeline executable during this intermediate step.

**Acceptance criteria:**

- [ ] Brief/sketch generation accepts only the research query.
- [ ] The generated sketch still supports `preferred_domains`.
- [ ] Prompt tests prove user domain and file-type hints no longer exist.

**Verification:**

- [ ] `cd sidecar && ./venv/bin/python -m pytest test_research_sketch.py test_research_graph.py -q`
- [ ] Search confirms `_build_prompt` and `generate_brief_and_sketch` have no domain/file-type parameters.

**Dependencies:** None

**Files likely touched:**

- `sidecar/research/sketch.py`
- `sidecar/research/graph.py`
- `sidecar/test_research_sketch.py`
- `sidecar/test_research_graph.py`

**Estimated scope:** Medium — 4 files

## Task 2: Remove sidecar filter plumbing

**Description:** Remove user domain/file-type fields from FastAPI parsing, graph runner state, and Tavily calls. Repair stale sidecar tests in the same execution path without changing supervision or ranking behavior.

**Acceptance criteria:**

- [ ] `/research/stream` ignores no filter fields because they are no longer parsed or forwarded.
- [ ] `ResearchState`, `run_research`, and Tavily search have no user-domain or file-type plumbing.
- [ ] Existing query validation, research iteration, scoring, and final result shape remain intact.

**Verification:**

- [ ] `cd sidecar && ./venv/bin/python -m pytest test_research_graph.py test_research_sse.py test_research_sketch.py test_research_tools.py -q`
- [ ] `rg "user_domains|user_filetypes|data.get\(\"domains\"\)|data.get\(\"filetypes\"\)|include_domains" sidecar` returns no active pipeline references.

**Dependencies:** Task 1

**Files likely touched:**

- `sidecar/research/graph.py`
- `sidecar/research/state.py`
- `sidecar/research/tools/tavily.py`
- `sidecar/main.py`
- `sidecar/test_research_graph.py`

**Estimated scope:** Medium — 5 files

## Task 3: Narrow the Next.js research request

**Description:** Make `{ query }` the complete frontend-to-proxy request contract and ensure the proxy reconstructs that object rather than forwarding arbitrary request fields.

**Acceptance criteria:**

- [ ] `ResearchRequest` contains only `query`.
- [ ] The proxy validates and forwards only the trimmed query.
- [ ] A focused route check proves extra request fields are not forwarded.

**Verification:**

- [ ] Run the new focused route check documented in the test file.
- [ ] `cd app && npx eslint app/api/research/route.ts app/lib/research-contracts.ts`
- [ ] `rg "domains|filetypes" app/app/api/research/route.ts app/app/lib/research-contracts.ts` returns no request fields.

**Dependencies:** Task 2

**Files likely touched:**

- `app/app/lib/research-contracts.ts`
- `app/app/api/research/route.ts`
- `app/test-deep-research-routes.mjs` (new)

**Estimated scope:** Medium — 3 files

### Checkpoint A: Simplified request

- [ ] Sidecar targeted tests pass.
- [ ] Next.js research proxy check passes.
- [ ] A research run still reaches `done` with the existing final brief, sketch, sources, and trace.
- [ ] Domain and file-type inputs no longer exist on either wire boundary.

---

# Phase 2: Add the minimum event behavior required by the UI

## Task 4: Stream sources per completed search query

**Description:** Add a callback from Tavily query completion into the graph event emitter so normalized, deduplicated sources reach the browser before final scoring.

**Acceptance criteria:**

- [ ] Every completed search query emits one `sources_discovered` event with tool, query, iteration, and normalized sources.
- [ ] URLs are deduplicated case-insensitively before emission and accumulation.
- [ ] The terminal `done` result remains the authoritative ranked source list.

**Verification:**

- [ ] `cd sidecar && ./venv/bin/python -m pytest test_research_tools.py test_research_graph.py test_research_sse.py -q`
- [ ] A test covers two queries returning the same URL and observes one accumulated source.
- [ ] A test proves `sources_discovered` precedes terminal `done`.

**Dependencies:** Checkpoint A

**Files likely touched:**

- `sidecar/research/tools/tavily.py`
- `sidecar/research/graph.py`
- `sidecar/research/state.py`
- `sidecar/test_research_tools.py`
- `sidecar/test_research_graph.py`

**Estimated scope:** Medium — 5 files

## Task 5: Complete graph and timeline payloads

**Description:** Ensure existing trace events carry the query, tool, duration, result count, confidence, reason, and iteration data required by the frontend. This changes observability payloads only, not research decisions.

**Acceptance criteria:**

- [ ] Tool start/completion/failure events identify their query or query list.
- [ ] Completion/failure events include duration and result count/error.
- [ ] Supervisor and scoring events expose their existing decision metrics consistently in `snake_case`.

**Verification:**

- [ ] `cd sidecar && ./venv/bin/python -m pytest test_research_graph.py -q`
- [ ] Contract assertions cover successful tool execution, tool failure, supervisor continuation, and scoring completion.

**Dependencies:** Task 4

**Files likely touched:**

- `sidecar/research/graph.py`
- `sidecar/research/state.py`
- `sidecar/test_research_graph.py`
- `app/app/lib/research-contracts.ts`

**Estimated scope:** Medium — 4 files

## Task 6: Propagate cancellation through the stream

**Description:** Make client disconnects reliably stop the Next.js proxy reader and cancel the FastAPI research task. Use existing abort signals; do not add a cancellation endpoint.

**Acceptance criteria:**

- [ ] Aborting the browser request cancels the sidecar fetch and releases its reader.
- [ ] FastAPI cancels and awaits unfinished research in a `finally` path.
- [ ] Cancellation does not emit a misleading success or continue tool/model work.

**Verification:**

- [ ] `cd sidecar && ./venv/bin/python -m pytest test_research_sse.py -q`
- [ ] Run the focused Next.js research route check.
- [ ] Tests observe task cancellation and reader cleanup.

**Dependencies:** Task 5

**Files likely touched:**

- `sidecar/main.py`
- `sidecar/test_research_sse.py`
- `app/app/api/research/route.ts`
- `app/test-deep-research-routes.mjs`

**Estimated scope:** Medium — 4 files

## Task 7: Report partial ingestion honestly

**Description:** Preserve the existing ingestion process while returning separate imported and failed URL counts so the source pane can distinguish full and partial success.

**Acceptance criteria:**

- [ ] The endpoint returns imported URLs/count and failed URLs/count.
- [ ] A mixed result is identified as partial rather than unqualified success.
- [ ] Existing collection auto-creation and chunk defaults remain unchanged.

**Verification:**

- [ ] Run the focused ingestion route checks documented in `test-deep-research-routes.mjs`.
- [ ] `cd app && npx eslint app/api/research/ingest/route.ts`
- [ ] Test full success, partial success, total failure, and invalid input.

**Dependencies:** Checkpoint A; independent of Tasks 4–6 after request contract settles

**Files likely touched:**

- `app/app/api/research/ingest/route.ts`
- `app/test-deep-research-routes.mjs`

**Estimated scope:** Small — 2 files

### Checkpoint B: UI-ready backend

- [ ] Research emits complete chronological events and live sources.
- [ ] Final ranking remains unchanged.
- [ ] Cancellation stops upstream work.
- [ ] Ingestion distinguishes full, partial, and failed outcomes.
- [ ] Sidecar targeted suite and focused Next.js route checks pass.

---

# Phase 3: Replace the Deep Research shell

## Task 8: Build the composer and explicit run lifecycle

**Description:** Introduce a focused Deep Research controller with explicit idle/starting/researching/completed/failed/ingesting/ingested states. Replace only the Deep Research branch of `page.tsx`; keep Knowledge Base state and behavior in place.

The first working version may render simple semantic placeholders for the four panes. It must already support collection selection, submit, New research, and Cancel.

**Acceptance criteria:**

- [ ] Idle view shows the Mementos wordmark and one composer containing existing-collection selection and send.
- [ ] `Enter` submits, `Shift+Enter` inserts a newline, and submission requires prompt plus collection.
- [ ] Cancel aborts the active run, ignores late events via run ID, clears run state, and returns to idle; New research does the same after completion without aborting.

**Verification:**

- [ ] `cd app && node test-deep-research-frontend.mjs`
- [ ] `cd app && npx eslint app/components/deep-research/DeepResearch.tsx app/components/deep-research/ResearchComposer.tsx`
- [ ] Manual mock-stream check confirms state transitions and cancellation.
- [ ] Knowledge Base & Search remains reachable and its existing controls still render.

**Dependencies:** Checkpoint B

**Files likely touched:**

- `app/app/components/deep-research/DeepResearch.tsx` (new)
- `app/app/components/deep-research/ResearchComposer.tsx` (new)
- `app/app/components/deep-research/deep-research.module.css` (new)
- `app/app/page.tsx`
- `app/test-deep-research-frontend.mjs` (new)

**Estimated scope:** Medium — 5 files

## Task 9: Reconcile live and final sources

**Description:** Add the source-state logic and compact source pane before polishing the rest of the workspace. This vertical slice consumes `sources_discovered`, preserves explicit deselections, reconciles terminal ranking, and imports selected sources.

**Acceptance criteria:**

- [ ] New canonical URLs append once and start selected.
- [ ] User deselections survive later discovery events and terminal ranking.
- [ ] Import sends only selected sources and the collection captured at submission, then shows full/partial/failure status.

**Verification:**

- [ ] `cd app && node test-deep-research-frontend.mjs`
- [ ] Test duplicate URLs, late duplicates, deselection persistence, select all, zero selection, and ranked reconciliation.
- [ ] Manual check opens source links safely and imports a subset.

**Dependencies:** Task 8

**Files likely touched:**

- `app/app/components/deep-research/DeepResearch.tsx`
- `app/app/components/deep-research/SourceList.tsx` (new)
- `app/app/components/deep-research/research-state.ts` (new pure helpers)
- `app/app/components/deep-research/deep-research.module.css`
- `app/test-deep-research-frontend.mjs`

**Estimated scope:** Medium — 5 files

### Checkpoint C: Core user job

- [ ] User can submit a prompt with a collection.
- [ ] Sources arrive live, default selected, and remain deduplicated.
- [ ] User can deselect and import a subset into the original collection.
- [ ] Cancel and New research return to a clean composer.

---

# Phase 4: Build the four-pane research workspace

## Task 10: Render the event-derived execution graph

**Description:** Replace both existing graphs with one SVG graph derived from trace events. Lay out brief, repeated supervisor/tool iterations, scoring, and completion so loop direction is explicit.

**Acceptance criteria:**

- [ ] Nodes and edges come from received events, not a hard-coded architecture diagram.
- [ ] Repeated supervisor/tool loops, running/completed/failed states, and iteration labels are readable without relying only on color.
- [ ] Keyboard or pointer node selection exposes status, query, tool, duration, and result count through the shared selected-event state.

**Verification:**

- [ ] `cd app && node test-deep-research-frontend.mjs`
- [ ] Fixture with at least two iterations produces the expected ordered nodes and loop edges.
- [ ] Keyboard-select each node in a manual browser check.
- [ ] `cd app && npx eslint app/components/deep-research/ExecutionGraph.tsx app/components/deep-research/graph-model.ts`

**Dependencies:** Task 8 and Task 5

**Files likely touched:**

- `app/app/components/deep-research/ExecutionGraph.tsx` (new)
- `app/app/components/deep-research/graph-model.ts` (new pure model)
- `app/app/components/deep-research/DeepResearch.tsx`
- `app/app/components/deep-research/deep-research.module.css`
- `app/test-deep-research-frontend.mjs`

**Estimated scope:** Medium — 5 files

## Task 11: Consolidate sketch and observability

**Description:** Replace the brief card, supervisor checklist, trace summary, and thinking accordion with one read-only sketch pane and one chronological observability timeline using data already emitted by the pipeline.

**Acceptance criteria:**

- [ ] Sketch shows concepts, terms, queries, patterns, and generated preferred domains as restrained grouped text.
- [ ] Timeline shows step, tool, query, duration, result count, confidence, sub-questions, gaps, errors, iteration, and stop reason in event order.
- [ ] Selecting a brief node focuses sketch detail; selecting another node focuses its timeline event without an additional permanent pane or model call.

**Verification:**

- [ ] `cd app && node test-deep-research-frontend.mjs`
- [ ] Empty, running, failed, timeout, and completed fixtures render meaningful text states.
- [ ] Timeline DOM order matches event timestamp/order.
- [ ] `cd app && npx eslint app/components/deep-research/ResearchSketch.tsx app/components/deep-research/ObservabilityTimeline.tsx`

**Dependencies:** Tasks 8 and 10

**Files likely touched:**

- `app/app/components/deep-research/ResearchSketch.tsx` (new)
- `app/app/components/deep-research/ObservabilityTimeline.tsx` (new)
- `app/app/components/deep-research/DeepResearch.tsx`
- `app/app/components/deep-research/deep-research.module.css`
- `app/test-deep-research-frontend.mjs`

**Estimated scope:** Medium — 5 files

## Task 12: Compose the fixed graph-first workspace

**Description:** Add the active sidebar, read-only query/status header, and fixed desktop/mobile arrangement for graph, sketch, observability, and sources. Apply the matte, nearly monochrome, cherry-accent visual language locally so Knowledge Base styling is not redesigned.

**Acceptance criteria:**

- [ ] At 1024px and 1440px all four panes are simultaneously visible in the specified fixed positions, with the graph largest.
- [ ] At 768px and 390px navigation compacts and panes form the specified linear order without horizontal page overflow.
- [ ] Styling uses system fonts, minimal borders, one cherry accent, visible focus, reduced motion, and no Deep Research gradients/glass/nested cards.

**Verification:**

- [ ] `cd app && npm run build`
- [ ] `cd app && node test-deep-research-frontend.mjs`
- [ ] Manual responsive checks at 390, 768, 1024, and 1440px.
- [ ] Keyboard navigation and reduced-motion checks.

**Dependencies:** Tasks 9–11

**Files likely touched:**

- `app/app/components/deep-research/ResearchWorkspace.tsx` (new)
- `app/app/components/deep-research/DeepResearch.tsx`
- `app/app/components/deep-research/deep-research.module.css`
- `app/app/page.tsx`
- `app/test-deep-research-frontend.mjs`

**Estimated scope:** Medium — 5 files

### Checkpoint D: Complete redesigned flow

- [ ] Composer and active workspace match the spec's information architecture.
- [ ] Graph, sketch, timeline, and sources remain simultaneously readable on desktop.
- [ ] Mobile layout is linear and usable.
- [ ] Complete submit → observe → select → ingest → new research flow works.
- [ ] Production build passes.

---

# Phase 5: Delete superseded Deep Research code

## Task 13: Remove the old Deep Research branch

**Description:** Delete old Deep Research JSX, state derivations, handlers, inline styles, and imports from the monolithic page after the replacement path is complete. Preserve Knowledge Base handlers and state, including the minimum correction needed for its current missing result-expansion state so the production build passes.

**Acceptance criteria:**

- [ ] `page.tsx` delegates Deep Research to the new controller and contains no old research hero/results branch.
- [ ] Domain/file-type, old trace derivation, old source selection, and old ingest-web state are absent from `page.tsx`.
- [ ] Knowledge Base & Search behavior is unchanged and production TypeScript succeeds.

**Verification:**

- [ ] `cd app && npm run build`
- [ ] `cd app && node test-deep-research-frontend.mjs`
- [ ] Run the existing Knowledge Base static checks and record pre-existing stale assertions separately.
- [ ] `rg "researchDomains|researchFiletypes|AgentThinkingAccordion|SupervisorChecklist|ResearchTrace|ReactFlowGraph" app/app/page.tsx` returns no matches.

**Dependencies:** Checkpoint D

**Files likely touched:**

- `app/app/page.tsx`
- `app/app/page.module.css`
- `app/test-rag-frontend.mjs`
- `app/test-deep-research-frontend.mjs`

**Estimated scope:** Medium — 4 files

## Task 14: Delete obsolete graph and observability modules

**Description:** Remove the now-unreferenced static graph, duplicate trace graph, thinking accordion, supervisor checklist, and static topology API. Confirm no caller remains before deletion.

**Acceptance criteria:**

- [ ] All five obsolete modules are deleted.
- [ ] No imports or route callers remain.
- [ ] No replacement duplicates their responsibilities.

**Verification:**

- [ ] `rg "ReactFlowGraph|ResearchTrace|AgentThinkingAccordion|SupervisorChecklist|research/topology" app --glob '!node_modules/**' --glob '!.next/**'` returns no active references.
- [ ] `cd app && npm run build`

**Dependencies:** Task 13

**Files likely touched:**

- `app/app/components/ReactFlowGraph.tsx` (delete)
- `app/app/components/ResearchTrace.tsx` (delete)
- `app/app/components/AgentThinkingAccordion.tsx` (delete)
- `app/app/components/SupervisorChecklist.tsx` (delete)
- `app/app/api/research/topology/route.ts` (delete)

**Estimated scope:** Medium — 5 deleted files

## Task 15: Prune obsolete Deep Research styles and checks

**Description:** Remove dead Deep Research card/chip/graph CSS and replace stale static assertions with checks for the new behavior. Do not restyle or rewrite Knowledge Base sections.

**Acceptance criteria:**

- [ ] Old Deep Research selectors have no definitions or callers.
- [ ] New tests assert intended behavior rather than old component names or copy.
- [ ] No broad global theme rewrite changes Knowledge Base presentation.

**Verification:**

- [ ] `cd app && node test-deep-research-frontend.mjs`
- [ ] `cd app && npm run build`
- [ ] Run ESLint on every touched frontend file.
- [ ] `git diff --check`

**Dependencies:** Task 14

**Files likely touched:**

- `app/app/page.module.css`
- `app/test-rag-frontend.mjs`
- `app/test-deep-research-frontend.mjs`

**Estimated scope:** Medium — 3 files

---

# Final checkpoint

## Automated verification

- [x] `cd sidecar && ./venv/bin/python -m pytest test_research_graph.py test_research_sse.py test_research_sketch.py test_research_tools.py -q` — 34 passed.
- [x] Focused Deep Research route check — 20 passed.
- [x] `cd app && node test-deep-research-frontend.mjs` — 35 passed.
- [x] `cd app && npm run build` — passed.
- [x] ESLint on touched frontend files — zero errors.
- [x] `cd app && npm run lint` — no errors; unrelated baseline warnings listed in output.
- [x] `git diff --check` — passed.

## Integrated browser verification

Using configured services and browser-compatible runtimes:

- [x] Safari: user confirmed submit, two iterations, node inspection, live deselection, subset import, and New Research.
- [x] Chrome/Chromium: the same flow was verified.
- [x] Cancel returns immediately to the composer and stale events are ignored.
- [x] Full, partial, failed, timeout, and zero-source states verified.
- [x] Keyboard navigation and visible focus verified.
- [x] Reduced motion verified.
- [x] 390, 768, 1024, and 1440px layouts verified without horizontal overflow or nested-scroll traps.
- [x] No browser console errors observed.

## Completion criteria

- [x] Every acceptance criterion in `docs/deep-research-design-overhaul-spec.md` is satisfied, except the documented repo-wide lint baseline qualification.
- [x] Knowledge Base & Search remains reachable and functionally unchanged.
- [x] No new dependency, generalized design system, state library, or graph library was introduced.
- [x] The implementation is ready for code review.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Source callback changes Tavily concurrency behavior | High | Keep concurrent query tasks; callback only after each task returns; test ordering-independent accumulation. |
| Aborted client leaves sidecar task running | High | Cancel and await task in generator `finally`; test cancellation explicitly. |
| Late SSE events mutate a fresh run | High | Assign a client run ID and ignore events from stale readers. |
| Final ranking reselects rejected sources | High | Track explicit deselections separately from default-selected discovery state. |
| Event-derived graph becomes unreadable during loops | High | Model layout from deterministic iteration lanes and test a two/three-iteration fixture before styling. |
| Extracting Deep Research breaks Knowledge Base state | Medium | Keep Knowledge Base in `page.tsx`; replace one conditional branch at a time and run existing checks after each integration task. |
| Global CSS overhaul unintentionally restyles Knowledge Base | Medium | Scope new design to `deep-research.module.css`; avoid global token replacement. |
| Existing test suite gives false confidence | Medium | Repair only stale tests in touched paths and add focused contract/behavior checks before deleting old code. |
| Live sources arrive without final scores | Low | Do not display scores in the compact row; reconcile and reorder on terminal ranked result. |
| Initial minimal screen hides Knowledge Base navigation | Low | Use the existing Mementos wordmark as a restrained menu trigger; active workspace uses the compact sidebar. |

## Parallelization opportunities

After Checkpoint B:

- Task 7 ingestion semantics may run independently from Tasks 4–6 once the request contract is stable.
- After Task 8 establishes shared frontend state, the pure graph model from Task 10 and read-only sketch/timeline presentation from Task 11 can be developed in parallel only if their props are fixed first.
- Tasks 13–15 are sequential because each removes callers before files and styles are deleted.

## Open questions

None blocking. If strict repo-wide lint cleanliness is required for this feature, authorize a separate cleanup task rather than mixing unrelated Knowledge Base/API changes into the overhaul.
