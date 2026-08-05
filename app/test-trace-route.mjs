/** Focused behavioral checks for the Deep Research trace route derivation. */
import assert from 'node:assert/strict';
import { projectTrace } from './app/components/deep-research/trace-model.ts';
import { buildTraceRoute } from './app/components/deep-research/trace-route.ts';

const event = (type, payload = {}, extra = {}) => ({
  id: extra.id || `${type}-${Math.random().toString(16).slice(2)}`,
  type,
  payload,
  timestamp: extra.timestamp ?? 100,
  ...extra,
});

const route = (facts, runState = 'researching', ingestState = 'idle') =>
  buildTraceRoute({ projection: projectTrace(facts), runState, ingestState });

// ── Pending milestone + planned fan-out once the plan is known ────────

const brief = event('brief_generated', {
  reasoning_trace: ['reason'],
  brief: 'Brief',
  tools: ['tavily'],
  queries: { overview: ['overview q'], specific: ['specific q', 'extra q'] },
  sketch: { expected_concepts: ['c'], discriminative_terms: ['t'] },
}, { id: 'brief', timestamp: 1 });

let r = route([brief]);
assert.equal(r.milestone.brief, 'created');
assert.equal(r.milestone.sketch, 'created');
assert.equal(r.nodes[0].kind, 'milestone');
// Plan is known and no supervisor event yet: one virtual checkpoint with
// one pending planned node per plan query.
const pendingCp = r.nodes[1];
assert.equal(pendingCp.kind, 'checkpoint');
assert.equal(pendingCp.virtual, true);
assert.equal(pendingCp.status, 'running');
assert.deepEqual(pendingCp.batches.map((b) => b.query), ['overview q', 'specific q', 'extra q']);
assert.ok(pendingCp.batches.every((b) => b.status === 'pending' && b.planned));

r = route([event('brief_generated', { brief: 'B', queries: { overview: [], specific: [] } }, { id: 'b2' })]);
assert.equal(r.milestone.brief, 'created');
assert.equal(r.nodes.filter((n) => n.kind === 'checkpoint').length, 0);

r = route([]);
assert.equal(r.milestone.brief, 'pending');
assert.equal(r.milestone.sketch, 'pending');
assert.equal(r.nodes.filter((n) => n.kind === 'checkpoint').length, 0);

// ── Iterations, arrival order, and query ownership ────────────────────

const eval1 = event('supervisor_evaluation', {
  iteration: 0, reflection: 'r', gap_analysis: 'g', decision: 'continue', reason: 'gaps',
}, { id: 'eval-1', iteration: 0, timestamp: 2 });
const eval1Start = event('supervisor_started', { decision: 'continue' }, {
  id: 'eval-1-start', iteration: 0, parent_id: 'eval-1', timestamp: 2.5,
});
const tool1 = event('tool_started', { tool: 'tavily', query: ['overview q', 'specific q', 'extra q'] }, {
  id: 'tool-1', iteration: 0, parent_id: 'eval-1', timestamp: 3,
});
const tool1Done = event('tool_completed', { tool: 'tavily', result_count: 2 }, {
  id: 'tool-1-done', iteration: 0, parent_id: 'tool-1', timestamp: 5,
});
const eval2 = event('supervisor_evaluation', {
  iteration: 1, reflection: 'r', gap_analysis: 'g', decision: 'continue', reason: 'gaps',
}, { id: 'eval-2', iteration: 1, timestamp: 6 });
const eval2Start = event('supervisor_started', { decision: 'continue' }, {
  id: 'eval-2-start', iteration: 1, parent_id: 'eval-2', timestamp: 6.5,
});

r = route([brief, eval1, eval1Start, tool1]);
assert.equal(r.nodes.filter((n) => n.kind === 'checkpoint').length, 1);
const cp0 = r.nodes[1];
assert.equal(cp0.virtual, false);
assert.equal(cp0.status, 'running');
assert.equal(cp0.decision, 'continue');
// All planned queries resolved; the fan-out stays in plan order.
assert.deepEqual(cp0.batches.map((b) => [b.query, b.status]), [
  ['overview q', 'running'],
  ['specific q', 'running'],
  ['extra q', 'running'],
]);
assert.ok(cp0.batches.every((b) => b.planned));

r = route([brief, eval1, eval1Start, tool1, tool1Done]);
const resolved = r.nodes[1].batches;
assert.deepEqual(resolved.map((b) => [b.query, b.status, b.zero]), [
  ['overview q', 'completed', true],
  ['specific q', 'completed', true],
  ['extra q', 'completed', true],
]);

// Later iteration appends its own checkpoint; history does not reorder.
r = route([brief, eval1, eval1Start, tool1, tool1Done, eval2, eval2Start]);
const cps = r.nodes.filter((n) => n.kind === 'checkpoint');
assert.equal(cps.length, 2);
assert.deepEqual(cps.map((c) => c.iteration), [0, 1]);
assert.equal(cps[1].status, 'running');
// Second pass owns its own seeded pending plan fan-out.
assert.deepEqual(cps[1].batches.map((b) => [b.query, b.status]), [
  ['overview q', 'pending'],
  ['specific q', 'pending'],
  ['extra q', 'pending'],
]);

// Newly introduced queries append after the planned fan-out.
const tool2 = event('tool_started', { tool: 'arxiv', query: 'brand new query' }, {
  id: 'tool-2', iteration: 1, parent_id: 'eval-2', timestamp: 7,
});
r = route([brief, eval1, eval1Start, tool1, tool1Done, eval2, eval2Start, tool2]);
const secondFan = r.nodes.filter((n) => n.kind === 'checkpoint')[1].batches;
assert.deepEqual(secondFan.map((b) => b.query), ['overview q', 'specific q', 'extra q', 'brand new query']);
assert.equal(secondFan.at(-1).planned, false);
assert.equal(secondFan.at(-1).status, 'running');

// ── Unique source counts, zero results, failures ──────────────────────

const dupDiscovery = (id, parentId, query, urls, timestamp) => event('sources_discovered', {
  tool: 'tavily', query, sources: urls.map((url) => ({ url, title: url, snippet: '', score: 0.5 })),
}, { id, parent_id: parentId, iteration: 0, timestamp });

r = route([
  brief,
  eval1,
  eval1Start,
  tool1,
  dupDiscovery('d1', 'tool-1', 'overview q', ['https://example.com/a', 'https://example.com/b'], 4),
  dupDiscovery('d2', 'tool-1', 'specific q', ['https://example.com/b', 'https://example.com/c'], 4.5),
  tool1Done,
]);
const counted = r.nodes[1].batches;
assert.deepEqual(counted.map((b) => [b.query, b.newCount, b.zero]), [
  ['overview q', 2, false],
  ['specific q', 1, false], // b is a duplicate; c is new
  ['extra q', 0, true], // completed but never discovered
]);

const failed = event('tool_failed', { tool: 'tavily', query: 'specific q', error: 'API error' }, {
  id: 'tool-1-failed', iteration: 0, parent_id: 'tool-1', timestamp: 5,
});
r = route([brief, eval1, eval1Start, tool1, failed]);
const failedBatches = r.nodes[1].batches;
assert.deepEqual(failedBatches.map((b) => [b.query, b.status, b.error]), [
  ['overview q', 'failed', 'API error'],
  ['specific q', 'failed', 'API error'],
  ['extra q', 'failed', 'API error'],
]);

// ── Ranked + ingest lifecycle ─────────────────────────────────────────

const scored = event('sources_ranked', { total_sources: 3, top_score: 0.9 }, {
  id: 'ranked-1', parent_id: 'score-start', timestamp: 8,
});
const done = event('done', { source_count: 3 }, { id: 'done', timestamp: 9 });

r = route([brief, scored], 'researching');
assert.equal(r.ranked.status, 'completed');
assert.equal(r.ingest.status, 'locked');

r = route([brief, scored], 'completed');
assert.equal(r.ingest.status, 'ready');

r = route([brief, scored], 'completed', 'importing');
assert.equal(r.ingest.status, 'importing');

r = route([brief, scored], 'completed', 'imported');
assert.equal(r.ingest.status, 'imported');

r = route([brief, scored], 'completed', 'failed');
assert.equal(r.ingest.status, 'import-failed');

r = route([brief, scored], 'ingesting');
assert.equal(r.ingest.status, 'importing');

r = route([brief, scored], 'ingested');
assert.equal(r.ingest.status, 'imported');

// Failed or timed-out runs keep the route and lock ingestion.
r = route([brief, scored, done], 'failed');
assert.equal(r.ranked.status, 'completed');
assert.equal(r.ingest.status, 'locked');
assert.equal(r.milestone.brief, 'created');

// Partial timeout: ranking completed (done arrived) but ingest stays locked.
r = route([brief, event('done', { source_count: 2, partial: true, timeout_phase: 'iteration_1' }, { id: 'done-p' })], 'failed');
assert.equal(r.ranked.status, 'completed');
assert.equal(r.ingest.status, 'locked');

// No scoring yet.
r = route([brief], 'researching');
assert.equal(r.ranked.status, 'pending');
assert.equal(r.ingest.status, 'locked');

// scoring_started without ranked result.
r = route([brief, event('scoring_started', { source_count: 3 }, { id: 'ss' })], 'researching');
assert.equal(r.ranked.status, 'running');

// Final route order is process order.
r = route([brief, eval1, eval1Start, tool1, tool1Done, scored, done], 'completed');
assert.deepEqual(r.nodes.map((n) => n.kind), ['milestone', 'checkpoint', 'ranked', 'ingest']);

console.log('✓ trace route fixtures passed');
