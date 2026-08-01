'use client';

import { useMemo } from 'react';
import { TraceEvent, ResearchBrief } from '@/app/lib/research-contracts';
import styles from './deep-research.module.css';

interface ObservabilityTimelineProps {
  trace: TraceEvent[];
  brief: ResearchBrief | null;
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

export function ObservabilityTimeline({ trace, brief, isResearching, focusedNodeId }: ObservabilityTimelineProps) {
  const entries = useMemo(() => buildTimeline(trace, brief, isResearching), [trace, brief, isResearching]);
  const firstTime = trace[0]?.timestamp || 0;

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

function buildTimeline(trace: TraceEvent[], brief: ResearchBrief | null, isResearching: boolean): TimelineEntry[] {
  const items: TimelineEntry[] = [];
  const completionByParent = new Map(
    trace
      .filter((event) => (event.type === 'tool_completed' || event.type === 'tool_failed') && event.parent_id)
      .map((event) => [event.parent_id as string, event]),
  );
  const toolStarts = new Set(trace.filter((event) => event.type === 'tool_started').map((event) => event.id));
  const baseTime = trace[0]?.timestamp || 0;

  if (brief) {
    items.push({
      id: trace.find((event) => event.type === 'brief_generated')?.id || 'brief',
      time: baseTime,
      label: 'Brief generated',
      detail: brief.brief || 'Research scope defined.',
      status: 'completed',
    });
  }

  for (const event of trace) {
    const payload = event.payload || {};
    const iteration = event.iteration !== undefined ? ` · pass ${event.iteration + 1}` : '';

    if (event.type === 'brief_generated') {
      continue;
    }

    if (event.type === 'supervisor_started' || event.type === 'supervisor_evaluation') {
      const confidence = formatConfidence(payload.confidence_score);
      const reason = asText(payload.reason);
      const gaps = asText(payload.gap_analysis);
      const subQuestions = formatSubQuestions(payload.sub_questions);
      items.push({
        id: event.id,
        time: event.timestamp,
        label: `Supervisor evaluation${iteration}`,
        detail: [confidence, reason, gaps && `Gap: ${gaps}`, subQuestions].filter(Boolean).join('\n') || 'Evaluating the evidence against the brief.',
        status: event.type === 'supervisor_started' ? 'running' : 'completed',
      });
    } else if (event.type === 'supervisor_completed') {
      items.push({
        id: event.id,
        time: event.timestamp,
        label: `Supervisor decision${iteration}`,
        detail: [asText(payload.decision), asText(payload.reason)].filter(Boolean).join(' · ') || 'Supervisor completed this pass.',
        status: 'completed',
      });
    } else if (event.type === 'tool_started') {
      const completion = completionByParent.get(event.id);
      const completionPayload = completion?.payload || {};
      const failed = completion?.type === 'tool_failed';
      const query = formatQuery(payload.query ?? payload.queries);
      const resultCount = formatCount(completionPayload.result_count ?? payload.result_count);
      const duration = formatDuration(completionPayload.duration ?? payload.duration);
      items.push({
        id: event.id,
        time: event.timestamp,
        label: `${asText(payload.tool) || 'Tool'} search${completion ? failed ? ' failed' : ' completed' : ' started'}${iteration}`,
        detail: [query && `Query: ${query}`, resultCount && `${resultCount} results`, duration && `${duration} duration`, failed && `Error: ${asText(completionPayload.error) || 'Tool failed'}`].filter(Boolean).join('\n') || (completion ? 'Tool returned.' : 'Waiting for tool results.'),
        status: failed ? 'failed' : completion ? 'completed' : 'running',
      });
    } else if ((event.type === 'tool_completed' || event.type === 'tool_failed') && !toolStarts.has(event.parent_id || '')) {
      items.push({
        id: event.id,
        time: event.timestamp,
        label: `${asText(payload.tool) || 'Tool'} ${event.type === 'tool_failed' ? 'failed' : 'completed'}${iteration}`,
        detail: event.type === 'tool_failed' ? asText(payload.error) || 'Tool failed.' : toolDetail(payload),
        status: event.type === 'tool_failed' ? 'failed' : 'completed',
      });
    } else if (event.type === 'sources_discovered') {
      const sources = Array.isArray(payload.sources) ? payload.sources.length : 0;
      items.push({
        id: event.id,
        time: event.timestamp,
        label: `Evidence arrived${iteration}`,
        detail: `${sources} source${sources === 1 ? '' : 's'} discovered from ${asText(payload.tool) || 'search'}${asText(payload.query) ? `\nQuery: ${asText(payload.query)}` : ''}.`,
        status: 'completed',
      });
    } else if (event.type === 'iteration_complete') {
      items.push({
        id: event.id,
        time: event.timestamp,
        label: `Iteration ${event.iteration !== undefined ? event.iteration + 1 : ''} complete`,
        detail: `${formatCount(payload.total_sources) || 'No'} sources accumulated before the next decision.`,
        status: 'completed',
      });
    } else if (event.type === 'scoring_started') {
      items.push({
        id: event.id,
        time: event.timestamp,
        label: 'Scoring started',
        detail: `${formatCount(payload.source_count) || 'The'} sources are being ranked.`,
        status: isResearching ? 'running' : 'completed',
      });
    } else if (event.type === 'sources_ranked') {
      items.push({
        id: event.id,
        time: event.timestamp,
        label: 'Evidence ranked',
        detail: `${formatCount(payload.total_sources) || 'No'} sources remain after scoring.`,
        status: 'completed',
      });
    } else if (event.type === 'done') {
      items.push({
        id: event.id,
        time: event.timestamp,
        label: 'Research complete',
        detail: `${formatCount(payload.source_count) || 'No'} ranked sources ready for review${payload.partial ? ' · partial result' : ''}.`,
        status: 'completed',
      });
    } else if (event.type === 'error') {
      items.push({
        id: event.id,
        time: event.timestamp,
        label: 'Route failed',
        detail: asText(payload.message) || asText(payload.error) || 'The research stream returned an error.',
        status: 'failed',
      });
    }
  }

  return items;
}

function formatTimelineTime(time: number, firstTime: number): string {
  const offset = time - firstTime;
  // ponytail: the sidecar and browser use different clocks; show no duration
  // rather than inventing one across that boundary.
  if (!Number.isFinite(offset) || offset < 0 || offset > 3600) return '—';
  return `+${Math.round(offset)}s`;
}

function formatConfidence(value: unknown): string {
  return typeof value === 'number' ? `Confidence ${value}%` : '';
}

function formatSubQuestions(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value
    .map((question) => {
      if (!question || typeof question !== 'object') return '';
      const item = question as { question?: unknown; status?: unknown };
      return `${asText(item.status) || 'unresolved'}: ${asText(item.question) || 'sub-question'}`;
    })
    .filter(Boolean)
    .join('\n');
}

function toolDetail(payload: Record<string, unknown>): string {
  const query = formatQuery(payload.query ?? payload.queries);
  const resultCount = formatCount(payload.result_count);
  return [query && `Query: ${query}`, resultCount && `${resultCount} results`].filter(Boolean).join('\n') || 'Tool completed.';
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
  return typeof value === 'string' ? value : '';
}

function formatCount(value: unknown): string {
  return typeof value === 'number' ? String(value) : typeof value === 'string' ? value : '';
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
