import { ResearchTraceProjection, TraceFact, ToolInvocationFact, SourceDiscoveryFact } from './trace-model';
import { QueryPlan } from '@/app/lib/research-contracts';
import { canonicalSourceKey } from './research-state';

/**
 * Derive the semantic route for the Deep Research trace surface.
 *
 * Pure and in-process: consumes the normalized trace projection plus
 * ephemeral lifecycle state and returns ordered route nodes. It owns no
 * React state, no I/O, and no SVG geometry.
 */

export type RunState = 'starting' | 'researching' | 'completed' | 'failed' | 'ingesting' | 'ingested';
export type IngestRunState = 'idle' | 'importing' | 'imported' | 'failed';

export type MilestoneStatus = 'pending' | 'created';
export type BatchStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface MilestoneNode {
  kind: 'milestone';
  id: 'milestone';
  brief: MilestoneStatus;
  sketch: MilestoneStatus;
}

export interface BatchNode {
  kind: 'batch';
  id: string;
  query: string;
  tool?: string;
  status: BatchStatus;
  /** Canonical URLs first discovered by this batch in arrival order. */
  newCount: number;
  /** Executed but returned no sources. */
  zero: boolean;
  error?: string;
  /** Seeded from the brief plan rather than a live tool event. */
  planned: boolean;
}

export interface CheckpointNode {
  kind: 'checkpoint';
  id: string;
  iteration: number;
  status: 'running' | 'completed';
  decision?: string;
  reason?: string;
  batches: readonly BatchNode[];
  /** Seeded ahead of the first supervisor event for the iteration. */
  virtual: boolean;
}

export interface RankedNode {
  kind: 'ranked';
  id: 'ranked';
  status: 'pending' | 'running' | 'completed';
}

export type IngestStatus = 'locked' | 'ready' | 'importing' | 'imported' | 'import-failed';

export interface IngestNode {
  kind: 'ingest';
  id: 'ingest';
  status: IngestStatus;
}

export type TraceRouteNode = MilestoneNode | CheckpointNode | RankedNode | IngestNode;

export interface TraceRoute {
  /** Process order: milestone, checkpoints, ranked, ingest. */
  readonly nodes: readonly TraceRouteNode[];
  readonly milestone: MilestoneNode;
  readonly ranked: RankedNode;
  readonly ingest: IngestNode;
}

export interface TraceRouteInput {
  projection: ResearchTraceProjection;
  runState: RunState;
  ingestState: IngestRunState;
}

export function buildTraceRoute({ projection, runState, ingestState }: TraceRouteInput): TraceRoute {
  const planQueries = planQueriesFrom(projection.brief?.queries);
  const checkpoints = buildCheckpoints(projection.facts, planQueries);
  const milestone: MilestoneNode = {
    kind: 'milestone',
    id: 'milestone',
    brief: projection.brief ? 'created' : 'pending',
    sketch: projection.sketch ? 'created' : 'pending',
  };
  const ranked = buildRanked(projection.facts);
  const ingest: IngestNode = {
    kind: 'ingest',
    id: 'ingest',
    status: buildIngestStatus(runState, ingestState),
  };

  return {
    nodes: [milestone, ...checkpoints, ranked, ingest],
    milestone,
    ranked,
    ingest,
  };
}

function planQueriesFrom(queries: QueryPlan | undefined): string[] {
  if (!queries) return [];
  return [...new Set([...(queries.overview ?? []), ...(queries.specific ?? [])])];
}

function buildCheckpoints(
  facts: readonly TraceFact[],
  planQueries: readonly string[],
): CheckpointNode[] {
  const byIteration = new Map<number, CheckpointNode>();
  const toolFacts: ToolInvocationFact[] = [];
  const discoveryFacts: SourceDiscoveryFact[] = [];

  for (const fact of facts) {
    if (fact.kind === 'supervisor_iteration') {
      const iteration = fact.iteration ?? 0;
      const existing = byIteration.get(iteration);
      byIteration.set(iteration, {
        kind: 'checkpoint',
        id: fact.id,
        iteration,
        status: fact.status === 'running' ? 'running' : 'completed',
        decision: fact.decision || undefined,
        reason: fact.reason || undefined,
        batches: existing?.batches ?? [],
        virtual: false,
      });
    } else if (fact.kind === 'tool_invocation') {
      toolFacts.push(fact);
    } else if (fact.kind === 'source_discovery') {
      discoveryFacts.push(fact);
    }
  }

  // Seed a virtual checkpoint for the plan when no supervisor event exists yet.
  if (planQueries.length > 0 && !byIteration.has(0)) {
    byIteration.set(0, virtualCheckpoint(0));
  }

  // Seed pending plan nodes first so planned queries keep stable positions;
  // tool events then resolve those nodes in place and newly introduced
  // queries append without reordering existing history.
  for (const checkpoint of byIteration.values()) {
    if (!checkpoint.virtual && checkpoint.status !== 'running') continue;
    for (const query of planQueries) {
      (checkpoint.batches as BatchNode[]).push({
        kind: 'batch',
        id: `batch-${checkpoint.iteration}:${query}`,
        query,
        tool: undefined,
        status: 'pending',
        newCount: 0,
        zero: false,
        planned: true,
      });
    }
  }

  for (const fact of toolFacts) {
    const iteration = fact.iteration ?? 0;
    const checkpoint = byIteration.get(iteration) ?? createVirtual(byIteration, iteration);
    for (const query of fact.queries.length > 0 ? fact.queries : [fact.query ?? '']) {
      const id = `batch-${iteration}:${query}`;
      let batch = checkpoint.batches.find((item) => item.id === id);
      if (!batch) {
        batch = {
          kind: 'batch',
          id,
          query,
          tool: fact.tool,
          status: 'pending',
          newCount: 0,
          zero: false,
          planned: false,
        };
        (checkpoint.batches as BatchNode[]).push(batch);
      }
      batch.tool = batch.tool ?? fact.tool;
      batch.status = fact.status;
      batch.error = fact.status === 'failed' ? fact.error : undefined;
    }
  }

  // Attribute newly discovered canonical URLs to their owning batch,
  // counting each canonical URL once across the whole run.
  const seen = new Set<string>();
  const byToolId = new Map<string, BatchNode[]>();
  for (const fact of toolFacts) {
    const iteration = fact.iteration ?? 0;
    const checkpoint = byIteration.get(iteration);
    if (!checkpoint) continue;
    const batches = checkpoint.batches.filter((batch) => !batch.planned || fact.queries.includes(batch.query));
    byToolId.set(fact.id, batches.length > 0 ? batches : [...checkpoint.batches]);
  }
  for (const fact of discoveryFacts) {
    if (!fact.parentId) continue;
    const owner = byToolId.get(fact.parentId);
    if (!owner) continue;
    let added = 0;
    for (const source of fact.sources) {
      const key = canonicalSourceKey(source.url);
      if (seen.has(key)) continue;
      seen.add(key);
      added += 1;
    }
    if (added === 0) continue;
    const target = owner.find((batch) => batch.query === fact.query) ?? owner[0];
    if (target) target.newCount += added;
  }

  // Zero-result batches: executed without any discovered sources.
  for (const checkpoint of byIteration.values()) {
    for (const batch of checkpoint.batches) {
      if (batch.status === 'completed' && batch.newCount === 0) batch.zero = true;
    }
  }

  return [...byIteration.values()];
}

function virtualCheckpoint(iteration: number): CheckpointNode {
  return {
    kind: 'checkpoint',
    id: `virtual-${iteration}`,
    iteration,
    status: 'running',
    batches: [],
    virtual: true,
  };
}

function createVirtual(byIteration: Map<number, CheckpointNode>, iteration: number): CheckpointNode {
  const checkpoint = virtualCheckpoint(iteration);
  byIteration.set(iteration, checkpoint);
  return checkpoint;
}

function buildRanked(facts: readonly TraceFact[]): RankedNode {
  const scoring = [...facts].reverse().find((fact) => fact.kind === 'scoring');
  const done = facts.some((fact) => fact.kind === 'done');
  if (scoring?.rankingCompleted || done) return { kind: 'ranked', id: 'ranked', status: 'completed' };
  if (scoring) return { kind: 'ranked', id: 'ranked', status: 'running' };
  return { kind: 'ranked', id: 'ranked', status: 'pending' };
}

function buildIngestStatus(runState: RunState, ingestState: IngestRunState): IngestStatus {
  if (runState === 'starting' || runState === 'researching' || runState === 'failed') return 'locked';
  if (runState === 'ingesting') return 'importing';
  if (runState === 'ingested') return 'imported';
  // completed: ranking produced the final deduplicated list
  if (ingestState === 'importing') return 'importing';
  if (ingestState === 'imported') return 'imported';
  if (ingestState === 'failed') return 'import-failed';
  return 'ready';
}
