'use client';

import { useMemo } from 'react';
import { ResearchTraceProjection, TraceFact } from './trace-model';
import styles from './deep-research.module.css';

type RunState = 'starting' | 'researching' | 'completed' | 'failed' | 'ingesting' | 'ingested';
type RouteStatus = 'active' | 'completed' | 'failed' | 'upcoming';
type RouteKind = 'brief' | 'supervisor' | 'tool' | 'checkpoint' | 'scoring' | 'complete' | 'error';

interface ExecutionGraphProps {
  projection: ResearchTraceProjection;
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
  fact: TraceFact;
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
  projection,
  isResearching,
  runState = isResearching ? 'researching' : 'completed',
  sourceCount = 0,
  selectedNodeId,
  onNodeSelect,
}: ExecutionGraphProps) {
  const { nodes, stages } = useMemo(
    () => buildRoute(projection.facts, runState, sourceCount),
    [projection.facts, runState, sourceCount],
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
                  <div className={styles.routeLoop} aria-label={`${node.loopLabel}, iteration ${(node.fact.iteration ?? 0) + 1}`}>
                    <span aria-hidden="true">↩</span>
                    <span>{node.loopLabel} · iteration {String((node.fact.iteration ?? 0) + 1).padStart(2, '0')}</span>
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
                      {node.fact.iteration !== undefined ? ` · pass ${node.fact.iteration + 1}` : ''}
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

      {selectedNode && <RouteDetail node={selectedNode} />}

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
  const details: Array<{ label: string; value: string }> = [
    { label: 'Status', value: statusLabels[node.status] },
  ];
  const fact = node.fact;

  if (fact.iteration !== undefined) {
    details.push({ label: 'Iteration', value: String(fact.iteration + 1) });
  }

  if (fact.kind === 'tool_invocation') {
    if (fact.tool) details.push({ label: 'Tool', value: fact.tool });
    const query = fact.query || fact.queries.join(' · ');
    if (query) details.push({ label: 'Query', value: query });
    if (fact.duration !== undefined) details.push({ label: 'Duration', value: formatDuration(fact.duration) });
    if (fact.resultCount !== undefined) details.push({ label: 'Results', value: formatCount(fact.resultCount) });
    if (fact.error) details.push({ label: 'Error', value: fact.error });
  } else if (fact.kind === 'supervisor_iteration') {
    if (fact.decision) details.push({ label: 'Decision', value: fact.decision });
    if (fact.confidenceScore !== undefined) details.push({ label: 'Confidence', value: `${fact.confidenceScore}%` });
    if (fact.reason) details.push({ label: 'Reason', value: fact.reason });
  } else if (fact.kind === 'iteration') {
    if (fact.totalSources !== undefined) details.push({ label: 'Sources', value: formatCount(fact.totalSources) });
    if (fact.newSources !== undefined) details.push({ label: 'New sources', value: formatCount(fact.newSources) });
  } else if (fact.kind === 'source_discovery') {
    details.push({ label: 'Sources', value: String(fact.sources.length) });
    if (fact.tool) details.push({ label: 'Tool', value: fact.tool });
    if (fact.query) details.push({ label: 'Query', value: fact.query });
  } else if (fact.kind === 'scoring') {
    if (fact.sourceCount !== undefined) details.push({ label: 'Sources', value: formatCount(fact.sourceCount) });
    if (fact.topScore !== undefined) details.push({ label: 'Top score', value: String(fact.topScore) });
  } else if (fact.kind === 'done') {
    if (fact.sourceCount !== undefined) details.push({ label: 'Sources', value: formatCount(fact.sourceCount) });
    if (fact.partial) details.push({ label: 'Result', value: `Partial${fact.timeoutPhase ? ` · ${fact.timeoutPhase}` : ''}` });
  } else if (fact.kind === 'error') {
    details.push({ label: 'Message', value: fact.message });
  }

  return details;
}

function buildRoute(facts: readonly TraceFact[], runState: RunState, sourceCount: number): { nodes: RouteNode[]; stages: RouteStage[] } {
  const nodes: RouteNode[] = [];

  const addNode = (node: RouteNode) => {
    const previous = nodes[nodes.length - 1];
    if (
      previous
      && node.kind === 'supervisor'
      && node.fact.iteration !== undefined
      && previous.fact.iteration !== undefined
      && node.fact.iteration > previous.fact.iteration
    ) {
      node.loopLabel = 'continue';
    }
    nodes.push(node);
  };

  for (const fact of facts) {
    switch (fact.kind) {
      case 'brief':
        addNode({
          id: fact.id,
          label: 'Brief generated',
          summary: fact.brief || 'Question scoped into a research brief and sketch.',
          status: 'completed',
          kind: 'brief',
          fact,
        });
        break;
      case 'supervisor_iteration':
        addNode({
          id: fact.id,
          label: `Supervisor / pass ${(fact.iteration ?? 0) + 1}`,
          summary: supervisorSummary(fact),
          status: factStatus(fact.status),
          kind: 'supervisor',
          fact,
        });
        break;
      case 'tool_invocation':
        addNode({
          id: fact.id,
          label: `${fact.tool || 'Tool'} search`,
          summary: toolSummary(fact),
          status: factStatus(fact.status),
          kind: 'tool',
          fact,
        });
        break;
      case 'iteration':
        addNode({
          id: fact.id,
          label: `Iteration ${(fact.iteration ?? 0) + 1} / gap check`,
          summary: `${formatCount(fact.totalSources) || 'No'} sources accumulated before the next supervisor pass.`,
          status: 'completed',
          kind: 'checkpoint',
          fact,
        });
        break;
      case 'scoring':
        addNode({
          id: fact.id,
          label: fact.rankingCompleted ? 'Evidence ranked' : 'Score and reconcile',
          summary: fact.rankingCompleted
            ? `${formatCount(fact.sourceCount) || 'No'} sources remain after scoring.`
            : 'Ranking the evidence set and removing duplicate sources.',
          status: factStatus(fact.status),
          kind: 'scoring',
          fact,
        });
        break;
      case 'done':
        addNode({
          id: fact.id,
          label: 'Research complete',
          summary: `${formatCount(fact.sourceCount) || String(sourceCount)} ranked sources are ready to review${fact.partial ? ' · partial result' : ''}.`,
          status: 'completed',
          kind: 'complete',
          fact,
        });
        break;
      case 'error':
        addNode({
          id: fact.id,
          label: 'Research failed',
          summary: fact.message,
          status: 'failed',
          kind: 'error',
          fact,
        });
        break;
      case 'source_discovery':
      case 'unknown':
        break;
    }
  }

  return { nodes, stages: buildStages(facts, runState, sourceCount) };
}

function buildStages(facts: readonly TraceFact[], runState: RunState, sourceCount: number): RouteStage[] {
  const hasBrief = facts.some((fact) => fact.kind === 'brief');
  const hasTrace = facts.some((fact) => ['supervisor_iteration', 'tool_invocation', 'iteration'].includes(fact.kind));
  const hasFailure = runState === 'failed' || facts.some((fact) => fact.kind === 'error');
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

function supervisorSummary(fact: Extract<TraceFact, { kind: 'supervisor_iteration' }>): string {
  const confidence = fact.confidenceScore !== undefined ? `Confidence ${fact.confidenceScore}%` : '';
  return [fact.decision, fact.reason, confidence].filter(Boolean).join(' · ') || 'Evaluating whether the evidence covers the brief.';
}

function toolSummary(fact: Extract<TraceFact, { kind: 'tool_invocation' }>): string {
  const query = fact.query || fact.queries.join(' · ');
  const resultCount = formatCount(fact.resultCount);
  const duration = fact.duration === undefined ? '' : formatDuration(fact.duration);
  const outcome = [resultCount && `${resultCount} results`, duration].filter(Boolean).join(' · ');
  const error = fact.error ? `Error: ${fact.error}` : '';
  return [query && `Query: ${query}`, error || outcome || (fact.status === 'running' ? 'Waiting for results.' : 'Tool returned.')].filter(Boolean).join(' · ');
}

function factStatus(status: 'running' | 'completed' | 'failed'): RouteStatus {
  return status === 'running' ? 'active' : status;
}

function formatDuration(value: number | string): string {
  return typeof value === 'number' ? `${value}s` : value;
}

function formatCount(value: number | string | undefined): string {
  return value === undefined ? '' : String(value);
}
