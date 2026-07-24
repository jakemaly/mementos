'use client';

import { TraceEvent } from '@/app/lib/research-contracts';
import styles from '../page.module.css';

const NODE_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  supervisor_started: { bg: '#f3e8ff', border: '#a855f7', label: 'Supervisor' },
  supervisor_completed: { bg: '#f3e8ff', border: '#a855f7', label: 'Supervisor' },
  brief_generated: { bg: '#ede9fe', border: '#7c3aed', label: 'Brief' },
  tool_started: { bg: '#dbeafe', border: '#3b82f6', label: 'Tool' },
  tool_completed: { bg: '#dbeafe', border: '#3b82f6', label: 'Tool ✓' },
  tool_failed: { bg: '#fef2f2', border: '#ef4444', label: 'Tool ✗' },
  iteration_complete: { bg: '#fefce8', border: '#eab308', label: 'Iteration' },
  scoring_started: { bg: '#dcfce7', border: '#22c55e', label: 'Scoring' },
  sources_ranked: { bg: '#dcfce7', border: '#22c55e', label: 'Ranked' },
  done: { bg: '#ecfdf5', border: '#10b981', label: 'Done' },
  error: { bg: '#fef2f2', border: '#ef4444', label: 'Error' },
};

export function ResearchTrace({ trace }: { trace: TraceEvent[] }) {
  if (trace.length === 0) return null;

  const completionByParent = new Map(
    trace
      .filter(event =>
        (event.type === 'supervisor_completed'
          || event.type === 'tool_completed'
          || event.type === 'tool_failed')
        && event.parent_id
      )
      .map(event => [event.parent_id as string, event]),
  );
  const visibleTrace = trace.filter(event =>
    event.type !== 'supervisor_completed'
    && event.type !== 'tool_completed'
    && !(event.type === 'tool_failed' && !event.payload.query)
  );
  const maxIteration = trace.reduce(
    (maximum, event) => Math.max(maximum, event.iteration ?? 0),
    0,
  );
  const nodes = visibleTrace.map((ev) => {
    const completion = completionByParent.get(ev.id);
    const effectiveType = completion?.type || ev.type;
    const color = NODE_COLORS[effectiveType] || {
      bg: '#f3f4f6',
      border: '#9ca3af',
      label: effectiveType,
    };
    const payload = ev.payload as Record<string, unknown>;
    const completionPayload = completion?.payload || {};
    const tool = payload.tool as string | undefined;
    const resultCount = completionPayload.result_count ?? completionPayload.resultCount;
    const error = (completionPayload.error ?? payload.error) as string | undefined;
    const iteration = ev.iteration ?? 0;
    const layoutRow = ev.type === 'brief_generated'
      ? 0
      : ev.type.startsWith('supervisor_')
        ? 1 + iteration * 3
        : ev.type.startsWith('tool_')
          ? 2 + iteration * 3
          : ev.type === 'iteration_complete'
            ? 3 + iteration * 3
            : 4 + maxIteration * 3;

    return {
      id: ev.id,
      parentIds: (ev.parent_id ? [ev.parent_id] : []),
      type: effectiveType,
      layoutRow,
      label: tool ? `${color.label}: ${tool}` : color.label,
      badge: resultCount !== undefined ? `${resultCount}` : undefined,
      error,
      color,
      running: (ev.type === 'tool_started' || ev.type === 'supervisor_started')
        && !completion,
    };
  });

  const rows = new Map<number, typeof nodes>();
  for (const node of nodes) {
    if (!rows.has(node.layoutRow)) rows.set(node.layoutRow, []);
    rows.get(node.layoutRow)!.push(node);
  }

  const ROW_HEIGHT = 60;
  const NODE_WIDTH = 130;
  const H_GAP = 20;
  const V_GAP = 30;

  // Compute positions
  const positions = new Map<string, { x: number; y: number }>();
  let maxRowWidth = 0;

  const orderedRows = [...rows.entries()].sort(([left], [right]) => left - right);
  for (const [rowIndex, [, rowNodes]] of orderedRows.entries()) {
    const y = rowIndex * (ROW_HEIGHT + V_GAP) + 10;
    let x = 10;
    for (const node of rowNodes) {
      positions.set(node.id, { x, y });
      x += NODE_WIDTH + H_GAP;
    }
    const rowWidth = x - H_GAP;
    if (rowWidth > maxRowWidth) maxRowWidth = rowWidth;
  }

  const svgWidth = Math.max(maxRowWidth + 20, 300);
  const svgHeight = orderedRows.length * (ROW_HEIGHT + V_GAP) + 20;
  const completedCount = trace.filter(event => event.type === 'tool_completed').length;
  const failedCount = trace.filter(event => event.type === 'tool_failed').length;
  const iterationCount = trace.filter(event => event.type === 'iteration_complete').length;

  return (
    <section className={styles.researchTrace}>
      <h3>Research Trace</h3>
      <div className={styles.researchTraceGraphWrapper}>
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className={styles.researchTraceGraph}
          role="img"
          aria-label="Research execution trace DAG"
        >
          {/* Edges */}
          {nodes.flatMap((node) => node.parentIds.map((parentId) => {
            const from = positions.get(parentId);
            const to = positions.get(node.id);
            if (!from || !to) return [];

            return [
              <line
                key={`edge-${parentId}-${node.id}`}
                x1={from.x + NODE_WIDTH / 2}
                y1={from.y + ROW_HEIGHT / 2}
                x2={to.x + NODE_WIDTH / 2}
                y2={to.y + ROW_HEIGHT / 2}
                stroke={node.running ? '#a855f7' : '#cbd5e1'}
                strokeWidth={node.running ? 2 : 1}
                strokeDasharray={node.running ? '6,3' : undefined}
                className={node.running ? styles.researchTraceRunningEdge : undefined}
              />
            ];
          }))}

          {/* Nodes */}
          {nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;

            return (
              <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}>
                <rect
                  width={NODE_WIDTH}
                  height={ROW_HEIGHT}
                  rx={6}
                  fill={node.color.bg}
                  stroke={node.color.border}
                  strokeWidth={node.type === 'tool_failed' ? 2 : 1}
                />
                <text
                  x={NODE_WIDTH / 2}
                  y={ROW_HEIGHT / 2 - 4}
                  textAnchor="middle"
                  style={{ fontSize: '11px', fontWeight: 600, fill: '#1e293b' }}
                >
                  {node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label}
                </text>
                {node.badge && (
                  <text
                    x={NODE_WIDTH / 2}
                    y={ROW_HEIGHT / 2 + 12}
                    textAnchor="middle"
                    style={{ fontSize: '10px', fill: '#64748b' }}
                  >
                    {node.badge} results
                  </text>
                )}
                {node.error && (
                  <text
                    x={NODE_WIDTH / 2}
                    y={ROW_HEIGHT / 2 + 12}
                    textAnchor="middle"
                    style={{ fontSize: '9px', fill: '#ef4444' }}
                  >
                    {node.error.slice(0, 20)}{node.error.length > 20 ? '…' : ''}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Accessible text summary */}
      <div className={styles.researchTraceSummary} aria-live="polite">
        {completedCount} tools completed
        {failedCount > 0 && ` · ${failedCount} failed`}
        {iterationCount > 0 && ` · ${iterationCount} iteration(s)`}
      </div>
    </section>
  );
}
