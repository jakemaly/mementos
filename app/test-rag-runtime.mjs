/**
 * Runtime behavioral tests for RAG proxy routes.
 * Uses tsx to import and execute TypeScript route handlers.
 * Mocks global.fetch to simulate sidecar responses.
 * 
 * Run: npx tsx test-rag-runtime.mjs
 */

import { POST as ingestPOST } from './app/api/rag/ingest/route.ts';
import { POST as queryPOST } from './app/api/rag/query/route.ts';
import { createCollectionIndexer } from './lib/index-collection-document.ts';

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const WARN = '\x1b[33m⚠\x1b[0m';

let passed = 0;
let failed = 0;
let warnings = 0;

function ok(name, condition) {
  if (condition) {
    console.log(`${PASS} ${name}`);
    passed++;
  } else {
    console.log(`${FAIL} ${name}`);
    failed++;
  }
}

// Default fetch mock — returns success
let fetchImpl = async () => {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, message: 'ok', track_id: 'test-123' })
  };
};

global.fetch = fetchImpl;

// Mock AbortController
const OriginalAbortController = global.AbortController;
global.AbortController = class {
  #controller = new OriginalAbortController();
  signal = this.#controller.signal;
  abort(reason) { this.#controller.abort(reason); }
};

// ── Unified Collection Indexing Tests ──────────────────────────────

console.log('\n=== Unified Collection Indexing — Runtime Tests ===\n');

{
  const index = createCollectionIndexer({
    embed: async () => Array(384).fill(0),
    upsert: async () => undefined,
    graphInsert: async () => ({ status: 'complete', trackId: 'track-1' }),
  });
  const result = await index('default', 'A document with evidence.', 'notes.md');
  ok('index: complete when vector and graph writes succeed', result.status === 'complete');
  ok('index: returns independent branch outcomes', result.vector.status === 'complete' && result.graph.status === 'complete');
}
{
  const index = createCollectionIndexer({
    embed: async () => { throw new Error('embedding unavailable'); },
    upsert: async () => undefined,
    graphInsert: async () => ({ status: 'complete', trackId: 'track-1' }),
  });
  const result = await index('default', 'A document with evidence.', 'notes.md');
  ok('index: preserves graph success when vector indexing fails', result.status === 'partial' && result.graph.status === 'complete' && result.vector.status === 'failed');
}
{
  const index = createCollectionIndexer({
    embed: async () => Array(384).fill(0),
    upsert: async () => undefined,
    graphInsert: async () => ({ status: 'failed', error: 'sidecar unavailable' }),
  });
  const result = await index('default', 'A document with evidence.', 'notes.md');
  ok('index: preserves vector success when graph indexing fails', result.status === 'partial' && result.vector.status === 'complete' && result.graph.status === 'failed');
}

// ── Manual Ingest Route Validation Tests ────────────────────────────

console.log('\n=== Manual Ingest Route — Runtime Tests ===\n');

for (const formData of [
  new FormData(),
  (() => { const form = new FormData(); form.set('collection', 'bad name'); form.set('file', new File(['text'], 'notes.txt', { type: 'text/plain' })); return form; })(),
  (() => { const form = new FormData(); form.set('collection', 'default'); form.set('file', new File(['text'], 'notes.pdf', { type: 'application/pdf' })); return form; })(),
  (() => { const form = new FormData(); form.set('collection', 'default'); form.set('file', new File(['   '], 'notes.txt', { type: 'text/plain' })); return form; })(),
]) {
  const req = new Request('http://localhost/api/ingest', { method: 'POST', body: formData });
  const res = await ingestPOST(req);
  ok('ingest: invalid file or collection returns 400', res.status === 400);
}

// ── Streaming Chat Proxy Tests ─────────────────────────────────────

console.log('\n=== Streaming Chat Proxy — Runtime Tests ===\n');

function sseResponse(events, status = 200) {
  const encoder = new TextEncoder();
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'text/event-stream; charset=utf-8' }),
    body: new ReadableStream({
      start(controller) {
        for (const event of events) controller.enqueue(encoder.encode(event));
        controller.close();
      },
    }),
    json: async () => ({ detail: 'sidecar error' }),
  };
}

// The proxy forwards only the supported contract and preserves event order.
{
  let forwarded;
  global.fetch = async (_url, options) => {
    forwarded = JSON.parse(options.body);
    return sseResponse([
      'event: status\ndata: {"turn_id":"turn-1","status":"retrieving"}\n\n',
      'event: done\ndata: {"turn_id":"turn-1"}\n\n',
    ]);
  };
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: '  What is AI?  ', collection: 'default', turn_id: 'turn-1',
      history: [{ role: 'user', content: 'Earlier question' }],
    }),
  });
  const res = await queryPOST(req);
  ok('chat: valid request returns 200', res.status === 200);
  ok('chat: preserves SSE content type', res.headers.get('content-type')?.startsWith('text/event-stream'));
  ok('chat: forwards only validated fields', JSON.stringify(forwarded) === JSON.stringify({
    query: 'What is AI?', collection: 'default', turn_id: 'turn-1',
    history: [{ role: 'user', content: 'Earlier question' }],
  }));
  const streamText = await res.text();
  ok('chat: preserves SSE event order', streamText.indexOf('event: status') < streamText.indexOf('event: done'));
}

for (const body of [
  {},
  { query: '', collection: 'default', turn_id: 'turn-1', history: [] },
  { query: 'test', collection: 'bad name', turn_id: 'turn-1', history: [] },
  { query: 'test', collection: 'default', turn_id: '', history: [] },
  { query: 'test', collection: 'default', turn_id: 'turn-1', history: [{ role: 'system', content: 'no' }] },
  { query: 'test', collection: 'default', turn_id: 'turn-1', history: [], mode: 'naive' },
]) {
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const res = await queryPOST(req);
  ok('chat: invalid contract returns 400', res.status === 400);
}

// Malformed JSON remains a client error.
{
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{ bad json }',
  });
  const res = await queryPOST(req);
  ok('chat: malformed JSON returns 400', res.status === 400);
}

// Client cancellation aborts the in-flight sidecar request.
{
  global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  });
  const clientController = new OriginalAbortController();
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: clientController.signal,
    body: JSON.stringify({ query: 'test', collection: 'default', turn_id: 'turn-1', history: [] }),
  });
  const response = queryPOST(req);
  await new Promise((resolve) => setTimeout(resolve, 0));
  clientController.abort();
  const res = await response;
  ok('chat: client abort cancels sidecar request', res.status === 499);
}

// Upstream errors are safe and distinguish validation from availability.
{
  global.fetch = async () => sseResponse([], 400);
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'test', collection: 'default', turn_id: 'turn-1', history: [] }),
  });
  const res = await queryPOST(req);
  ok('chat: sidecar validation error remains 400', res.status === 400);
}
{
  global.fetch = async () => sseResponse([], 500);
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'test', collection: 'default', turn_id: 'turn-1', history: [] }),
  });
  const res = await queryPOST(req);
  ok('chat: sidecar failure returns 502', res.status === 502);
}
{
  global.fetch = async () => { throw new Error('network error'); };
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'test', collection: 'default', turn_id: 'turn-1', history: [] }),
  });
  const res = await queryPOST(req);
  ok('chat: network failure returns 503', res.status === 503);
}

// ── Summary ────────────────────────────────────────────────────────

console.log(`\n=== Results ===`);
console.log(`${PASS} ${passed} passed`);
console.log(`${FAIL} ${failed} failed`);
console.log(`${WARN} ${warnings} warnings`);
console.log(`\nTotal checks: ${passed + failed + warnings}`);

if (failed > 0) {
  console.log('\n❌ VERIFICATION FAILED');
  process.exit(1);
} else {
  console.log('\n✅ VERIFICATION PASSED');
  process.exit(0);
}
