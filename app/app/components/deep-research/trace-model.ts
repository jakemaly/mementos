import {
  QueryPlan,
  ResearchBrief,
  Sketch,
  Source,
  SubQuestion,
} from '@/app/lib/research-contracts';

export type FactStatus = 'running' | 'completed' | 'failed';

/** Runtime-shaped input accepted at the in-process projection seam. */
export interface TraceEventLike {
  id?: unknown;
  parent_id?: unknown;
  type?: unknown;
  payload?: unknown;
  iteration?: unknown;
  timestamp?: unknown;
}

interface TraceFactBase {
  id: string;
  kind: TraceFact['kind'];
  eventType: string;
  timestamp: number;
  parentId?: string;
  iteration?: number;
}

export interface BriefFact extends TraceFactBase {
  kind: 'brief';
  eventType: 'brief_generated' | 'done';
  brief: string;
  briefData: ResearchBrief;
  reasoningTrace: readonly string[];
  tools: readonly string[];
  queries: QueryPlan;
  sketch?: Sketch;
}

export interface SupervisorIterationFact extends TraceFactBase {
  kind: 'supervisor_iteration';
  eventType: 'supervisor_evaluation' | 'supervisor_started' | 'supervisor_completed';
  status: FactStatus;
  reflection: string;
  gapAnalysis: string;
  subQuestions: readonly SubQuestion[];
  confidenceScore?: number;
  decision: string;
  reason: string;
  followUpType?: 'supervisor_started' | 'supervisor_completed';
  followUpId?: string;
}

export interface ToolInvocationFact extends TraceFactBase {
  kind: 'tool_invocation';
  eventType: 'tool_started' | 'tool_completed' | 'tool_failed';
  status: FactStatus;
  tool: string;
  query?: string;
  queries: readonly string[];
  duration?: number | string;
  resultCount?: number | string;
  error?: string;
  missingStart?: boolean;
}

export interface IterationFact extends TraceFactBase {
  kind: 'iteration';
  eventType: 'iteration_complete';
  status: 'completed';
  totalSources?: number | string;
  newSources?: number | string;
}

export interface SourceDiscoveryFact extends TraceFactBase {
  kind: 'source_discovery';
  eventType: 'sources_discovered';
  status: 'completed';
  tool: string;
  query?: string;
  sources: readonly Source[];
}

export interface ScoringFact extends TraceFactBase {
  kind: 'scoring';
  eventType: 'scoring_started' | 'sources_ranked';
  status: 'running' | 'completed';
  sourceCount?: number | string;
  topScore?: number;
  rankingCompleted: boolean;
  rankId?: string;
}

export interface DoneFact extends TraceFactBase {
  kind: 'done';
  eventType: 'done';
  status: 'completed';
  sourceCount?: number | string;
  partial: boolean;
  timeoutPhase?: string;
  brief?: ResearchBrief;
  sketch?: Sketch;
}

export interface ErrorFact extends TraceFactBase {
  kind: 'error';
  eventType: 'error';
  status: 'failed';
  message: string;
  phase?: string;
}

export interface UnknownFact extends TraceFactBase {
  kind: 'unknown';
  eventType: string;
  payload: unknown;
}

export type TraceFact =
  | BriefFact
  | SupervisorIterationFact
  | ToolInvocationFact
  | IterationFact
  | SourceDiscoveryFact
  | ScoringFact
  | DoneFact
  | ErrorFact
  | UnknownFact;

export interface ResearchTraceProjection {
  readonly facts: readonly TraceFact[];
  readonly brief?: BriefFact;
  readonly sketch?: Sketch;
  readonly sourceDiscoveries: readonly SourceDiscoveryFact[];
}

type Entry = {
  event: TraceEventLike;
  index: number;
  id: string;
  type: string;
  parentId?: string;
  iteration?: number;
  timestamp: number;
  payload: Record<string, unknown>;
};

/**
 * Interpret the wire trace once and expose ordered semantic facts to views.
 * This function deliberately has no I/O, React state, or timestamp sorting.
 */
export function projectTrace(events: readonly TraceEventLike[]): ResearchTraceProjection {
  const entries = events.map((event, index) => toEntry(event, index));
  const pairedChildren = new Set<number>();
  const toolPairs = pairChildren(entries, new Set(['tool_started']), new Set(['tool_completed', 'tool_failed']), pairedChildren);
  const supervisorPairs = pairChildren(entries, new Set(['supervisor_evaluation']), new Set(['supervisor_started', 'supervisor_completed']), pairedChildren);
  const scoringPairs = pairChildren(entries, new Set(['scoring_started']), new Set(['sources_ranked']), pairedChildren);

  const facts: TraceFact[] = [];
  for (const entry of entries) {
    if (pairedChildren.has(entry.index)) continue;

    switch (entry.type) {
      case 'brief_generated':
        facts.push(toBriefFact(entry));
        break;
      case 'supervisor_evaluation':
        facts.push(toSupervisorFact(entry, supervisorPairs.get(entry.index)));
        break;
      case 'supervisor_started':
      case 'supervisor_completed':
        facts.push(toSupervisorFact(entry));
        break;
      case 'tool_started':
        facts.push(toToolFact(entry, toolPairs.get(entry.index)));
        break;
      case 'tool_completed':
      case 'tool_failed':
        facts.push(toToolFact(entry, undefined, true));
        break;
      case 'iteration_complete':
        facts.push(toIterationFact(entry));
        break;
      case 'sources_discovered':
        facts.push(toSourceDiscoveryFact(entry));
        break;
      case 'scoring_started':
        facts.push(toScoringFact(entry, scoringPairs.get(entry.index)));
        break;
      case 'sources_ranked':
        facts.push(toScoringFact(entry, undefined, true));
        break;
      case 'done':
        facts.push(toDoneFact(entry));
        break;
      case 'error':
        facts.push(toErrorFact(entry));
        break;
      default:
        facts.push(toUnknownFact(entry));
        break;
    }
  }

  const briefFact = [...facts].reverse().find((fact): fact is BriefFact => fact.kind === 'brief');
  const terminalSketch = [...facts]
    .reverse()
    .find((fact): fact is DoneFact => fact.kind === 'done' && Boolean(fact.sketch))?.sketch;
  const terminalBrief = [...facts]
    .reverse()
    .find((fact): fact is DoneFact => fact.kind === 'done' && Boolean(fact.brief))?.brief;
  const brief = briefFact || (terminalBrief ? terminalBriefFact(entries, terminalBrief, terminalSketch) : undefined);
  const sketch = briefFact?.sketch || terminalSketch;

  return {
    facts,
    brief,
    sketch,
    sourceDiscoveries: facts.filter((fact): fact is SourceDiscoveryFact => fact.kind === 'source_discovery'),
  };
}

function toEntry(event: TraceEventLike, index: number): Entry {
  const type = asText(event.type) || 'unknown';
  return {
    event,
    index,
    id: asText(event.id) || `trace-${index}`,
    type,
    parentId: asText(event.parent_id) || undefined,
    iteration: asNumber(event.iteration),
    timestamp: asFiniteNumber(event.timestamp) ?? index,
    payload: eventPayload(event),
  };
}

function eventPayload(event: TraceEventLike): Record<string, unknown> {
  if (isRecord(event.payload)) return event.payload;
  const direct = { ...event };
  delete direct.id;
  delete direct.parent_id;
  delete direct.type;
  delete direct.payload;
  delete direct.iteration;
  delete direct.timestamp;
  return direct;
}

function pairChildren(
  entries: readonly Entry[],
  startTypes: ReadonlySet<string>,
  childTypes: ReadonlySet<string>,
  pairedChildren: Set<number>,
): Map<number, Entry> {
  const startsById = new Map<string, number>();
  for (const entry of entries) {
    if (startTypes.has(entry.type) && !startsById.has(entry.id)) startsById.set(entry.id, entry.index);
  }

  const pairs = new Map<number, Entry>();
  for (const child of entries) {
    if (!childTypes.has(child.type) || !child.parentId) continue;
    const startIndex = startsById.get(child.parentId);
    if (startIndex === undefined || pairs.has(startIndex)) continue;
    pairs.set(startIndex, child);
    pairedChildren.add(child.index);
  }
  return pairs;
}

function toBriefFact(entry: Entry): BriefFact {
  const briefData = normalizeBrief(entry.payload);
  return {
    ...baseFact(entry, 'brief'),
    eventType: 'brief_generated',
    brief: briefData.brief,
    briefData,
    reasoningTrace: briefData.reasoning_trace,
    tools: briefData.tools,
    queries: briefData.queries,
    sketch: normalizeSketch(entry.payload.sketch ?? entry.payload.research_sketch ?? entry.payload.researchSketch),
  };
}

function terminalBriefFact(entries: readonly Entry[], briefData: ResearchBrief, sketch?: Sketch): BriefFact {
  const entry = [...entries].reverse().find((item) => item.type === 'done') || entries[entries.length - 1];
  const base = entry || {
    event: {}, index: 0, id: 'terminal-brief', type: 'done', timestamp: 0, payload: {},
  };
  return {
    ...baseFact(base, 'brief'),
    eventType: 'done',
    brief: briefData.brief,
    briefData,
    reasoningTrace: briefData.reasoning_trace,
    tools: briefData.tools,
    queries: briefData.queries,
    sketch,
  };
}

function toSupervisorFact(entry: Entry, followUp?: Entry): SupervisorIterationFact {
  const payload = followUp ? { ...entry.payload, ...followUp.payload } : entry.payload;
  const iteration = entry.iteration ?? asNumber(payload.iteration);
  return {
    ...baseFact({ ...entry, iteration }, 'supervisor_iteration'),
    eventType: entry.type as SupervisorIterationFact['eventType'],
    status: followUp?.type === 'supervisor_started' ? 'running' : 'completed',
    reflection: asText(payload.reflection ?? payload.reasoning),
    gapAnalysis: asText(payload.gap_analysis ?? payload.gapAnalysis),
    subQuestions: normalizeSubQuestions(payload.sub_questions ?? payload.subQuestions),
    confidenceScore: asNumber(payload.confidence_score ?? payload.confidenceScore),
    decision: asText(payload.decision),
    reason: asText(payload.reason),
    followUpType: followUp?.type as SupervisorIterationFact['followUpType'],
    followUpId: followUp?.id,
  };
}

function toToolFact(entry: Entry, completion?: Entry, missingStart = false): ToolInvocationFact {
  const queryValue = firstDefined(
    entry.payload.query,
    entry.payload.queries,
    completion?.payload.query,
    completion?.payload.queries,
  );
  const queries = normalizeQueries(queryValue);
  const status: FactStatus = missingStart
    ? entry.type === 'tool_failed' ? 'failed' : 'completed'
    : completion?.type === 'tool_failed' ? 'failed' : completion ? 'completed' : 'running';

  return {
    ...baseFact(entry, 'tool_invocation'),
    eventType: entry.type as ToolInvocationFact['eventType'],
    status,
    tool: asText(firstDefined(entry.payload.tool, completion?.payload.tool)) || 'Tool',
    query: queries.length === 1 ? queries[0] : undefined,
    queries,
    duration: asNumberOrText(firstDefined(completion?.payload.duration, entry.payload.duration)),
    resultCount: asNumberOrText(firstDefined(
      completion?.payload.result_count,
      completion?.payload.resultCount,
      entry.payload.result_count,
      entry.payload.resultCount,
    )),
    error: asText(firstDefined(completion?.payload.error, entry.payload.error)) || undefined,
    missingStart: missingStart || undefined,
  };
}

function toIterationFact(entry: Entry): IterationFact {
  return {
    ...baseFact(entry, 'iteration'),
    eventType: 'iteration_complete',
    status: 'completed',
    totalSources: asNumberOrText(firstDefined(entry.payload.total_sources, entry.payload.totalSources)),
    newSources: asNumberOrText(firstDefined(entry.payload.new_sources, entry.payload.newSources)),
  };
}

function toSourceDiscoveryFact(entry: Entry): SourceDiscoveryFact {
  const queries = normalizeQueries(firstDefined(entry.payload.query, entry.payload.queries));
  return {
    ...baseFact(entry, 'source_discovery'),
    eventType: 'sources_discovered',
    status: 'completed',
    tool: asText(entry.payload.tool) || 'search',
    query: queries.length === 1 ? queries[0] : queries.length > 1 ? queries.join(' · ') : undefined,
    sources: normalizeSources(entry.payload.sources),
  };
}

function toScoringFact(entry: Entry, ranking?: Entry, missingStart = false): ScoringFact {
  return {
    ...baseFact(entry, 'scoring'),
    eventType: entry.type as ScoringFact['eventType'],
    status: missingStart || ranking ? 'completed' : 'running',
    sourceCount: asNumberOrText(firstDefined(
      ranking?.payload.total_sources,
      ranking?.payload.source_count,
      entry.payload.source_count,
      entry.payload.sourceCount,
      entry.payload.total_sources,
    )),
    topScore: asNumber(firstDefined(ranking?.payload.top_score, ranking?.payload.topScore, entry.payload.top_score, entry.payload.topScore)),
    rankingCompleted: Boolean(ranking) || missingStart,
    rankId: ranking?.id,
  };
}

function toDoneFact(entry: Entry): DoneFact {
  const payload = entry.payload;
  const briefValue = isRecord(payload.brief) ? normalizeBrief(payload.brief) : undefined;
  return {
    ...baseFact(entry, 'done'),
    eventType: 'done',
    status: 'completed',
    sourceCount: asNumberOrText(firstDefined(payload.source_count, payload.sourceCount, payload.total_sources, payload.totalSources)),
    partial: asBoolean(payload.partial),
    timeoutPhase: asText(firstDefined(payload.timeout_phase, payload.timeoutPhase)) || undefined,
    brief: briefValue,
    sketch: normalizeSketch(payload.sketch ?? payload.research_sketch ?? payload.researchSketch),
  };
}

function toErrorFact(entry: Entry): ErrorFact {
  return {
    ...baseFact(entry, 'error'),
    eventType: 'error',
    status: 'failed',
    message: asText(entry.payload.message) || asText(entry.payload.error) || 'The research stream returned an error.',
    phase: asText(entry.payload.phase) || undefined,
  };
}

function toUnknownFact(entry: Entry): UnknownFact {
  return {
    ...baseFact(entry, 'unknown'),
    eventType: entry.type,
    payload: Object.keys(entry.payload).length > 0 ? entry.payload : entry.event.payload,
  };
}

function baseFact<K extends TraceFact['kind']>(
  entry: Pick<Entry, 'id' | 'parentId' | 'iteration' | 'timestamp'>,
  kind: K,
): Omit<TraceFactBase, 'kind'> & { kind: K } {
  return {
    id: entry.id,
    kind,
    eventType: '',
    timestamp: entry.timestamp,
    parentId: entry.parentId,
    iteration: entry.iteration,
  };
}

function normalizeBrief(payload: Record<string, unknown>): ResearchBrief {
  const queries = normalizeQueryPlan(firstDefined(payload.queries, payload.query_plan, payload.queryPlan));
  return {
    reasoning_trace: normalizeStrings(firstDefined(payload.reasoning_trace, payload.reasoningTrace, payload.reasoning)),
    brief: asText(payload.brief),
    tools: normalizeStrings(payload.tools),
    queries,
  };
}

function normalizeQueryPlan(value: unknown): QueryPlan {
  const record = isRecord(value) ? value : {};
  return {
    overview: normalizeStrings(firstDefined(record.overview, record.overview_queries, record.overviewQueries)),
    specific: normalizeStrings(firstDefined(record.specific, record.specific_queries, record.specificQueries)),
  };
}

function normalizeSketch(value: unknown): Sketch | undefined {
  if (!isRecord(value)) return undefined;
  return {
    expected_concepts: normalizeStrings(firstDefined(value.expected_concepts, value.expectedConcepts)),
    discriminative_terms: normalizeStrings(firstDefined(value.discriminative_terms, value.discriminativeTerms)),
    expected_patterns: normalizeStrings(firstDefined(value.expected_patterns, value.expectedPatterns)),
    preferred_domains: normalizeStrings(firstDefined(value.preferred_domains, value.preferredDomains)),
  };
}

function normalizeSubQuestions(value: unknown): SubQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const status = asText(item.status);
    return [{
      id: asText(item.id) || `sub-question-${index}`,
      question: asText(item.question),
      status: status === 'resolved' || status === 'partially_resolved' ? status : 'unresolved',
      evidence_summary: asText(firstDefined(item.evidence_summary, item.evidenceSummary)) || undefined,
    }];
  });
}

function normalizeSources(value: unknown): Source[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') {
      return [{ url: item, title: item, snippet: '', score: 0 }];
    }
    if (!isRecord(item) || !asText(item.url)) return [];
    const source = asText(item.source);
    return [{
      url: asText(item.url),
      title: asText(item.title) || asText(item.url),
      snippet: asText(item.snippet),
      score: asNumber(item.score) ?? 0,
      source: source === 'tavily' || source === 'arxiv' || source === 'github' ? source : undefined,
      metadata: isRecord(item.metadata) ? item.metadata : undefined,
    }];
  });
}

function normalizeQueries(value: unknown): string[] {
  if (typeof value === 'string') return value ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item) => normalizeQueries(item));
  if (isRecord(value)) return Object.values(value).flatMap((item) => normalizeQueries(item));
  return [];
}

function normalizeStrings(value: unknown): string[] {
  if (typeof value === 'string') return value ? [value] : [];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null);
}

function asNumberOrText(value: unknown): number | string | undefined {
  const number = asNumber(value);
  if (number !== undefined) return number;
  const text = asText(value);
  return text || undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return asNumber(value);
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
