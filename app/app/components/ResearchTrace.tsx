'use client';

import { TraceEvent } from '@/app/lib/research-contracts';

interface Props {
  trace: TraceEvent[];
}

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

function getNodeColor(event: TraceEvent) {
  return NODE_COLORS[event.type] || { bg: '#f3f4f6', border: '#9ca3af', label: event.type };
}

export function ResearchTrace({ trace }: Props) {
  if (trace.length === 0) return null;

  // Build node map keyed by event id
  const nodes = trace.map((ev, i) => {
    const color = getNodeColor(ev);
    const payload = ev.payload as Record<string, unknown>;
    const tool = payload.tool as string | undefined;
    const resultCount = payload.result_count ?? payload.resultCount;
    const error = payload.error as string | undefined;

    return {
      id: ev.id,
      parentId: ev.parent_id,
      type: ev.type,
      iteration: ev.iteration,
      label: tool ? `${color.label}: ${tool}` : color.label,
      badge: resultCount !== undefined ? `${resultCount}` : undefined,
      error,
      color,
      index: i,
    };
  });

  // Compute layout: rows by iteration, columns by tool order
  const rows = new Map<number, typeof nodes>();
  for (const node of nodes) {
    const iter = node.iteration ?? 0;
    if (!rows.has(iter)) rows.set(iter, []);
    rows.get(iter)!.push(node);
  }

  const ROW_HEIGHT = 60;
  const NODE_WIDTH = 130;
  const H_GAP = 20;
  const V_GAP = 30;

  // Compute positions
  const positions = new Map<string, { x: number; y: number }>();
  let maxRowWidth = 0;

  for (const [iter, rowNodes] of rows) {
    const y = iter * (ROW_HEIGHT + V_GAP) + 10;
    let x = 10;
    for (const node of rowNodes) {
      positions.set(node.id, { x, y });
      x += NODE_WIDTH + H_GAP;
    }
    const rowWidth = x - H_GAP;
    if (rowWidth > maxRowWidth) maxRowWidth = rowWidth;
  }

  const svgWidth = Math.max(maxRowWidth + 20, 300);

  return (
    <div className="research-trace" style={{ marginTop: '1rem' }}>
      <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        Research Trace
      </h3>
      <svg
        width="100%"
        height={(rows.size) * (ROW_HEIGHT + V_GAP) + 20}
        viewBox={`0 0 ${svgWidth} ${rows.size * (ROW_HEIGHT + V_GAP) + 20}`}
        style={{ background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}
        role="img"
        aria-label="Research execution trace DAG"
      >
        {/* Edges */}
        {nodes.map((node) => {
          if (!node.parentId) return null;
          const from = positions.get(node.parentId);
          const to = positions.get(node.id);
          if (!from || !to) return null;

          const isRunning = node.type === 'tool_started';
          return (
            <line
              key={`edge-${node.id}`}
              x1={from.x + NODE_WIDTH / 2}
              y1={from.y + ROW_HEIGHT / 2}
              x2={to.x + NODE_WIDTH / 2}
              y2={to.y + ROW_HEIGHT / 2}
              stroke={isRunning ? '#a855f7' : '#cbd5e1'}
              strokeWidth={isRunning ? 2 : 1}
              strokeDasharray={isRunning ? '6,3' : undefined}
              style={isRunning ? { animation: 'dash-flow 1s linear infinite' } : undefined}
            />
          );
        })}

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

      {/* Accessible text summary */}
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
        {trace.filter(e => e.type === 'tool_completed').length} tools completed
        {trace.filter(e => e.type === 'tool_failed').length > 0 &&
          ` · ${trace.filter(e => e.type === 'tool_failed').length} failed`}
        {trace.filter(e => e.type === 'iteration_complete').length > 0 &&
          ` · ${trace.filter(e => e.type === 'iteration_complete').length} iteration(s)`}
      </div>

      <style>{`
        @keyframes dash-flow {
          to { stroke-dashoffset: -9; }
        }
      `}</style>
    </div>
  );
}
