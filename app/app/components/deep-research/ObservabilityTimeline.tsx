'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ResearchTraceProjection, TraceFact } from './trace-model';
import styles from './deep-research.module.css';

interface ObservabilityTimelineProps {
  projection: ResearchTraceProjection;
  isResearching: boolean;
  focusedNodeId: string | null;
}

type TimelineStatus = 'completed' | 'running' | 'failed';

interface TimelineEntry {
  id: string;
  time: number;
  label: string;
  detail: string;
  status: TimelineStatus;
}

const statusLabels: Record<TimelineStatus, string> = {
  completed: 'Complete',
  running: 'Now',
  failed: 'Failed',
};

export function ObservabilityTimeline({ projection, isResearching, focusedNodeId }: ObservabilityTimelineProps) {
  const entries = useMemo(
    () => buildTimeline(projection.facts),
    [projection.facts],
  );
  const entryRefs = useRef(new Map<string, HTMLLIElement>());
  const firstTime = projection.facts[0]?.timestamp || 0;

  useEffect(() => {
    if (!focusedNodeId) return;
    entryRefs.current.get(focusedNodeId)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [focusedNodeId]);

  if (entries.length === 0) {
    return <div className={styles.timelineEmpty}>Waiting for the first route event.</div>;
  }

  return (
    <ol className={styles.timelineList} aria-live="polite">
      {entries.map((entry) => {
        const focused = focusedNodeId === entry.id;
        return (
          <li
            key={entry.id}
            id={`timeline-${entry.id}`}
            className={`${styles.timelineItem} ${styles[`timelineItem-${entry.status}`]} ${focused ? styles.timelineItemFocused : ''}`}
            aria-current={focused ? 'step' : undefined}
            ref={(element) => {
              if (element) entryRefs.current.set(entry.id, element);
              else entryRefs.current.delete(entry.id);
            }}
          >
            <span className={styles.timelineMarker} aria-hidden="true">{entry.status === 'completed' ? '✓' : entry.status === 'failed' ? '!' : '•'}</span>
            <div className={styles.timelineBody}>
              <div className={styles.timelineMeta}>
                <time>{formatTimelineTime(entry.time, firstTime)}</time>
                <span>{statusLabels[entry.status]}</span>
              </div>
              <strong className={styles.timelineLabel}>{entry.label}</strong>
              <span className={styles.timelineDetail}>{entry.detail}</span>
            </div>
          </li>
        );
      })}
      {isResearching && (
        <li className={`${styles.timelineItem} ${styles['timelineItem-running']}`}>
          <span className={styles.timelineMarker} aria-hidden="true">•</span>
          <div className={styles.timelineBody}>
            <div className={styles.timelineMeta}><span>Now</span><span>Active</span></div>
            <strong className={styles.timelineLabel}>Research in progress</strong>
            <span className={styles.timelineDetail}>Listening for the next event.</span>
          </div>
        </li>
      )}
    </ol>
  );
}

function buildTimeline(facts: readonly TraceFact[]): TimelineEntry[] {
  return facts.flatMap((fact) => {
    switch (fact.kind) {
      case 'brief':
        return [{
          id: fact.id,
          time: fact.timestamp,
          label: 'Brief generated',
          detail: fact.brief || 'Research scope defined.',
          status: 'completed',
        }];
      case 'supervisor_iteration':
        return [{
          id: fact.id,
          time: fact.timestamp,
          label: `Supervisor evaluation${iterationLabel(fact)}`,
          detail: supervisorDetail(fact),
          status: fact.status,
        }];
      case 'tool_invocation':
        return [{
          id: fact.id,
          time: fact.timestamp,
          label: `${fact.tool || 'Tool'} search${toolOutcome(fact)}${iterationLabel(fact)}`,
          detail: toolDetail(fact),
          status: fact.status,
        }];
      case 'source_discovery':
        return [{
          id: fact.id,
          time: fact.timestamp,
          label: `Evidence arrived${iterationLabel(fact)}`,
          detail: `${fact.sources.length} source${fact.sources.length === 1 ? '' : 's'} discovered from ${fact.tool || 'search'}${fact.query ? `\nQuery: ${fact.query}` : ''}.`,
          status: 'completed',
        }];
      case 'iteration':
        return [{
          id: fact.id,
          time: fact.timestamp,
          label: `Iteration ${fact.iteration !== undefined ? fact.iteration + 1 : ''} complete`,
          detail: `${formatCount(fact.totalSources) || 'No'} sources accumulated before the next decision.`,
          status: 'completed',
        }];
      case 'scoring':
        return [{
          id: fact.id,
          time: fact.timestamp,
          label: fact.rankingCompleted ? 'Evidence ranked' : 'Scoring started',
          detail: fact.rankingCompleted
            ? `${formatCount(fact.sourceCount) || 'No'} sources remain after scoring.`
            : `${formatCount(fact.sourceCount) || 'The'} sources are being ranked.`,
          status: fact.status,
        }];
      case 'done':
        return [{
          id: fact.id,
          time: fact.timestamp,
          label: 'Research complete',
          detail: `${formatCount(fact.sourceCount) || 'No'} ranked sources ready for review${fact.partial ? ' · partial result' : ''}.`,
          status: 'completed',
        }];
      case 'error':
        return [{
          id: fact.id,
          time: fact.timestamp,
          label: 'Route failed',
          detail: fact.message,
          status: 'failed',
        }];
      case 'unknown':
        return [];
    }
  });
}

function iterationLabel(fact: TraceFact): string {
  return fact.iteration !== undefined ? ` · pass ${fact.iteration + 1}` : '';
}

function supervisorDetail(fact: Extract<TraceFact, { kind: 'supervisor_iteration' }>): string {
  const confidence = fact.confidenceScore === undefined ? '' : `Confidence ${fact.confidenceScore}%`;
  const subQuestions = fact.subQuestions
    .map((question) => `${question.status}: ${question.question || 'sub-question'}`)
    .join('\n');
  return [confidence, fact.decision, fact.reason, fact.gapAnalysis && `Gap: ${fact.gapAnalysis}`, subQuestions]
    .filter(Boolean)
    .join('\n') || 'Evaluating the evidence against the brief.';
}

function toolOutcome(fact: Extract<TraceFact, { kind: 'tool_invocation' }>): string {
  return fact.status === 'failed' ? ' failed' : fact.status === 'completed' ? ' completed' : ' started';
}

function toolDetail(fact: Extract<TraceFact, { kind: 'tool_invocation' }>): string {
  const query = fact.query || fact.queries.join(' · ');
  const resultCount = formatCount(fact.resultCount);
  const duration = fact.duration === undefined
    ? ''
    : typeof fact.duration === 'number' ? `${fact.duration}s` : fact.duration;
  const error = fact.error ? `Error: ${fact.error}` : '';
  return [query && `Query: ${query}`, resultCount && `${resultCount} results`, duration && `${duration} duration`, error]
    .filter(Boolean)
    .join('\n') || (fact.status === 'running' ? 'Waiting for tool results.' : 'Tool returned.');
}

function formatTimelineTime(time: number, firstTime: number): string {
  const offset = time - firstTime;
  // ponytail: the sidecar and browser use different clocks; show no duration
  // rather than inventing one across that boundary.
  if (!Number.isFinite(offset) || offset < 0 || offset > 3600) return '—';
  return `+${Math.round(offset)}s`;
}

function formatCount(value: number | string | undefined): string {
  return value === undefined ? '' : String(value);
}
