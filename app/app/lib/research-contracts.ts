/** Shared wire contracts for the SIRA agentic research pipeline. */

// ── Request input ────────────────────────────────────────────────────────

export interface ResearchRequest {
  query: string;
  domains?: string[];
  filetypes?: string[];
}

// ── Phase 1: Brief + Sketch ─────────────────────────────────────────────

export interface QueryPlan {
  overview: string[];
  specific: string[];
}

export interface ResearchBrief {
  reasoning_trace: string[];
  brief: string;
  tools: string[]; // e.g. ["tavily", "arxiv", "github"]
  queries: QueryPlan;
}

export interface Sketch {
  expected_concepts: string[];
  discriminative_terms: string[];
  expected_patterns?: string[];
  preferred_domains?: string[];
}

// ── Phase 2: Normalized Source ──────────────────────────────────────────

export type SourceType = 'tavily' | 'arxiv' | 'github';

export interface Source {
  url: string;
  title: string;
  snippet: string;
  score: number;
  source?: SourceType;
  metadata?: Record<string, unknown>;
}

// ── Phase 2: SSE Trace Events ───────────────────────────────────────────

export type TraceEventType =
  | 'supervisor_started'
  | 'supervisor_completed'
  | 'brief_generated'
  | 'tool_started'
  | 'tool_completed'
  | 'tool_failed'
  | 'iteration_complete'
  | 'scoring_started'
  | 'sources_ranked'
  | 'done'
  | 'error';

export interface TraceEvent {
  id: string;
  parent_id?: string;
  type: TraceEventType;
  payload: Record<string, unknown>;
  iteration?: number;
  timestamp: number;
}

// ── Phase 3: Final payload ──────────────────────────────────────────────

export interface ResearchResult {
  brief: ResearchBrief;
  sketch: Sketch;
  sources: Source[];
  trace: TraceEvent[];
  partial?: boolean;
  timeout_phase?: string;
}
