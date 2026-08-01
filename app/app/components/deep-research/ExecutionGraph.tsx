'use client';

import { useMemo } from 'react';
import { TraceEvent } from '@/app/lib/research-contracts';
import styles from './deep-research.module.css';

type RunState = 'starting' | 'researching' | 'completed' | 'failed' | 'ingesting' | 'ingested';
type RouteStatus = 'active' | 'completed' | 'failed' | 'upcoming';
type RouteKind = 'brief' | 'supervisor' | 'tool' | 'checkpoint' | 'scoring' | 'complete' | 'error';

interface ExecutionGraphProps {
  trace: TraceEvent[];
  isResearching: boolean;
  runState?: RunState;
  sourceCount?: number;
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
}

interface RouteNode {
  id: string;
  label: string;
  summary: string;
  status: RouteStatus;
  kind: RouteKind;
  event: TraceEvent;
  completion?: TraceEvent;
  loopLabel?: string;
}

interface RouteStage {
  id: string;
  label: string;
  detail: string;
  status: RouteStatus;
}

const statusLabels: Record<RouteStatus, string> = {
  active: 'Now',
  completed: 'Complete',
  failed: 'Failed',
  upcoming: 'Upcoming',
};

const kindLabels: Record<RouteKind, string> = {
  brief: 'Brief',
  supervisor: 'Supervisor',
  tool: 'Search',
  checkpoint: 'Iteration',
  scoring: 'Scoring',
  complete: 'Completion',
  error: 'Failure',
};

export function ExecutionGraph({
  trace,
  isResearching,
  runState = isResearching ? 'researching' : 'completed',
  sourceCount = 0,
  selectedNodeId,
  onNodeSelect,
}: ExecutionGraphProps) {
  const { nodes, stages } = useMemo(
    () => buildRoute(trace, runState, sourceCount),
    [trace, runState, sourceCount],
  );
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null;

  return (
    <div className={styles.graphContainer}>
      <div className={styles.routeMapIntro}>
        <div>
          <span className={styles.routeEyebrow}>Live path / events</span>
          <h3 className={styles.routeMapTitle}>From brief to evidence.</h3>
        </div>
        <p className={styles.routeMapDescription}>
          Each stop is an event from this run. Select one to inspect what moved the route.
        </p>
      </div>

      <ol className={styles.routeStages} aria-label="Research route stages">
        {stages.map((stage, index) => (
          <li key={stage.id} className={`${styles.routeStage} ${styles[`routeStage-${stage.status}`]}`}>
            <span className={styles.routeStageNumber}>{String(index + 1).padStart(2, '0')}</span>
            <span className={styles.routeStageCopy}>
              <strong>{stage.label}</strong>
              <small>{stage.detail}</small>
            </span>
            <span className={styles.routeStageStatus}>{statusLabels[stage.status]}</span>
          </li>
        ))}
      </ol>

      {nodes.length === 0 ? (
        <div className={styles.routeEmpty} role="status">
          <strong>{runState === 'starting' ? 'Preparing the brief.' : 'No route events yet.'}</strong>
          <span>
            {runState === 'starting'
              ? 'The first event will appear here as soon as the research stream opens.'
              : runState === 'failed'
                ? 'The research stream ended before it produced a trace.'
                : 'Waiting for the research stream to report its first event.'}
          </span>
        </div>
      ) : (
        <ol className={styles.routeList} aria-label="Event-derived execution route">
          {nodes.map((node, index) => {
            const selected = selectedNodeId === node.id;
            return (
              <li key={node.id} className={`${styles.routeItem} ${styles[`routeItem-${node.kind}`]}`}>
                {node.loopLabel && (
                  <div className={styles.routeLoop} aria-label={`${node.loopLabel}, iteration ${(node.event.iteration ?? 0) + 1}`}>
                    <span aria-hidden="true">↩</span>
                    <span>{node.loopLabel} · iteration {String((node.event.iteration ?? 0) + 1).padStart(2, '0')}</span>
                  </div>
                )}
                <button
                  type="button"
                  className={`${styles.routeNode} ${styles[`routeNode-${node.status}`]} ${selected ? styles.routeNodeSelected : ''}`}
                  onClick={() => onNodeSelect(selected ? null : node.id)}
                  aria-pressed={selected}
                  aria-current={selected ? 'step' : undefined}
                  aria-label={`${node.label}: ${statusLabels[node.status]}. ${node.summary}`}
                >
                  <span className={styles.routeNodeMarker} aria-hidden="true">
                    <span>{node.status === 'completed' ? '✓' : node.status === 'failed' ? '!' : node.status === 'active' ? '•' : '○'}</span>
                  </span>
                  <span className={styles.routeNodeCopy}>
                    <span className={styles.routeNodeMeta}>
                      {String(index + 1).padStart(2, '0')} / {kindLabels[node.kind]}
                      {node.event.iteration !== undefined ? ` · pass ${node.event.iteration + 1}` : ''}
                    </span>
                    <strong>{node.label}</strong>
                    <small>{node.summary}</small>
                  </span>
                  <span className={styles.routeNodeStatus}>{statusLabels[node.status]}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {selectedNode && (
        <RouteDetail node={selectedNode} />
      )}

      <p className={styles.routeTextSummary} aria-live="polite">
        {nodes.length > 0
          ? `${nodes.length} event${nodes.length === 1 ? '' : 's'} mapped. Completed stops remain visible while the route continues.`
          : 'The event-derived route is empty.'}
      </p>
    </div>
  );
}

function RouteDetail({ node }: { node: RouteNode }) {
  const details = getNodeDetails(node);

  return (
    <section className={styles.routeDetail} aria-label="Selected route detail" aria-live="polite">
      <div className={styles.routeDetailCopy}>
        <span className={styles.routeEyebrow}>Selected event</span>
        <h3>{node.label}</h3>
        <p>{node.summary}</p>
      </div>
      <dl className={styles.routeDetailList}>
        {details.map((detail) => (
          <div key={detail.label}>
            <dt>{detail.label}</dt>
            <dd>{detail.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function getNodeDetails(node: RouteNode): Array<{ label: string; value: string }> {
  const payload = node.event.payload || {};
  const details: Array<{ label: string; value: string }> = [
    { label: 'Status', value: statusLabels[node.status] },
  ];

  if (node.event.iteration !== undefined) {
    details.push({ label: 'Iteration', value: String(node.event.iteration + 1) });
  }

  const tool = asText(payload.tool);
  if (tool) details.push({ label: 'Tool', value: tool });

  const query = formatQuery(payload.query ?? payload.queries);
  if (query) details.push({ label: 'Query', value: query });

  const duration = formatDuration(node.completion?.payload.duration ?? payload.duration);
  if (duration) details.push({ label: 'Duration', value: duration });

  const resultCount = formatCount(
    node.completion?.payload.result_count
      ?? payload.result_count
      ?? payload.source_count
      ?? payload.total_sources,
  );
  if (resultCount) details.push({ label: 'Results', value: resultCount });

  return details;
}

function buildRoute(trace: TraceEvent[], runState: RunState, sourceCount: number): { nodes: RouteNode[]; stages: RouteStage[] } {
  const nodes: RouteNode[] = [];
  const completionByParent = new Map<string, TraceEvent>();
  const toolStartedIds = new Set<string>();
  const supervisorIterations = new Set<number>();
  const loopEdge = { label: 'continue' as const };

  for (const event of trace) {
    if ((event.type === 'tool_completed' || event.type === 'tool_failed') && event.parent_id) {
      completionByParent.set(event.parent_id, event);
    }
    if (event.type === 'tool_started') toolStartedIds.add(event.id);
    if (event.type === 'supervisor_evaluation' && event.iteration !== undefined) {
      supervisorIterations.add(event.iteration);
    }
  }

  const addNode = (node: RouteNode) => {
    const previous = nodes[nodes.length - 1];
    if (
      previous
      && node.kind === 'supervisor'
      && node.event.iteration !== undefined
      && previous.event.iteration !== undefined
      && node.event.iteration > previous.event.iteration
    ) {
      node.loopLabel = loopEdge.label;
    }
    nodes.push(node);
  };

  for (const event of trace) {
    const payload = event.payload || {};
    const iteration = event.iteration;

    if (event.type === 'brief_generated') {
      addNode({
        id: event.id,
        label: 'Brief generated',
        summary: asText(payload.brief) || 'Question scoped into a research brief and sketch.',
        status: 'completed',
        kind: 'brief',
        event,
      });
    } else if (event.type === 'supervisor_evaluation') {
      addNode({
        id: event.id,
        label: `Supervisor / pass ${(iteration ?? 0) + 1}`,
        summary: supervisorSummary(payload),
        status: 'completed',
        kind: 'supervisor',
        event,
      });
    } else if ((event.type === 'supervisor_started' || event.type === 'supervisor_completed') && !supervisorIterations.has(iteration ?? -1)) {
      addNode({
        id: event.id,
        label: `Supervisor / pass ${(iteration ?? 0) + 1}`,
        summary: supervisorSummary(payload),
        status: event.type === 'supervisor_started' ? 'active' : 'completed',
        kind: 'supervisor',
        event,
      });
    } else if (event.type === 'tool_started') {
      const completion = completionByParent.get(event.id);
      const status = completion?.type;
      const routeStatus: RouteStatus = status === 'tool_failed'
        ? 'failed'
        : completion
          ? 'completed'
          : 'active';
      addNode({
        id: event.id,
        label: `${asText(payload.tool) || 'Tool'} search`,
        summary: toolSummary(payload, completion),
        status: routeStatus,
        kind: 'tool',
        event,
        completion,
      });
    } else if ((event.type === 'tool_completed' || event.type === 'tool_failed') && !toolStartedIds.has(event.parent_id || '')) {
      addNode({
        id: event.id,
        label: `${asText(payload.tool) || 'Tool'} ${event.type === 'tool_failed' ? 'failed' : 'completed'}`,
        summary: event.type === 'tool_failed' ? asText(payload.error) || 'The tool returned an error.' : toolSummary(payload),
        status: event.type === 'tool_failed' ? 'failed' : 'completed',
        kind: event.type === 'tool_failed' ? 'error' : 'tool',
        event,
      });
    } else if (event.type === 'iteration_complete') {
      addNode({
        id: event.id,
        label: `Iteration ${(iteration ?? 0) + 1} / gap check`,
        summary: `${formatCount(payload.total_sources) || 'No'} sources accumulated before the next supervisor pass.`,
        status: 'completed',
        kind: 'checkpoint',
        event,
      });
    } else if (event.type === 'scoring_started') {
      const hasTerminalEvent = trace.some((candidate) => candidate.type === 'sources_ranked' || candidate.type === 'done');
      addNode({
        id: event.id,
        label: 'Score and reconcile',
        summary: 'Ranking the evidence set and removing duplicate sources.',
        status: runState === 'researching' && !hasTerminalEvent ? 'active' : 'completed',
        kind: 'scoring',
        event,
      });
    } else if (event.type === 'sources_ranked') {
      addNode({
        id: event.id,
        label: 'Evidence ranked',
        summary: `${formatCount(payload.total_sources) || 'No'} sources remain after scoring.`,
        status: 'completed',
        kind: 'scoring',
        event,
      });
    } else if (event.type === 'done') {
      addNode({
        id: event.id,
        label: 'Research complete',
        summary: `${formatCount(payload.source_count) || String(sourceCount)} ranked sources are ready to review.`,
        status: 'completed',
        kind: 'complete',
        event,
      });
    } else if (event.type === 'error') {
      addNode({
        id: event.id,
        label: 'Research failed',
        summary: asText(payload.message) || asText(payload.error) || 'The route ended with an error.',
        status: 'failed',
        kind: 'error',
        event,
      });
    }
  }

  return { nodes, stages: buildStages(trace, runState, sourceCount) };
}

function buildStages(trace: TraceEvent[], runState: RunState, sourceCount: number): RouteStage[] {
  const hasBrief = trace.some((event) => event.type === 'brief_generated');
  const hasTrace = trace.some((event) => ['supervisor_evaluation', 'tool_started', 'iteration_complete'].includes(event.type));
  const hasFailure = runState === 'failed' || trace.some((event) => event.type === 'error');
  const researchFinished = runState === 'completed' || runState === 'ingesting' || runState === 'ingested';

  return [
    {
      id: 'brief',
      label: 'Brief',
      detail: hasBrief ? 'Question scoped' : runState === 'starting' ? 'Preparing' : 'Waiting',
      status: hasBrief ? 'completed' : runState === 'starting' ? 'active' : 'upcoming',
    },
    {
      id: 'trace',
      label: 'Search / trace',
      detail: hasFailure ? 'Route interrupted' : hasTrace && researchFinished ? 'Route recorded' : hasTrace ? 'Following events' : 'Waiting for search',
      status: hasFailure ? 'failed' : hasTrace && researchFinished ? 'completed' : hasTrace ? 'active' : 'upcoming',
    },
    {
      id: 'evidence',
      label: 'Evidence',
      detail: sourceCount > 0 ? `${sourceCount} source${sourceCount === 1 ? '' : 's'} to review` : researchFinished ? 'No sources returned' : 'Sources will appear here',
      status: sourceCount > 0 && researchFinished ? 'active' : sourceCount > 0 ? 'active' : researchFinished ? 'completed' : 'upcoming',
    },
  ];
}

function supervisorSummary(payload: Record<string, unknown>): string {
  const decision = asText(payload.decision);
  const reason = asText(payload.reason);
  const confidence = payload.confidence_score;
  const confidenceText = typeof confidence === 'number' ? `Confidence ${confidence}%` : '';
  return [decision, reason, confidenceText].filter(Boolean).join(' · ') || 'Evaluating whether the evidence covers the brief.';
}

function toolSummary(payload: Record<string, unknown>, completion?: TraceEvent): string {
  const query = formatQuery(payload.query ?? payload.queries);
  const resultCount = formatCount(completion?.payload.result_count ?? payload.result_count);
  const duration = formatDuration(completion?.payload.duration ?? payload.duration);
  const outcome = [resultCount && `${resultCount} results`, duration && duration].filter(Boolean).join(' · ');
  return [query && `Query: ${query}`, outcome || 'Waiting for results.'].filter(Boolean).join(' · ');
}

function formatQuery(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').join(' · ');
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .flatMap((item) => Array.isArray(item) ? item : [item])
      .filter((item): item is string => typeof item === 'string')
      .join(' · ');
  }
  return '';
}

function formatDuration(value: unknown): string {
  if (typeof value === 'number') return `${value}s`;
  if (typeof value === 'string' && value) return value;
  return '';
}

function formatCount(value: unknown): string {
  return typeof value === 'number' ? String(value) : typeof value === 'string' ? value : '';
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
