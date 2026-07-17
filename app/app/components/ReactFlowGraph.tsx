'use client';

import React, { useMemo } from 'react';
import { TraceEvent } from '@/app/lib/research-contracts';

interface ReactFlowGraphProps {
  trace: TraceEvent[];
  isResearching: boolean;
}

interface GraphNode {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  curved?: boolean;
}

const NODES: GraphNode[] = [
  { id: 'brief', label: 'Brief Generator', sublabel: 'Phase 1: Intent & Sketch', x: 70, y: 100 },
  { id: 'supervisor', label: 'ODR Supervisor', sublabel: 'Gap Analysis & Checklist', x: 280, y: 100 },
  { id: 'tools', label: 'Tavily Web Search', sublabel: 'Multi-Query Search', x: 500, y: 40 },
  { id: 'scoring', label: 'SIRA Sketch Scoring', sublabel: 'Discriminative Ranking', x: 500, y: 160 },
  { id: 'ingest', label: 'LightRAG Ingest', sublabel: 'Knowledge Graph DB', x: 730, y: 160 },
];

const EDGES: GraphEdge[] = [
  { id: 'e1', from: 'brief', to: 'supervisor' },
  { id: 'e2', from: 'supervisor', to: 'tools', label: 'continue', curved: true },
  { id: 'e3', from: 'tools', to: 'supervisor', curved: true },
  { id: 'e4', from: 'supervisor', to: 'scoring', label: 'done' },
  { id: 'e5', from: 'scoring', to: 'ingest' },
];

export function ReactFlowGraph({ trace, isResearching }: ReactFlowGraphProps) {
  const activeNodeId = useMemo(() => {
    if (!isResearching && trace.some((e) => e.type === 'done')) return 'ingest';
    if (trace.length === 0) return null;
    const lastEvent = trace[trace.length - 1];

    if (lastEvent.type === 'brief_generated') return 'brief';
    if (lastEvent.type.startsWith('supervisor')) return 'supervisor';
    if (lastEvent.type.startsWith('tool')) return 'tools';
    if (lastEvent.type === 'scoring_started' || lastEvent.type === 'sources_ranked') return 'scoring';
    return null;
  }, [trace, isResearching]);

  const nodePosMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    NODES.forEach((n) => map.set(n.id, { x: n.x, y: n.y }));
    return map;
  }, []);

  return (
    <div
      style={{
        width: '100%',
        height: '240px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(15, 23, 42, 0.6)',
        overflow: 'hidden',
        position: 'relative',
        padding: '1rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          LangGraph DAG Topology
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
          {isResearching ? '⚡ Executing Graph' : trace.length > 0 ? '✓ Graph Idle' : 'Ready'}
        </div>
      </div>

      <svg width="100%" height="180px" viewBox="0 0 880 220" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255, 255, 255, 0.4)" />
          </marker>
          <marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa" />
          </marker>
        </defs>

        {/* Draw Edges */}
        {EDGES.map((edge) => {
          const from = nodePosMap.get(edge.from);
          const to = nodePosMap.get(edge.to);
          if (!from || !to) return null;

          const isActive = (edge.from === activeNodeId || edge.to === activeNodeId) && isResearching;

          let pathD = `M ${from.x + 70} ${from.y + 20} L ${to.x - 10} ${to.y + 20}`;
          if (edge.curved) {
            if (edge.from === 'supervisor' && edge.to === 'tools') {
              pathD = `M ${from.x + 60} ${from.y} Q ${from.x + 120} ${to.y + 20} ${to.x - 10} ${to.y + 20}`;
            } else if (edge.from === 'tools' && edge.to === 'supervisor') {
              pathD = `M ${from.x} ${from.y + 35} Q ${to.x + 100} ${from.y + 50} ${to.x + 70} ${to.y + 35}`;
            }
          }

          return (
            <g key={edge.id}>
              <path
                d={pathD}
                fill="none"
                stroke={isActive ? '#60a5fa' : 'rgba(255, 255, 255, 0.25)'}
                strokeWidth={isActive ? 2.5 : 1.5}
                strokeDasharray={isActive ? '4,4' : undefined}
                markerEnd={isActive ? 'url(#arrow-active)' : 'url(#arrow)'}
              />
              {edge.label && (
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 6}
                  fill={isActive ? '#60a5fa' : 'rgba(255, 255, 255, 0.5)'}
                  fontSize="10"
                  textAnchor="middle"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Draw Nodes */}
        {NODES.map((node) => {
          const isActive = node.id === activeNodeId;
          return (
            <g key={node.id} transform={`translate(${node.x - 60}, ${node.y - 15})`}>
              <rect
                width="140"
                height="50"
                rx="10"
                fill={isActive ? 'url(#active-grad)' : 'rgba(30, 41, 59, 0.85)'}
                stroke={isActive ? '#60a5fa' : 'rgba(255, 255, 255, 0.15)'}
                strokeWidth={isActive ? 2 : 1}
              />
              <text x="70" y="22" fill="#ffffff" fontSize="11" fontWeight="600" textAnchor="middle">
                {node.label}
              </text>
              <text x="70" y="37" fill="rgba(255, 255, 255, 0.6)" fontSize="9" textAnchor="middle">
                {node.sublabel}
              </text>
            </g>
          );
        })}

        <linearGradient id="active-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </svg>
    </div>
  );
}
