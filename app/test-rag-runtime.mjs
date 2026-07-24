/**
 * Runtime behavioral tests for RAG proxy routes.
 * Uses tsx to import and execute TypeScript route handlers.
 * Mocks global.fetch to simulate sidecar responses.
 * 
 * Run: npx tsx test-rag-runtime.mjs
 */

import { POST as ingestPOST } from './app/api/rag/ingest/route.ts';
import { POST as queryPOST } from './app/api/rag/query/route.ts';

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

function warnMsg(name, message) {
  console.log(`${WARN} ${name}: ${message}`);
  warnings++;
}

// Default fetch mock — returns success
let fetchImpl = async (url, options) => {
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

// ── Ingest Route Tests ─────────────────────────────────────────────

console.log('\n=== Ingest Route — Runtime Tests ===\n');

// Test: Valid ingest request
{
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Hello world', filename: 'test.txt' })
  });
  const res = await ingestPOST(req);
  const data = await res.json();
  ok('ingest: valid request returns 200', res.status === 200);
  ok('ingest: returns sidecar response', data.success === true);
}

// Test: Missing text
{
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const res = await ingestPOST(req);
  const data = await res.json();
  ok('ingest: missing text returns 400', res.status === 400);
  ok('ingest: missing text has error message', !!data.error);
}

// Test: Empty text
{
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '' })
  });
  const res = await ingestPOST(req);
  ok('ingest: empty text returns 400', res.status === 400);
}

// Test: Whitespace-only text
{
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '   ' })
  });
  const res = await ingestPOST(req);
  ok('ingest: whitespace-only text returns 400', res.status === 400);
}

// Test: null text
{
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: null })
  });
  const res = await ingestPOST(req);
  ok('ingest: null text returns 400', res.status === 400);
}

// Test: text is number
{
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 123 })
  });
  const res = await ingestPOST(req);
  ok('ingest: numeric text returns 400', res.status === 400);
}

// Test: text is boolean
{
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: true })
  });
  const res = await ingestPOST(req);
  ok('ingest: boolean text returns 400', res.status === 400);
}

// Test: filename is number (should be converted to undefined)
{
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'hello', filename: 123 })
  });
  const res = await ingestPOST(req);
  ok('ingest: numeric filename accepted (converted to undefined)', res.status === 200);
}

// Test: filename is object
{
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'hello', filename: { path: '/etc/passwd' } })
  });
  const res = await ingestPOST(req);
  ok('ingest: object filename accepted (converted to undefined)', res.status === 200);
}

// Test: Malformed JSON body
{
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ invalid json }'
  });
  const res = await ingestPOST(req);
  const data = await res.json();
  ok('ingest: malformed JSON returns 400', res.status === 400);
  ok('ingest: malformed JSON error mentions JSON', data.error.toLowerCase().includes('json'));
}

// Test: Body is array
{
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([1, 2, 3])
  });
  const res = await ingestPOST(req);
  ok('ingest: array body returns 400', res.status === 400);
}

// Test: Body is string
{
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify('just a string')
  });
  const res = await ingestPOST(req);
  ok('ingest: string body returns 400', res.status === 400);
}

// Test: No filename (optional)
{
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'hello' })
  });
  const res = await ingestPOST(req);
  ok('ingest: missing filename is accepted', res.status === 200);
}

// Test: Empty filename treated as undefined
{
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'hello', filename: '' })
  });
  const res = await ingestPOST(req);
  ok('ingest: empty string filename accepted (treated as undefined)', res.status === 200);
}

// Test: Extra fields ignored
{
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'hello', filename: 'test.txt', evil: 'injection', nested: { sql: 'DROP TABLE' } })
  });
  const res = await ingestPOST(req);
  ok('ingest: extra fields in body do not cause error', res.status === 200);
}

// ── Sidecar Error Handling ─────────────────────────────────────────

console.log('\n=== Sidecar Error Handling ===\n');

// Test: Sidecar returns 500
{
  global.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ detail: 'Internal server error' })
  });
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'hello' })
  });
  const res = await ingestPOST(req);
  const data = await res.json();
  ok('ingest: sidecar 500 returns 502 to client', res.status === 502);
  ok('ingest: sidecar error body forwarded', data.detail === 'Internal server error');
}

// Test: Sidecar returns non-JSON error
{
  global.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => { throw new Error('not json'); }
  });
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'hello' })
  });
  const res = await ingestPOST(req);
  const data = await res.json();
  ok('ingest: sidecar non-JSON error handled gracefully', res.status === 502);
  ok('ingest: fallback error message', data.detail === 'Sidecar error');
}

// Test: Sidecar unreachable (network error)
{
  global.fetch = async () => { throw new Error('network error'); };
  const req = new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'hello' })
  });
  const res = await ingestPOST(req);
  const data = await res.json();
  ok('ingest: network error returns 503', res.status === 503);
  ok('ingest: network error message mentions unavailable', data.error && data.error.includes('unavailable'));
}

// Restore success fetch
global.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, message: 'ok', track_id: 'test-123' })
});

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
