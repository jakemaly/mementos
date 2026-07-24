'use client';

import { useMemo } from 'react';
import { TraceEvent } from '@/app/lib/research-contracts';
import styles from './deep-research.module.css';

interface ExecutionGraphProps {
  trace: TraceEvent[];
  brief: unknown;
  isResearching: boolean;
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
}

interface GraphNode {
  id: string;
  label: string;
  sublabel: string;
  status: 'running' | 'completed' | 'failed';
  row: number;
  col: number;
  event: TraceEvent;
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

export function ExecutionGraph({
  trace,
  isResearching,
  selectedNodeId,
  onNodeSelect,
}: ExecutionGraphProps) {
  const { nodes, edges } = useMemo(() => buildGraph(trace), [trace]);

  if (nodes.length === 0) {
    return <div className={styles.graphEmpty}>Waiting for research to start...</div>;
  }

  const rowHeight = 52;
  const columnWidth = 140;
  const gapX = 30;
  const gapY = 24;
  const padding = 20;
  const width = Math.max(
    Math.max(...nodes.map((node) => node.col)) * (columnWidth + gapX) + columnWidth + padding * 2,
    400,
  );
  const height = Math.max(...nodes.map((node) => node.row)) * (rowHeight + gapY) + rowHeight + padding * 2;
  const positions = new Map(
    nodes.map((node) => [node.id, {
      x: padding + node.col * (columnWidth + gapX),
      y: padding + node.row * (rowHeight + gapY),
    }]),
  );

  return (
    <div className={styles.graphContainer}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.graphSvg} role="img" aria-label="Research execution graph">
        <defs>
          <marker id="execution-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-muted)" opacity="0.5" />
          </marker>
          <marker id="execution-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
          </marker>
        </defs>

        {edges.map((edge, index) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          const active = edge.label === 'continue' && isResearching;
          const loop = to.y <= from.y;
          const path = loop
            ? `M ${from.x + columnWidth / 2} ${from.y + rowHeight} C ${from.x + columnWidth + 35} ${from.y + rowHeight + 24}, ${to.x + columnWidth + 35} ${to.y - 24}, ${to.x + columnWidth / 2} ${to.y}`
            : `M ${from.x + columnWidth / 2} ${from.y + rowHeight} L ${to.x + columnWidth / 2} ${to.y}`;
          return (
            <g key={`${edge.from}-${edge.to}-${index}`}>
              <path
                d={path}
                fill="none"
                stroke={active ? 'var(--accent)' : 'var(--text-muted)'}
                strokeWidth={active ? 2 : 1}
                strokeDasharray={active ? '4,4' : undefined}
                markerEnd={active ? 'url(#execution-arrow-active)' : 'url(#execution-arrow)'}
                opacity={active ? 1 : 0.55}
              />
              {edge.label && (
                <text
                  x={(from.x + to.x + columnWidth) / 2}
                  y={(from.y + to.y + rowHeight) / 2 - 4}
                  fill="var(--text-muted)"
                  fontSize="9"
                  textAnchor="middle"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {nodes.map((node) => {
          const position = positions.get(node.id)!;
          const selected = selectedNodeId === node.id;
          return (
            <g
              key={node.id}
              transform={`translate(${position.x}, ${position.y})`}
              className={`${styles.graphNode} ${styles[`graphNode-${node.status}`]}`}
              onClick={() => onNodeSelect(selected ? null : node.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onNodeSelect(selected ? null : node.id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${node.label}: ${node.status}`}
              aria-pressed={selected}
            >
              <rect width={columnWidth} height={rowHeight} rx="6" className={styles.graphNodeRect} />
              <text x={columnWidth / 2} y={rowHeight / 2 - 4} textAnchor="middle" fill="var(--text-primary)" fontSize="10" fontWeight="600">
                {node.label.length > 18 ? `${node.label.slice(0, 17)}\u2026` : node.label}
              </text>
              <text x={columnWidth / 2} y={rowHeight / 2 + 10} textAnchor="middle" fill="var(--text-muted)" fontSize="9">
                {node.sublabel}
              </text>
              {selected && <rect x="-2" y="-2" width={columnWidth + 4} height={rowHeight + 4} rx="8" fill="none" stroke="var(--accent)" strokeWidth="2" />}
            </g>
          );
        })}
      </svg>

      <div className={styles.graphText} aria-live="polite">
        {nodes.map((node) => <span key={node.id} className={styles.graphTextItem}>{node.label} ({node.status})</span>)}
      </div>
    </div>
  );
}

function buildGraph(trace: TraceEvent[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const byId = new Map<string, GraphNode>();
  const completionByParent = new Map<string, TraceEvent>();
  const supervisorIds: string[] = [];
  const iterationIds: string[] = [];

  for (const event of trace) {
    if ((event.type === 'tool_completed' || event.type === 'tool_failed') && event.parent_id) {
      completionByParent.set(event.parent_id, event);
    }
  }

  let row = 0;
  let col = 0;
  let previousId: string | null = null;
  let previousIterationId: string | null = null;

  const add = (event: TraceEvent, label: string, sublabel: string, status: GraphNode['status']) => {
    const node: GraphNode = { id: event.id, label, sublabel, status, row, col, event };
    nodes.push(node);
    byId.set(node.id, node);
    if (previousId) edges.push({ from: previousId, to: node.id });
    previousId = node.id;
    col += 1;
    return node;
  };

  const finishRow = () => {
    row += 1;
    col = 0;
  };

  for (const event of trace) {
    const payload = event.payload || {};
    const iteration = event.iteration ?? 0;

    if (event.type === 'brief_generated') {
      add(event, 'Brief', 'Phase 1', 'completed');
      finishRow();
    } else if (event.type === 'supervisor_evaluation') {
      const confidence = (payload.confidence_score as number) ?? 0;
      const node = add(event, 'Supervisor', `Iter ${iteration + 1}${confidence ? ` · ${confidence}%` : ''}`, 'completed');
      supervisorIds.push(node.id);
      if (previousIterationId) edges.push({ from: previousIterationId, to: node.id, label: 'continue' });
      finishRow();
    } else if (event.type === 'tool_started') {
      const tool = (payload.tool as string) || 'tool';
      const completion = completionByParent.get(event.id);
      const status = completion?.type === 'tool_failed' ? 'failed' : completion ? 'completed' : 'running';
      const detail = completion
        ? `${(completion.payload.result_count as number) ?? 0} results · ${(completion.payload.duration as number) ?? 0}s`
        : `Iter ${iteration + 1} · Running`;
      add(event, tool, detail, status);
    } else if (event.type === 'iteration_complete') {
      const total = (payload.total_sources as number) ?? 0;
      const node = add(event, `Iteration ${iteration + 1}`, `${total} sources total`, 'completed');
      iterationIds.push(node.id);
      previousIterationId = node.id;
      finishRow();
    } else if (event.type === 'scoring_started') {
      add(event, 'Scoring', 'Phase 3', 'completed');
      finishRow();
    } else if (event.type === 'sources_ranked') {
      add(event, 'Ranked', `${(payload.total_sources as number) ?? 0} sources`, 'completed');
      finishRow();
    } else if (event.type === 'done') {
      add(event, 'Done', `${(payload.source_count as number) ?? 0} sources`, 'completed');
      finishRow();
    } else if (event.type === 'error') {
      add(event, 'Error', ((payload.message as string) || 'Unknown error').slice(0, 36), 'failed');
      finishRow();
    }
  }

  // The explicit loop edge makes repeated supervisor/tool iterations legible.
  for (let index = 1; index < supervisorIds.length; index += 1) {
    const priorIteration = iterationIds[index - 1];
    const supervisor = byId.get(supervisorIds[index]);
    if (priorIteration && supervisor) edges.push({ from: priorIteration, to: supervisor.id, label: 'continue' });
  }

  return { nodes, edges };
}
