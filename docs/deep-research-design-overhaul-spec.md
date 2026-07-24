# Spec: Deep Research Design Overhaul

## Status

Proposed — requires approval before implementation.

## Objective

Redesign only the Mementos Deep Research experience around its actual job:

> Submit one research prompt, observe the live research pipeline, select the useful sources, and ingest them into a chosen collection.

The product is not a conversational assistant. It is a single-user chat-to-research-to-sources pipeline. The redesign must make that pipeline obvious, keep all operationally useful information readable, and remove dashboard controls that do not serve it.

Success means:

1. The initial screen has one clear focal point: the research composer.
2. The active screen has four distinct, simultaneous panes: live graph, research sketch, chronological observability, and sources.
3. The graph accurately depicts the executed pipeline and its supervisor/tool loops.
4. Sources appear before final scoring, are deduplicated, default to selected, and can be ingested into the collection chosen before research starts.
5. The interface follows `docs/design.md`: light-first, matte, nearly monochrome, minimally bordered, restrained, and accessible.

## User and primary workflow

- User: the project owner; multi-user concerns are out of scope.
- Primary job: ingest findings from completed research.
- Research output: the current brief/sketch/source result remains correct; no synthesized conversational answer is added.
- Session model: one ephemeral research run at a time; no history or saved sessions.

### Primary flow

1. Open Deep Research.
2. Choose an existing collection in the composer.
3. Enter a prompt.
4. Submit the prompt.
5. Observe the live graph, sketch, timeline, and arriving sources.
6. Optionally deselect unwanted sources.
7. Import the selected sources into the preselected collection.
8. Start a new research run, which clears the current run and returns to the composer.

### Cancellation flow

1. Select **Cancel** while research is running.
2. Abort the browser request and upstream sidecar task.
3. Discard partial UI state from that run.
4. Return immediately to a clean composer.

Cancellation does not preserve or ingest partial findings.

## Scope

### In scope

- Deep Research empty, running, completed, failed, cancelled, and ingestion states.
- Deep Research information architecture and responsive layout.
- A new event-driven execution graph based on actual trace events.
- A chronological observability timeline.
- Live source arrival, deduplication, selection, and ingestion.
- Existing-collection selection before research starts.
- Removal of user-supplied domain and file-type filters from frontend and backend.
- Removal of redundant Deep Research components, state, styles, and API fields.
- A compact sidebar in the active research workspace.
- Chrome, Chromium, and Safari support.

### Out of scope

- Redesigning Knowledge Base & Search.
- Changing research ranking, supervision, query decomposition, or stopping behavior.
- Adding a synthesized research answer or conversational thread.
- User-selectable tools or research modes.
- Resizable or rearrangeable panes.
- Graph zoom, pan, minimap, or fullscreen controls.
- Dark mode.
- Research history, saved sessions, authentication, or multi-user behavior.
- Mobile-specific feature parity beyond a readable linear layout.
- New graph or design-system dependencies.
- Collection creation, deletion, or full collection management inside this overhaul. The composer only selects an existing collection; broader management remains a separate screen and may later move to settings.

## Design principles

The implementation must follow `docs/design.md` over the current Material/glass styling.

- Warm white matte background; charcoal text.
- Near-monochrome palette.
- Cherry red is the only brand accent and is reserved for focus, selection, active state, and primary actions.
- Semantic success, warning, and error colors may be used sparingly with text or icons; color must not be the only signal.
- System font stack. Do not add a font dependency.
- Minimal borders around the four genuinely distinct panes.
- No decorative gradients, glass cards, nested cards, giant pills, stacked shadows, or ornamental logo mark.
- Use spacing, typography, and alignment before adding containers.
- Motion is limited to subtle fades, status transitions, and graph continuity; respect `prefers-reduced-motion`.
- Every interactive element must have a visible keyboard focus state and an accessible name.

## Information architecture

Deep Research has two mutually exclusive views.

### View A: Composer

The initial view contains only:

- The `Mementos` wordmark as text; no decorative logo icon.
- One centered multiline composer.
- An existing-collection selector integrated into the composer footer.
- One send action integrated into the composer.

It does not show:

- Domain or file-type controls.
- Tool or research-mode controls.
- Tab pills, Qdrant status, dashboards, cards, suggested prompts, or explanatory marketing copy.
- The active-workspace sidebar.

Suggested placeholder: `What should Mementos research?`

Keyboard behavior:

- `Enter` submits when the composer contains a non-empty prompt and a collection is selected.
- `Shift+Enter` inserts a newline.
- The send action remains available for pointer and touch input.

### View B: Active research workspace

A compact sidebar appears only after submission. It provides:

- Mementos text identity.
- A **New research** action.
- A settings entry for future app-level settings; no new settings implementation is required by this spec.

The main workspace uses a fixed graph-first layout:

```text
┌────────┬────────────────────────────────────┬──────────────────────┐
│        │ Query, status, elapsed time, Cancel│                      │
│        ├────────────────────────────────────┤ Research sketch      │
│ Side-  │                                    │                      │
│ bar    │ Live execution graph               ├──────────────────────┤
│        │                                    │ Sources              │
│        ├────────────────────────────────────┤                      │
│        │ Tool calls & observability         │                      │
└────────┴────────────────────────────────────┴──────────────────────┘
```

- Left/main column: approximately two-thirds of available workspace width.
- Right/inspector column: approximately one-third.
- Graph receives the largest area.
- Observability sits directly beneath the graph.
- Sketch sits above sources in the right column.
- All four panes remain visible simultaneously at desktop widths.
- Pane positions are fixed and are not user-resizable.

The query is read-only after submission. The top row shows its status, elapsed time, and Cancel while running. After completion, Cancel is replaced by New research.

### Responsive behavior

At narrow widths, the sidebar becomes a compact top navigation and panes become one linear page in this order:

1. Query and run status
2. Graph
3. Sketch
4. Observability
5. Sources and ingestion action

The mobile layout prioritizes readability; it does not add tabs, horizontal pane scrolling, or graph controls.

## Pane requirements

### 1. Live execution graph

The graph is generated from live trace events. It must not use the current hard-coded topology.

The graph depicts actual execution:

1. Brief generation
2. Supervisor evaluation
3. One tool invocation node per executed tool call
4. Return from tool execution to the next supervisor iteration
5. Repeated supervisor/tool loop for each iteration
6. Scoring
7. Research completion

Graph rules:

- Each iteration is visually distinguishable without relying only on color.
- Loop edges visibly return tool execution to the next supervisor node.
- Completed nodes remain visible.
- Running, completed, failed, and cancelled states have distinct labels and geometry/icon treatment.
- The graph ends at research completion. Source ingestion is a subsequent user action, not a research-graph node.
- Do not render both a static architecture graph and a dynamic trace graph.
- Do not add graph controls in this iteration.

Each node displays a concise label and status. Selecting a node exposes:

- status
- query or query list, when applicable
- tool name, when applicable
- duration, when known
- result count, when known

Node details reuse the existing panes rather than opening a fifth permanent pane:

- Selecting the brief node focuses the relevant sketch details.
- Selecting a supervisor or tool node focuses the corresponding observability event and displays its details there.
- Selection is keyboard accessible.

### 2. Research sketch

The sketch remains visible because it is part of the research mechanics, not decorative frontend content.

It includes:

- expected concepts
- discriminative terms
- search queries
- expected patterns
- preferred domains generated by the research system

The sketch is read-only. It is shown as compact grouped text, not a field of colorful chips. Selecting the brief node may reveal the full sketch details or highlight this pane.

`preferred_domains` generated by the agent remains part of the sketch and scoring behavior. It is distinct from the removed user-supplied domain filter.

### 3. Tool calls and observability

Use one chronological timeline rather than separate checklist, trace, thinking, and iteration components.

The default timeline shows all currently useful operational data:

- current pipeline step
- tool call start, completion, or failure
- query text
- elapsed duration
- result count
- supervisor confidence
- unresolved or partially resolved sub-questions
- gap analysis
- errors
- iteration boundaries and stop reason

Tool queries and results are visible inline where available. Raw SSE payloads are not shown by default. They may be available through a small developer disclosure only if this can be implemented from already-received data without additional backend work or latency.

Do not expose verbose chain-of-thought. Existing deterministic reflection, gap, confidence, and decision summaries may be displayed because they are already produced by the pipeline and add no new model call or latency. Do not add a summarization request.

### 4. Sources and ingestion

Sources appear in a compact vertical list as soon as the backend reports them, before final scoring completes.

Each source row shows only:

- selection checkbox
- title
- domain
- snippet

Behavior:

- Every newly discovered source is selected by default.
- The user can select or deselect sources individually.
- A select-all control is available.
- Later source events must not reselect a source the user explicitly deselected.
- Duplicate sources are discarded by canonicalized URL.
- Final ranked results reconcile with the live list without losing selection state.
- Scores may determine final ordering but are not displayed in the default row.
- Clicking the title opens the source in a new tab with safe link attributes.

The primary completed-state action is:

> Import selected sources

It imports into the collection chosen in the composer. The collection is not requested again after research begins. The action is disabled when no source is selected or ingestion is active.

After ingestion, show a concise success summary with imported source and chunk counts. Partial source-ingestion failures must be reported rather than presented as complete success.

## State model

The Deep Research UI uses these explicit states:

- `idle`: composer shown
- `starting`: request submitted, workspace initialized
- `researching`: SSE stream active
- `completed`: terminal result received
- `failed`: terminal or network error; workspace remains readable with retry/new research actions
- `ingesting`: selected sources are being imported
- `ingested`: ingestion result shown

`cancelled` is a transition back to `idle`, not a retained screen.

State rules:

- A run receives a client-side run ID so late events from an aborted run are ignored.
- Starting a new run clears graph, sketch, observability, sources, selection, errors, and ingestion status.
- The selected collection may remain selected when returning to the composer.
- Source selection is keyed by canonical URL, not array index.
- Empty, loading, partial, timeout, failure, and zero-source results all have explicit text states.

## API and event contract changes

### Research request

Replace the request shape with:

```ts
interface ResearchRequest {
  query: string;
}
```

The selected collection is not part of research execution. It is retained client-side and sent only to `/api/research/ingest`.

Remove user-supplied `domains` and `filetypes` end to end:

- Deep Research form state and request body
- TypeScript request contract
- Next.js research proxy forwarding
- FastAPI request parsing
- `run_research` parameters and initial state
- `ResearchState.user_domains` and `ResearchState.user_filetypes`
- sketch prompt parameters and user hints
- Tavily `include_domains` plumbing that only served this input
- obsolete tests and fixtures for these inputs

The Next.js proxy must forward an explicit `{ query }` object instead of forwarding the entire untrusted request body.

### Live sources event

Add one SSE event type:

```ts
type SourcesDiscoveredEvent = {
  id: string;
  type: 'sources_discovered';
  iteration: number;
  parent_id?: string;
  timestamp: number;
  payload: {
    tool: 'tavily' | 'arxiv' | 'github';
    query: string;
    sources: Source[];
  };
};
```

Requirements:

- Emit the event after each individual search query returns, not only after all research iterations finish.
- Normalize and deduplicate sources before emission.
- Preserve the existing final `done` result as the authoritative ranked result.
- Do not change ranking, supervision, iteration, or stopping logic.

### Trace payload completeness

Ensure trace events contain the data required by the graph and timeline:

- `tool_started`: tool, query or query list, iteration
- `tool_completed`: tool, query or query list, duration, result count, iteration
- `tool_failed`: tool, query or query list, duration, error, iteration
- supervisor events: decision, reason, confidence, iteration
- scoring events: source count and completion

Use one naming convention on the wire. New and updated payload fields use `snake_case` to match the sidecar; frontend normalization happens once at the SSE boundary if needed.

### Cancellation

Use the browser's `AbortController`; do not add a cancellation endpoint.

Cancellation must propagate:

1. Client aborts `/api/research`.
2. Next.js proxy aborts its sidecar fetch and releases the stream reader.
3. FastAPI streaming generator cancels and awaits the running research task in `finally`.
4. No cancelled task continues consuming tool or model resources.

### Ingestion contract

Keep `/api/research/ingest` as the ingestion endpoint and retain its current collection-based behavior. Tighten its result semantics during implementation:

- Return imported URLs/count and failed URLs/count separately.
- Do not describe partial ingestion as unqualified success.
- Keep chunk configuration internal/default for Deep Research; do not expose chunk sliders in this flow.

## Components and project structure

No new dependency is required. Use React, CSS Modules, semantic HTML, and SVG.

Target structure; exact naming may vary if an existing component can be reused cleanly:

```text
app/app/
├── page.tsx                         # Top-level screen selection only
├── page.module.css                  # Shared page tokens/layout where still appropriate
├── components/
│   └── deep-research/
│       ├── DeepResearch.tsx         # Run state and request orchestration
│       ├── ResearchComposer.tsx     # Prompt + collection + send
│       ├── ResearchWorkspace.tsx    # Fixed four-pane composition
│       ├── ExecutionGraph.tsx       # Event-derived SVG graph
│       ├── ResearchSketch.tsx       # Read-only sketch
│       ├── ObservabilityTimeline.tsx
│       └── SourceList.tsx           # Selection + ingestion action
└── lib/
    └── research-contracts.ts        # Request/result/SSE contracts
```

Avoid abstraction beyond these visible responsibilities. Do not add a general component library or global state store.

## Deletions and consolidation

After replacement, delete Deep Research code that no longer has a caller:

- Hard-coded `ReactFlowGraph` topology and static ingest node
- Separate `ResearchTrace` graph
- `AgentThinkingAccordion`
- `SupervisorChecklist`
- Domain and file-type UI/state/backend plumbing
- Deep Research card/chip/glass styles superseded by the new design
- Duplicate presentation of brief, trace, tools, supervisor, confidence, and iteration data
- Qdrant-active badge from the Deep Research surface

Do not delete Knowledge Base & Search behavior or its components merely because its design is out of scope. Shared code must be checked for callers before removal.

## Accessibility

- Use semantic `form`, `button`, `select`, `ol`, `li`, `aside`, and heading elements.
- Label the composer and collection selector.
- Announce run status and ingestion status through restrained `aria-live` regions.
- Graph nodes are focusable controls with visible focus and textual names.
- Provide a textual graph/timeline representation so the pipeline is understandable without interpreting SVG geometry.
- Source rows use real checkboxes and links; clicking a row must not create duplicate checkbox toggles.
- Maintain WCAG AA text contrast.
- Do not rely solely on cherry red, green, or node fill to convey state.
- Respect `prefers-reduced-motion`.

## Browser and responsive support

Required:

- Current Safari
- Current Chrome
- Current Chromium-based browsers

Verify at minimum:

- 1440px desktop graph-first layout
- 1024px compact desktop/tablet layout
- 768px and 390px linear layouts

No browser-specific graph library behavior may be assumed.

## Commands

From `app/`:

```bash
npm run lint
npm run build
node test-rag-frontend.mjs
node test-rag-routes.mjs
node test-rag-runtime.mjs
```

From the repository root:

```bash
python -m pytest sidecar/test_research_graph.py sidecar/test_research_sse.py sidecar/test_research_sketch.py sidecar/test_research_tools.py
```

Use `./start.sh` for integrated manual verification.

## Testing strategy

### Contract and backend tests

- A research request accepts `query` and no longer depends on domain/file-type fields.
- The Next.js proxy forwards only `query`.
- Each completed search query emits deduplicated `sources_discovered` data.
- Tool events contain query, duration, result count, and iteration where applicable.
- Final `done` still returns the authoritative ranked sources.
- Cancelling the stream cancels the sidecar task.
- Ingestion reports partial failures accurately.

### Frontend behavior tests

Use the existing lightweight test approach; do not add a test framework solely for this overhaul.

Verify:

- Idle view contains only the intended composer surface.
- Submission requires both a non-empty prompt and selected collection.
- `Enter` submits and `Shift+Enter` inserts a newline.
- Live events append graph nodes and chronological timeline entries.
- Source events append deduplicated, default-selected sources.
- Explicitly deselected sources remain deselected after later events and final ranking.
- Cancel aborts the request, clears the run, and returns to the composer.
- Import sends only selected sources and the originally selected collection.
- New research clears the current run.

### Manual browser verification

In Safari and Chrome:

- Run a query that produces at least two supervisor/tool iterations.
- Confirm loop direction and active/completed graph states are readable.
- Select graph nodes and verify their details.
- Deselect sources while new sources are still arriving.
- Cancel one active run and confirm no more events appear.
- Complete a run and ingest a subset of sources.
- Keyboard-navigate the entire flow.
- Confirm no console errors, clipped panes, nested scrolling traps, or horizontal page overflow.

## Implementation sequence

1. Update and test research request/SSE contracts, live source events, and cancellation cleanup.
2. Introduce the explicit Deep Research state model and composer without changing Knowledge Base & Search.
3. Build the event-derived graph and node selection behavior.
4. Consolidate observability into one timeline and sketch into one pane.
5. Build live source reconciliation, selection, and ingestion states.
6. Apply the new layout and visual language, including responsive behavior.
7. Delete superseded Deep Research components, state, and styles.
8. Run backend, frontend, build, accessibility, responsive, Safari, and Chrome checks.

## Boundaries

### Always

- Preserve existing research ranking and stopping behavior.
- Validate request data at API boundaries.
- Preserve selection state while reconciling live and final sources.
- Trace all callers before deleting shared code.
- Keep the interface operable by keyboard.
- Run lint, build, and relevant regression tests before completion.

### Ask first

- Adding any dependency.
- Changing source ranking or supervisor logic.
- Changing Knowledge Base & Search behavior.
- Adding collection management to Deep Research.
- Persisting sessions or research data.

### Never

- Add a chat conversation or generated final answer.
- Expose domain, file-type, tool, or research-mode controls.
- Add decorative gradients, broad glass surfaces, nested card layouts, or dark mode.
- Continue backend work after the user cancels.
- Auto-ingest sources without the explicit import action.
- Reintroduce duplicate graph or observability views.

## Acceptance criteria

The overhaul is complete when all of the following are true:

- [ ] Before submission, Deep Research shows a wordmark and one composer containing collection selection and send.
- [ ] Domain and file-type input is removed from frontend, proxy, sidecar route, graph state, sketch prompt, tool plumbing, and tests.
- [ ] Submission transitions to a fixed four-pane graph-first workspace.
- [ ] The graph is derived from actual trace events and clearly renders repeated supervisor/tool loops.
- [ ] Clicking a node exposes status, query, tool, duration, and result count when applicable.
- [ ] The sketch, graph, observability timeline, and sources are all simultaneously visible on desktop.
- [ ] Observability is chronological and includes step, tool, query, duration, count, confidence, gaps, sub-questions, errors, iteration, and stop reason.
- [ ] No new model summarization call or latency is added.
- [ ] Sources appear before final completion, are URL-deduplicated, and default to selected.
- [ ] User deselections survive later source events and final source ranking.
- [ ] Import sends only selected sources to the collection chosen before research.
- [ ] Cancel aborts upstream work, clears the run, and returns to the composer.
- [ ] New research clears the run and opens a fresh composer.
- [ ] Knowledge Base & Search behavior is unchanged.
- [ ] The old static graph, duplicate dynamic graph, separate thinking accordion, and supervisor checklist are removed.
- [ ] The result follows the light matte, minimally bordered, cherry-accent design constitution.
- [ ] The layout becomes a readable linear page on narrow screens.
- [ ] Lint, build, frontend route/runtime checks, and sidecar research tests pass.
- [ ] The flow is manually verified in Safari and Chrome without console errors or horizontal overflow.

## Open questions

None blocking. Exact spacing, cherry-red token, pane proportions, and graph geometry are implementation-level design decisions governed by `docs/design.md` and the acceptance criteria above.
