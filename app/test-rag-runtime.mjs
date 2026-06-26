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
  signal = { aborted: false };
  abort() { this.signal.aborted = true; }
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

// ── Query Route Tests ──────────────────────────────────────────────

console.log('\n=== Query Route — Runtime Tests ===\n');

// Test: Valid query request
{
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ answer: 'AI is...', mode: 'hybrid' })
  });
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'What is AI?', mode: 'hybrid' })
  });
  const res = await queryPOST(req);
  ok('query: valid request returns 200', res.status === 200);
}

// Test: Missing query
{
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const res = await queryPOST(req);
  ok('query: missing query returns 400', res.status === 400);
}

// Test: Invalid mode
{
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'test', mode: 'invalid_mode' })
  });
  const res = await queryPOST(req);
  const data = await res.json();
  ok('query: invalid mode returns 400', res.status === 400);
  ok('query: invalid mode error lists valid modes', data.error && data.error.includes('naive'));
}

// Test: Missing mode defaults to hybrid
{
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'test' })
  });
  const res = await queryPOST(req);
  ok('query: missing mode accepted (defaults to hybrid)', res.status === 200);
}

// Test: All valid modes
for (const mode of ['naive', 'local', 'global', 'hybrid']) {
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'test', mode })
  });
  const res = await queryPOST(req);
  ok(`query: mode '${mode}' accepted`, res.status === 200);
}

// Test: query is null
{
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: null })
  });
  const res = await queryPOST(req);
  ok('query: null query returns 400', res.status === 400);
}

// Test: query is number
{
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 42 })
  });
  const res = await queryPOST(req);
  ok('query: numeric query returns 400', res.status === 400);
}

// Test: query is array
{
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: ['test'] })
  });
  const res = await queryPOST(req);
  ok('query: array query returns 400', res.status === 400);
}

// Test: mode is number
{
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'test', mode: 123 })
  });
  const res = await queryPOST(req);
  ok('query: numeric mode accepted (defaults to hybrid)', res.status === 200);
}

// Test: mode is null
{
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'test', mode: null })
  });
  const res = await queryPOST(req);
  ok('query: null mode accepted (defaults to hybrid)', res.status === 200);
}

// Test: Malformed JSON
{
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ bad json }'
  });
  const res = await queryPOST(req);
  const data = await res.json();
  ok('query: malformed JSON returns 400', res.status === 400);
  ok('query: malformed JSON error mentions JSON', data.error.toLowerCase().includes('json'));
}

// ── Query Sidecar Error Handling ───────────────────────────────────

console.log('\n=== Query Sidecar Error Handling ===\n');

// Test: query sidecar 500
{
  global.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ detail: 'Internal server error' })
  });
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'test' })
  });
  const res = await queryPOST(req);
  ok('query: sidecar 500 returns 502', res.status === 502);
}

// Test: query network error
{
  global.fetch = async () => { throw new Error('network error'); };
  const req = new Request('http://localhost/api/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'test' })
  });
  const res = await queryPOST(req);
  const data = await res.json();
  ok('query: network error returns 503', res.status === 503);
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
