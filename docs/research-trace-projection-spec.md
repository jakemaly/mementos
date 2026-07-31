# Deep Research Trace Projection

## Status

Proposed — architecture spec for candidate 1.

## Decision summary

Deepen the Deep Research trace seam with a feature-local, pure projection module. Keep the existing SSE wire contract and visual layout. Normalize the current `TraceEvent[]` once, then let the execution graph and observability timeline act as view adapters over the same semantic facts.

Default decisions adopted during exploration:

- Frontend projection only; no sidecar or wire-contract redesign.
- Pure projection from the current event list; no incremental reducer.
- Event-derived facts only; source selection, cancellation, and ingestion remain in the research run module.
- Feature-local seam beside the Deep Research views.
- Normalized trace facts, not ready-to-render graph and timeline models.
- Trace arrival order is authoritative; do not sort by timestamps.
- `parent_id` is the only pairing key.
- Paired tool events become one invocation fact.
- Supervisor evaluation plus its follow-up becomes one iteration fact.
- Scoring start plus ranking becomes one scoring fact.
- `sources_discovered` remains a standalone fact and does not add new visual nodes in this change.
- Existing snake_case and camelCase aliases remain supported.
- Partial `done` remains a completed trace fact with metadata; run lifecycle state remains responsible for failure presentation.
- Cancellation creates no synthetic trace event.
- Unknown events are preserved as unknown facts and do not fail the workspace.
- No new dependency; use the existing `npx tsx` test convention.

## Problem statement

The Deep Research workspace has one event stream but several interpretations of it:

- `DeepResearch.tsx` parses SSE data, normalizes brief/sketch payloads, and handles source events.
- `ExecutionGraph.tsx` pairs tool starts with completions, assigns statuses, and builds loop edges.
- `ObservabilityTimeline.tsx` independently pairs tool starts with completions and interprets every event type again.
- `ResearchSketch.tsx` separately reconstructs the brief and sketch display model.

The same event semantics therefore cross the seam multiple times. A new event, payload alias, pairing rule, or terminal-state rule can fix one view while leaving another stale. The current static frontend checks mostly prove that source strings exist; they do not provide one durable test surface for trace behavior.

The module is shallow at this seam: callers learn the raw event vocabulary, parent-link rules, payload names, and lifecycle quirks instead of learning one compact trace model.

## Goal

Create one deep in-process module that hides event interpretation behind a small interface. Callers should receive normalized trace facts in emitted order. Graph and timeline layout remain in their existing view modules, but neither module knows how raw event types are paired or how payload aliases are normalized.

The interface is the test surface. Tests should exercise the projection through deterministic trace fixtures and assert observable facts, not its internal maps or helper names.

## Scope

### In scope

- Add a feature-local trace projection module under `app/app/components/deep-research/`.
- Normalize all currently declared `TraceEventType` values.
- Fold related lifecycle events into semantic facts.
- Move snake_case/camelCase compatibility handling into the projection module.
- Refactor `ExecutionGraph.tsx` and `ObservabilityTimeline.tsx` to consume normalized facts.
- Route brief/sketch and source-discovery interpretation through the projection seam where the run module needs those facts.
- Preserve the current graph topology, responsive layout, accessibility behavior, and user-facing controls.
- Add direct projection fixtures and update existing Deep Research checks to verify the shared seam.

### Out of scope

- Changing the Python sidecar or the SSE wire contract.
- Adding runtime schema validation at the network seam.
- Changing source ranking, supervision, iteration limits, or stopping behavior.
- Moving source selection, deselection persistence, cancellation, elapsed time, or ingestion into the projection module.
- Adding a global state store or shared app-level trace library.
- Adding graph controls, new graph nodes, new timeline categories, or a visual redesign.
- Replaying or merging the terminal result's server-provided `trace` array.
- Synthesizing a cancellation event after the browser aborts.

## Proposed module

Suggested file: `app/app/components/deep-research/trace-model.ts`.

Conceptual interface:

```ts
type TraceFact =
  | BriefFact
  | SupervisorIterationFact
  | ToolInvocationFact
  | IterationFact
  | SourceDiscoveryFact
  | ScoringFact
  | DoneFact
  | ErrorFact
  | UnknownFact;

interface ResearchTraceProjection {
  facts: readonly TraceFact[];
  brief?: BriefFact;
  sourceDiscoveries: readonly SourceDiscoveryFact[];
}

function projectTrace(events: readonly TraceEvent[]): ResearchTraceProjection;
```

The exact type names may change during implementation. The shape must remain small: one pure entry point, one ordered fact collection, and focused access to the brief and source discoveries needed by the existing run and view modules.

The module must not return SVG positions, paths, CSS states, or ready-to-render timeline rows. Those are implementation details of the graph and timeline adapters. Keeping them out preserves depth and prevents the projection interface from becoming a second view framework.

## Fact semantics and invariants

### Ordering

- Preserve the input trace sequence as the authoritative order.
- Do not sort by `timestamp`; current server timestamps are monotonic while locally synthesized client timestamps use wall-clock time.
- When paired events exist, anchor the folded fact at the initiating event's position.
- An unmatched completion remains visible at its own position.

### Pairing

- Use `parent_id` as the only pairing key.
- Never infer a match from tool name, iteration, array position, or timing.
- An unmatched tool start produces a running invocation fact.
- An unmatched tool completion/failure produces a standalone invocation fact with missing-start metadata.
- Pairing must work even when the full trace contains non-adjacent related events.

### Brief and sketch

- Normalize the current snake_case fields and the camelCase aliases already accepted by the frontend.
- A brief fact contains the research brief, reasoning summary, query plan, tools, and normalized sketch data when present.
- Existing `ResearchSketch` presentation remains unchanged; it receives normalized data rather than parsing raw payloads.

### Supervisor

- Fold `supervisor_evaluation` with its `supervisor_started` or `supervisor_completed` child into one supervisor iteration fact.
- Preserve confidence, reflection, gap analysis, sub-questions, decision, and reason.
- Do not expose the raw parent-linking rule to the graph or timeline adapters.

### Tools

- Fold `tool_started` with its matching `tool_completed` or `tool_failed` into one tool invocation fact.
- Preserve tool, query/query list, iteration, duration, result count, and error data.
- A tool invocation fact may be running, completed, or failed.

### Iterations

- Keep `iteration_complete` as an ordered iteration fact with total and newly discovered source counts.
- Preserve iteration numbering exactly as received.

### Source discovery

- Keep every `sources_discovered` event as a standalone discovery fact.
- Preserve query, tool, iteration, parent ID, and normalized sources.
- The research run module consumes these facts for default selection and deselection persistence.
- This spec does not add graph nodes or timeline rows for source discovery.

### Scoring

- Fold `scoring_started` with its matching `sources_ranked` event into one scoring fact.
- Preserve source count, top score, and whether ranking completed.
- Existing view presentation remains otherwise unchanged.

### Terminal and error facts

- The run module continues to append one local terminal `done` event to the live trace. Its payload may carry terminal sketch/brief fallback data and partial/timeout metadata.
- The projection uses the live trace plus that one local terminal fact. It does not replace or merge the live trace with `result.trace` from the terminal payload.
- A partial `done` is still a completed trace fact with `partial` and `timeout_phase` metadata. The run lifecycle may still mark the overall run as failed, preserving current behavior.
- Error events remain ordered error facts.
- Browser cancellation clears the run and produces no synthetic cancellation fact.

### Unknown and malformed input

- An event with an unknown type is retained as an unknown fact containing its ID, type, and payload where available.
- Unknown facts must not make the projection throw or make the graph/timeline unusable.
- The existing SSE decoder may continue to skip malformed JSON blocks before they reach the projection.
- A runtime-shaped event with missing fields should degrade to an unknown or incomplete fact rather than crash the workspace.

## Module responsibilities

### Projection module

Owns:

- event-type interpretation;
- payload alias normalization;
- parent-link pairing;
- folded lifecycle facts;
- stable fact ordering;
- unknown-event tolerance;
- normalized brief, sketch, source-discovery, terminal, and error facts.

Does not own:

- network fetches or SSE framing;
- React state;
- source selection sets;
- cancellation or run reset;
- ingestion requests;
- graph coordinates or SVG rendering;
- timeline copy or CSS status classes.

### Research run module

`DeepResearch.tsx` remains the owner of the ephemeral run lifecycle. It appends received events, invokes the projection, applies source-discovery facts to user selection state, and sends user actions to the existing adapters. It no longer casts raw event payloads for brief/sketch/source handling.

The run module retains:

- `RunState` transitions;
- run IDs and stale-event rejection;
- `AbortController` cancellation;
- source selection and deselection memory;
- terminal source reconciliation;
- ingestion state and outcomes.

### Graph adapter

`ExecutionGraph.tsx` retains its SVG layout, loop geometry, keyboard controls, and accessible text representation. It consumes normalized facts and does not inspect raw event types or pair parent IDs.

### Timeline adapter

`ObservabilityTimeline.tsx` retains chronological rendering and existing status/detail presentation. It consumes normalized facts and does not independently reconstruct tool, supervisor, or scoring lifecycle.

## Dependency and seam strategy

This is an in-process module: the input is in-memory trace data and the output is an in-memory semantic model. No adapter is needed for the projection itself.

The external seam remains the existing frontend trace interface. The graph and timeline are two real adapters over the projection because they already consume the same event stream for different presentations. Their implementations may remain internally composed; raw event interpretation must not leak through their interface.

No sidecar adapter or new network port is justified. The existing wire contract is retained.

## Implementation sequence

1. Add `trace-model.ts` with the pure projection and normalized fact types.
2. Add deterministic trace fixtures covering brief aliases, two iterations, paired tools, failures, unmatched events, source discovery, scoring, terminal partial results, and unknown events.
3. Refactor `ExecutionGraph.tsx` to consume normalized facts; delete its event branching and completion map.
4. Refactor `ObservabilityTimeline.tsx` to consume the same normalized facts; delete its event branching and completion map.
5. Update `DeepResearch.tsx` to use the projection for event-derived brief/sketch/source facts and to append one complete local terminal fact without consuming `result.trace`.
6. Remove duplicate lifecycle/data types only when no caller remains; do not broaden the change into the run-lifecycle candidate.
7. Update the lightweight frontend checks to assert the new seam and absence of duplicate raw-event interpretation.
8. Run the focused projection tests, Deep Research checks, lint, build, and diff validation.

Do not layer the new projection beside the old interpretation. The old event branches and parent maps are deleted after each adapter consumes the new fact model.

## Acceptance criteria

- [ ] `projectTrace` is a pure feature-local module with no I/O, React state, or network dependency.
- [ ] Graph and timeline modules consume normalized facts and contain no raw event-type dispatch for the supported event families.
- [ ] Parent pairing occurs only in the projection module.
- [ ] Tool starts/completions, supervisor evaluation/status, and scoring start/rank events fold into one semantic fact each.
- [ ] Input order is preserved; timestamp sorting is absent.
- [ ] Snake_case and camelCase sketch aliases produce the same normalized fact.
- [ ] Unknown event types are preserved without throwing.
- [ ] Unmatched parent-linked events remain observable and do not attach to an inferred caller.
- [ ] Source discovery facts remain available to source-selection logic without adding new visual nodes.
- [ ] Partial terminal results remain completed trace facts with metadata.
- [ ] Cancellation still clears the run and creates no retained synthetic trace event.
- [ ] The existing graph layout, timeline accessibility, source selection, cancellation, and ingestion behavior remain intact.
- [ ] No sidecar file, SSE wire field, package dependency, or global state store is added.

## Testing decisions

The primary test surface is the projection interface. Tests should assert observable normalized facts and invariants, not private maps, helper functions, SVG coordinates, or exact implementation file structure.

Add a focused fixture runner following the existing `app/test-rag-runtime.mjs` convention:

```text
cd app && npx tsx test-research-trace.mjs
```

Do not add `tsx` to `package.json`; the repository already uses the `npx tsx` pattern for TypeScript runtime checks.

The fixtures must cover:

1. A brief/sketch event using snake_case fields.
2. The same brief/sketch using camelCase aliases.
3. Two supervisor/tool iterations with source discoveries and scoring.
4. A completed tool, failed tool, running tool, and unmatched completion.
5. Supervisor continuation and supervisor completion decisions.
6. Scoring start without ranking and scoring with ranking.
7. A partial terminal `done` fact.
8. An unknown event that survives projection without an exception.
9. Arrival order preservation despite parent-linked events being non-adjacent.
10. No cancellation fact being synthesized by the projection.

Update `app/test-deep-research-frontend.mjs` only for integration-level assertions: the graph and timeline import/consume the projection, and duplicate event interpretation is absent. Keep the existing shell, accessibility, and visual-constraint checks.

Required verification:

```text
cd app && npx tsx test-research-trace.mjs
cd app && node test-deep-research-frontend.mjs
cd app && npx eslint app/components/deep-research/trace-model.ts app/components/deep-research/DeepResearch.tsx app/components/deep-research/ExecutionGraph.tsx app/components/deep-research/ObservabilityTimeline.tsx
cd app && npm run build
git diff --check
```

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Folding events changes timeline detail | Preserve all observable fields in the fact and keep the existing timeline information; only remove duplicate raw interpretation. |
| Unknown events hide useful information | Retain unknown facts with original type/payload metadata; adapters may ignore them without dropping them from the projection. |
| Terminal `result.trace` causes duplicate nodes | Use live events plus one local `done` fact; never merge the terminal trace array. |
| Source selection regresses | Keep selection state in the run module and test source-discovery facts separately from user deselection behavior. |
| A broad shared library emerges prematurely | Keep the seam feature-local until a second real caller exists. |
| Static checks overfit old implementation names | Add direct fixture tests at the projection interface and use static checks only for wiring and accessibility. |

## ADR status

No existing ADR in the inspected path conflicts with this proposal. No ADR is needed yet: this is an in-process refactor with a reversible seam and no external storage or wire decision.

## Further notes

The deletion test is positive. Removing the projection would force parent pairing, alias normalization, and lifecycle interpretation back into the graph, timeline, and run controller. That concentration of complexity is the leverage case for this module.
