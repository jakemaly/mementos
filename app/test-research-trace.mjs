/** Focused behavioral checks for the Deep Research trace projection. */
import assert from 'node:assert/strict';
import { projectTrace } from './app/components/deep-research/trace-model.ts';

const event = (type, payload = {}, extra = {}) => ({
  id: extra.id || `${type}-${Math.random().toString(16).slice(2)}`,
  type,
  payload,
  timestamp: extra.timestamp ?? 100,
  ...extra,
});

const snakeBrief = event('brief_generated', {
  reasoning: ['scope the question'],
  brief: 'A scoped brief',
  tools: ['tavily'],
  queries: { overview: ['overview query'], specific: ['specific query'] },
  sketch: {
    expected_concepts: ['concept'],
    discriminative_terms: ['term'],
    expected_patterns: ['pattern'],
    preferred_domains: ['example.com'],
  },
}, { id: 'brief-snake' });

const camelBrief = event('brief_generated', {
  reasoningTrace: ['scope the question'],
  brief: 'A scoped brief',
  tools: ['tavily'],
  queryPlan: { overview: ['overview query'], specific: ['specific query'] },
  sketch: {
    expectedConcepts: ['concept'],
    discriminativeTerms: ['term'],
    expectedPatterns: ['pattern'],
    preferredDomains: ['example.com'],
  },
}, { id: 'brief-camel' });

const snakeProjection = projectTrace([snakeBrief]);
const camelProjection = projectTrace([camelBrief]);
assert.deepEqual(camelProjection.brief?.brief, snakeProjection.brief?.brief);
assert.deepEqual(camelProjection.brief?.sketch, snakeProjection.brief?.sketch);
assert.deepEqual(camelProjection.brief?.briefData, snakeProjection.brief?.briefData);
assert.deepEqual(camelProjection.brief?.queries, snakeProjection.brief?.queries);

const trace = [
  event('brief_generated', {
    reasoning_trace: ['reason'],
    brief: 'Brief',
    tools: ['tavily'],
    queries: { overview: ['first query'], specific: [] },
    sketch: { expected_concepts: ['concept'], discriminative_terms: ['term'] },
  }, { id: 'brief', timestamp: 10 }),
  event('supervisor_evaluation', {
    reflection: 'Reflecting',
    gap_analysis: 'A gap',
    sub_questions: [{ id: 'sq1', question: 'First?', status: 'unresolved' }],
    confidence_score: 35,
    decision: 'continue',
    reason: 'More evidence needed',
  }, { id: 'eval-1', iteration: 0, timestamp: 20 }),
  event('tool_started', {
    tool: 'tavily',
    query: ['first query'],
    query_count: 1,
  }, { id: 'tool-1', iteration: 0, parent_id: 'eval-1', timestamp: 30 }),
  event('iteration_complete', {
    total_sources: 1,
    new_sources: 1,
  }, { id: 'iter-1', iteration: 0, timestamp: 40 }),
  event('sources_discovered', {
    tool: 'tavily',
    query: 'first query',
    sources: [{ url: 'https://example.com/a', title: 'A', snippet: 'a', score: 0.9 }],
  }, { id: 'discover-1', iteration: 0, parent_id: 'tool-1', timestamp: 35 }),
  event('tool_completed', {
    tool: 'tavily',
    query: ['first query'],
    result_count: 1,
    duration: 1.25,
  }, { id: 'tool-1-done', iteration: 0, parent_id: 'tool-1', timestamp: 50 }),
  event('supervisor_started', {
    decision: 'continue',
    reason: 'A second pass is needed',
  }, { id: 'supervisor-1', iteration: 0, parent_id: 'eval-1', timestamp: 60 }),
  event('supervisor_evaluation', {
    reflection: 'Second reflection',
    gap_analysis: 'Another gap',
    confidence_score: 60,
    decision: 'done',
    reason: 'Enough evidence',
  }, { id: 'eval-2', iteration: 1, timestamp: 70 }),
  event('supervisor_completed', {
    decision: 'done',
    reason: 'Enough evidence',
  }, { id: 'supervisor-2', iteration: 1, parent_id: 'eval-2', timestamp: 75 }),
  event('tool_started', {
    tool: 'tavily',
    query: 'second query',
  }, { id: 'tool-2', iteration: 1, parent_id: 'supervisor-2', timestamp: 80 }),
  event('tool_failed', {
    tool: 'tavily',
    query: 'second query',
    error: 'API error',
    duration: 2,
  }, { id: 'tool-2-failed', iteration: 1, parent_id: 'tool-2', timestamp: 90 }),
  event('tool_started', { tool: 'tavily', query: 'still running' }, {
    id: 'tool-running', iteration: 1, timestamp: 100,
  }),
  event('tool_completed', { tool: 'tavily', result_count: 3 }, {
    id: 'orphan-completion', parent_id: 'missing-start', timestamp: 110,
  }),
  event('scoring_started', { source_count: 1 }, {
    id: 'score-start', parent_id: 'iter-1', timestamp: 120,
  }),
  event('sources_ranked', { total_sources: 1, top_score: 0.9 }, {
    id: 'score-done', parent_id: 'score-start', timestamp: 130,
  }),
  event('done', { source_count: 1, partial: true, timeout_phase: 'iteration_1' }, {
    id: 'done', timestamp: 140,
  }),
  event('future_event', { useful: true }, { id: 'unknown', timestamp: 1 }),
];

const projection = projectTrace(trace);
const kinds = projection.facts.map((fact) => fact.kind);
assert.equal(kinds.filter((kind) => kind === 'supervisor_iteration').length, 2);
assert.equal(kinds.filter((kind) => kind === 'tool_invocation').length, 4);
assert.equal(kinds.filter((kind) => kind === 'scoring').length, 1);
assert.equal(kinds.filter((kind) => kind === 'source_discovery').length, 1);
assert.equal(kinds.at(-1), 'unknown');

const firstTool = projection.facts.find((fact) => fact.id === 'tool-1');
assert.equal(firstTool.status, 'completed');
assert.equal(firstTool.resultCount, 1);
assert.deepEqual(firstTool.queries, ['first query']);
assert.equal(firstTool.timestamp, 30);

const failedTool = projection.facts.find((fact) => fact.id === 'tool-2');
assert.equal(failedTool.status, 'failed');
assert.equal(failedTool.error, 'API error');
assert.equal(projection.facts.find((fact) => fact.id === 'tool-running')?.status, 'running');
assert.equal(projection.facts.find((fact) => fact.id === 'orphan-completion')?.missingStart, true);

const supervisorFacts = projection.facts.filter((fact) => fact.kind === 'supervisor_iteration');
assert.equal(supervisorFacts[0].status, 'running');
assert.equal(supervisorFacts[0].decision, 'continue');
assert.equal(supervisorFacts[1].status, 'completed');
assert.equal(supervisorFacts[1].followUpType, 'supervisor_completed');
assert.equal(supervisorFacts[1].decision, 'done');

const discovery = projection.sourceDiscoveries[0];
assert.equal(discovery.sources[0].url, 'https://example.com/a');
assert.equal(discovery.parentId, 'tool-1');

const scoring = projection.facts.find((fact) => fact.kind === 'scoring');
assert.equal(scoring.rankingCompleted, true);
assert.equal(scoring.topScore, 0.9);

const openScoring = projectTrace([event('scoring_started', { source_count: 2 }, { id: 'open-score' })]).facts[0];
assert.equal(openScoring.status, 'running');
assert.equal(openScoring.rankingCompleted, false);

const done = projection.facts.find((fact) => fact.kind === 'done');
assert.equal(done.partial, true);
assert.equal(done.timeoutPhase, 'iteration_1');
assert.equal(projection.facts.find((fact) => fact.id === 'unknown').eventType, 'future_event');
assert.equal(projection.facts.some((fact) => fact.eventType === 'cancelled'), false);

const arrivalProjection = projectTrace([
  event('tool_started', { tool: 'tool' }, { id: 'start', timestamp: 999 }),
  event('tool_completed', { result_count: 2 }, { id: 'finish', parent_id: 'start', timestamp: 1 }),
  event('error', { message: 'ordered' }, { id: 'error', timestamp: 0 }),
]);
assert.deepEqual(arrivalProjection.facts.map((fact) => fact.id), ['start', 'error']);
assert.equal(arrivalProjection.facts[0].status, 'completed');

console.log('✓ trace projection fixtures passed');
