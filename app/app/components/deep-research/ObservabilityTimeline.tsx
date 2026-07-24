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

export function ObservabilityTimeline({ trace, brief, isResearching, focusedNodeId }: ObservabilityTimelineProps) {
  const entries = useMemo(() => {
    const items: Array<{ id: string; time: number; label: string; detail: string; status: string }> = [];
    const completionByParent = new Map(
      trace
        .filter((event) => (event.type === 'tool_completed' || event.type === 'tool_failed') && event.parent_id)
        .map((event) => [event.parent_id as string, event]),
    );

    if (brief) {
      items.push({
        id: 'brief',
        time: 0,
        label: 'Research brief generated',
        detail: brief.brief || 'Scope defined',
        status: 'completed',
      });
    }

    for (const ev of trace) {
      const payload = ev.payload || {};
      const iteration = ev.iteration ?? 0;

      if (ev.type === 'supervisor_started' || ev.type === 'supervisor_evaluation') {
        const conf = (payload.confidence_score as number) ?? 0;
        const reason = (payload.reason as string) || '';
        const gaps = (payload.gap_analysis as string) || '';
        const subQuestions = Array.isArray(payload.sub_questions)
          ? (payload.sub_questions as Array<{ question?: string; status?: string }>)
              .map((question) => `${question.status || 'unresolved'}: ${question.question || 'sub-question'}`)
              .join('\n')
          : '';
        items.push({
          id: ev.id,
          time: ev.timestamp,
          label: `Supervisor evaluation (Iter ${iteration + 1})`,
          detail: `${conf}% confidence${reason ? ` · ${reason}` : ''}${gaps ? `\nGap: ${gaps}` : ''}${subQuestions ? `\n${subQuestions}` : ''}`,
          status: 'completed',
        });
      } else if (ev.type === 'supervisor_completed') {
        const reason = (payload.reason as string) || 'Done';
        items.push({
          id: ev.id,
          time: ev.timestamp,
          label: `Supervisor stop (Iter ${iteration + 1})`,
          detail: reason,
          status: 'completed',
        });
      } else if (ev.type === 'tool_started') {
        const tool = (payload.tool as string) || 'tool';
        const query = (payload.query as string | string[]) || '';
        const completion = completionByParent.get(ev.id);
        const completionPayload = completion?.payload || {};
        const resultCount = (completionPayload.result_count as number) ?? 0;
        const duration = (completionPayload.duration as number) ?? 0;
        const outcome = completion?.type === 'tool_failed'
          ? `failed: ${(completionPayload.error as string) || 'Unknown error'}`
          : completion
            ? `${resultCount} results in ${duration}s`
            : 'running';
        items.push({
          id: ev.id,
          time: ev.timestamp,
          label: `${tool} ${completion?.type === 'tool_failed' ? 'failed' : completion ? 'completed' : 'started'}`,
          detail: `${typeof query === 'string' ? query : query.join(', ')}\n${outcome}`,
          status: completion?.type === 'tool_failed' ? 'failed' : completion ? 'completed' : 'running',
        });
      } else if (ev.type === 'tool_completed') {
        const tool = (payload.tool as string) || 'tool';
        const count = (payload.result_count as number) ?? 0;
        const dur = (payload.duration as number) ?? 0;
        const query = (payload.query as string | string[]) || '';
        items.push({
          id: ev.id,
          time: ev.timestamp,
          label: `${tool} completed`,
          detail: `${count} results in ${dur}s${query ? `\nQuery: ${typeof query === 'string' ? query : query.join(', ')}` : ''}`, 
          status: 'completed',
        });
      } else if (ev.type === 'tool_failed') {
        const tool = (payload.tool as string) || 'tool';
        const err = (payload.error as string) || 'Unknown error';
        items.push({
          id: ev.id,
          time: ev.timestamp,
          label: `${tool} failed`,
          detail: err,
          status: 'failed',
        });
      } else if (ev.type === 'iteration_complete') {
        const total = (payload.total_sources as number) ?? 0;
        items.push({
          id: ev.id,
          time: ev.timestamp,
          label: `Iteration ${iteration + 1} complete`,
          detail: `${total} sources total`,
          status: 'completed',
        });
      } else if (ev.type === 'scoring_started') {
        items.push({
          id: ev.id,
          time: ev.timestamp,
          label: 'Scoring started',
          detail: 'Ranking sources by relevance',
          status: 'running',
        });
      } else if (ev.type === 'sources_ranked') {
        const total = (payload.total_sources as number) ?? 0;
        items.push({
          id: ev.id,
          time: ev.timestamp,
          label: 'Sources ranked',
          detail: `${total} sources scored`,
          status: 'completed',
        });
      } else if (ev.type === 'error') {
        items.push({
          id: ev.id,
          time: ev.timestamp,
          label: 'Error',
          detail: (payload.message as string) || 'Unknown error',
          status: 'failed',
        });
      }
    }

    return items;
  }, [trace, brief]);

  if (entries.length === 0) {
    return <div className={styles.timelineEmpty}>Waiting for events...</div>;
  }

  return (
    <ol className={styles.timelineList}>
      {entries.map((entry) => (
        <li
          key={entry.id}
          className={`${styles.timelineItem} ${styles[`timelineItem-${entry.status}`]} ${focusedNodeId === entry.id ? styles.timelineItemFocused : ''}`}
        >
          <span className={styles.timelineLabel}>{entry.label}</span>
          <span className={styles.timelineDetail}>{entry.detail}</span>
        </li>
      ))}
      {isResearching && (
        <li className={`${styles.timelineItem} ${styles['timelineItem-running']}`}>
          <span className={styles.timelineLabel}>Research in progress...</span>
        </li>
      )}
    </ol>
  );
}
