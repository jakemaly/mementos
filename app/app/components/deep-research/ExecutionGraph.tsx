'use client';

import { useMemo } from 'react';
import { TraceEvent, ResearchBrief } from '@/app/lib/research-contracts';
import styles from './deep-research.module.css';

interface ExecutionGraphProps {
  trace: TraceEvent[];
  brief: ResearchBrief | null;
  isResearching: boolean;
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
}

interface GraphNode {
  id: string;
  label: string;
  sublabel: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  row: number;
  col: number;
  event: TraceEvent;
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

export function ExecutionGraph({ trace, isResearching, selectedNodeId, onNodeSelect }: ExecutionGraphProps) {
  const { nodes, edges } = useMemo(() => buildGraph(trace), [trace]);

  if (nodes.length === 0) {
    return (
      <div className={styles.graphEmpty}>
        Waiting for research to start...
      </div>
    );
  }

  const ROW_H = 52;
  const COL_W = 140;
  const GAP_X = 30;
  const GAP_Y = 24;
  const PAD = 20;

  const width = Math.max(
    Math.max(...nodes.map((n) => n.col)) * (COL_W + GAP_X) + COL_W + PAD * 2,
    400,
  );
  const height = Math.max(...nodes.map((n) => n.row)) * (ROW_H + GAP_Y) + ROW_H + PAD * 2;

  const nodePos = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    nodePos.set(n.id, {
      x: PAD + n.col * (COL_W + GAP_X),
      y: PAD + n.row * (ROW_H + GAP_Y),
    });
  }

  return (
    <div className={styles.graphContainer}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={styles.graphSvg}
        role="img"
        aria-label="Research execution graph"
      >
        <defs>
          <marker id="arrowGray" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-muted)" opacity="0.4" />
          </marker>
          <marker id="arrowActive" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
          </marker>
        </defs>

        {edges.map((edge, i) => {
          const from = nodePos.get(edge.from);
          const to = nodePos.get(edge.to);
          if (!from || !to) return null;

          const isActive = edge.label === 'continue' && isResearching;
          const dy = to.y + ROW_H / 2 - (from.y + ROW_H / 2);
          const isLoop = Math.abs(dy) < ROW_H;

          let d: string;
          if (isLoop && dy <= 0) {
            d = `M ${from.x + COL_W / 2} ${from.y + ROW_H} Q ${from.x + COL_W + 20} ${(from.y + to.y) / 2 + 20} ${to.x + COL_W / 2} ${to.y + ROW_H}`;
          } else {
            d = `M ${from.x + COL_W / 2} ${from.y + ROW_H} L ${to.x + COL_W / 2} ${to.y}`;
          }

          return (
            <g key={`e-${i}`}>
              <path
                d={d}
                fill="none"
                stroke={isActive ? 'var(--accent)' : 'var(--text-muted)'}
                strokeWidth={isActive ? 2 : 1}
                strokeDasharray={isActive ? '4,4' : undefined}
                markerEnd={isActive ? 'url(#arrowActive)' : 'url(#arrowGray)'}
                opacity={isActive ? 1 : 0.5}
              />
              {edge.label && (
                <text
                  x={(from.x + to.x + COL_W) / 2}
                  y={(from.y + to.y + ROW_H) / 2 - 4}
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
          const pos = nodePos.get(node.id)!;
          const isSelected = selectedNodeId === node.id;
          const statusClass = node.status;

          return (
            <g
              key={node.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              className={`${styles.graphNode} ${styles[`graphNode-${statusClass}`]}`}
              onClick={() => onNodeSelect(isSelected ? null : node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onNodeSelect(isSelected ? null : node.id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${node.label}: ${node.status}`}
              aria-pressed={isSelected}
            >
              <rect
                width={COL_W}
                height={ROW_H}
                rx="6"
                className={styles.graphNodeRect}
              />
              <text
                x={COL_W / 2}
                y={ROW_H / 2 - 4}
                textAnchor="middle"
                fill="var(--text-primary)"
                fontSize="10"
                fontWeight="600"
              >
                {node.label.length > 18 ? node.label.slice(0, 17) + '\u2026' : node.label}
              </text>
              <text
                x={COL_W / 2}
                y={ROW_H / 2 + 10}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="9"
              >
                {node.sublabel}
              </text>
              {isSelected && (
                <rect
                  x="-2"
                  y="-2"
                  width={COL_W + 4}
                  height={ROW_H + 4}
                  rx="8"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Textual representation */}
      <div className={styles.graphText} aria-live="polite">
        {nodes.map((n) => (
          <span key={n.id} className={styles.graphTextItem}>
            {n.label} ({n.status})
          </span>
        ))}
      </div>
    </div>
  );
}

function buildGraph(trace: TraceEvent[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  let row = 0;
  let col = 0;
  let currentRowNodes: GraphNode[] = [];

  const addNode = (
    id: string,
    label: string,
    sublabel: string,
    status: GraphNode['status'],
    event: TraceEvent,
  ) => {
    const node: GraphNode = { id, label, sublabel, status, row, col, event };
    nodes.push(node);
    currentRowNodes.push(node);
    col++;
  };

  const endRow = () => {
    row++;
    col = 0;
    currentRowNodes = [];
  };

  let prevNodeId: string | null = null;

  for (const ev of trace) {
    const payload = ev.payload || {};
    const iteration = ev.iteration ?? 0;

    if (ev.type === 'brief_generated') {
      addNode(
        ev.id,
        'Brief',
        'Phase 1',
        'completed',
        ev,
      );
      if (prevNodeId) edges.push({ from: prevNodeId, to: ev.id });
      prevNodeId = ev.id;
      endRow();
    } else if (ev.type === 'supervisor_started' || ev.type === 'supervisor_evaluation') {
      const conf = (payload.confidence_score as number) ?? 0;
      addNode(
        ev.id,
        `Supervisor`,
        `Iter ${iteration + 1}${conf ? ` · ${conf}%` : ''}`,
        'completed',
        ev,
      );
      if (prevNodeId) edges.push({ from: prevNodeId, to: ev.id });
      prevNodeId = ev.id;
      endRow();
    } else if (ev.type === 'supervisor_completed') {
      const reason = (payload.reason as string) || 'Done';
      addNode(
        ev.id,
        `Supervisor`,
        `Iter ${iteration + 1} · ${reason}`,
        'completed',
        ev,
      );
      if (prevNodeId) edges.push({ from: prevNodeId, to: ev.id, label: 'done' });
      prevNodeId = ev.id;
      endRow();
    } else if (ev.type === 'tool_started') {
      const tool = (payload.tool as string) || 'tool';
      const isRunning = !trace.some(
        (t) => t.type === 'tool_completed' && t.parent_id === ev.id,
      );
      addNode(
        ev.id,
        tool.charAt(0).toUpperCase() + tool.slice(1),
        `Iter ${iteration + 1}${isRunning ? ' · Running' : ''}`,
        isRunning ? 'running' : 'completed',
        ev,
      );
      if (prevNodeId) edges.push({ from: prevNodeId, to: ev.id, label: 'continue' });
      prevNodeId = ev.id;
    } else if (ev.type === 'tool_completed') {
      const tool = (payload.tool as string) || 'tool';
      const count = (payload.result_count as number) ?? 0;
      const dur = (payload.duration as number) ?? 0;
      addNode(
        ev.id,
        `${tool.charAt(0).toUpperCase() + tool.slice(1)} ✓`,
        `${count} results · ${dur}s`,
        'completed',
        ev,
      );
      if (prevNodeId) edges.push({ from: prevNodeId, to: ev.id });
      prevNodeId = ev.id;
      endRow();
    } else if (ev.type === 'tool_failed') {
      const tool = (payload.tool as string) || 'tool';
      addNode(
        ev.id,
        `${tool.charAt(0).toUpperCase() + tool.slice(1)} ✗`,
        (payload.error as string)?.slice(0, 30) || 'Error',
        'failed',
        ev,
      );
      if (prevNodeId) edges.push({ from: prevNodeId, to: ev.id });
      prevNodeId = ev.id;
      endRow();
    } else if (ev.type === 'iteration_complete') {
      const total = (payload.total_sources as number) ?? 0;
      addNode(
        ev.id,
        `Iteration ${iteration + 1}`,
        `${total} sources total`,
        'completed',
        ev,
      );
      if (prevNodeId) edges.push({ from: prevNodeId, to: ev.id });
      prevNodeId = ev.id;
      endRow();
    } else if (ev.type === 'scoring_started') {
      addNode(ev.id, 'Scoring', 'Phase 3', 'completed', ev);
      if (prevNodeId) edges.push({ from: prevNodeId, to: ev.id });
      prevNodeId = ev.id;
      endRow();
    } else if (ev.type === 'sources_ranked') {
      const total = (payload.total_sources as number) ?? 0;
      addNode(ev.id, 'Ranked', `${total} sources`, 'completed', ev);
      if (prevNodeId) edges.push({ from: prevNodeId, to: ev.id });
      prevNodeId = ev.id;
      endRow();
    } else if (ev.type === 'done') {
      const count = (payload.source_count as number) ?? 0;
      addNode(ev.id, 'Done', `${count} sources`, 'completed', ev);
      if (prevNodeId) edges.push({ from: prevNodeId, to: ev.id });
      prevNodeId = ev.id;
      endRow();
    } else if (ev.type === 'error') {
      addNode(
        ev.id,
        'Error',
        ((payload.message as string) || '').slice(0, 40),
        'failed',
        ev,
      );
      if (prevNodeId) edges.push({ from: prevNodeId, to: ev.id });
      prevNodeId = ev.id;
      endRow();
    }
  }

  return { nodes, edges };
}
