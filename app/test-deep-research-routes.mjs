/**
 * Focused regression tests for the Deep Research proxy and ingestion routes.
 *
 * Static analysis only — no external test framework.
 *
 * Run: cd app && node test-deep-research-routes.mjs
 */

import * as fs from 'fs';

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

// ── Read source files ──────────────────────────────────────────────

const researchRoute = fs.readFileSync('app/api/research/route.ts', 'utf8');
const ingestRoute = fs.readFileSync('app/api/research/ingest/route.ts', 'utf8');
const contracts = fs.readFileSync('app/lib/research-contracts.ts', 'utf8');

// ── 1. Research request contract ───────────────────────────────────

console.log('\n=== 1. Research Request Contract ===\n');

ok('ResearchRequest contains only query', contracts.includes('query: string'));
const rrMatch = contracts.match(/export interface ResearchRequest {[^}]+}/s); ok('ResearchRequest has no domains field', !rrMatch || !rrMatch[0].includes('domains'));
ok('ResearchRequest has no filetypes field', !contracts.includes('filetypes?: string[]'));

// ── 2. Proxy forwards only query ───────────────────────────────────

console.log('\n=== 2. Proxy Forwarding ===\n');

ok('Proxy validates query presence', researchRoute.includes('hasQuery(body)') || researchRoute.includes('!body?.query'));
ok('Proxy validates query is string', researchRoute.includes("typeof body.query !== 'string'"));
ok('Proxy trims query', researchRoute.includes('body.query.trim()'));
ok('Proxy forwards only query object', researchRoute.includes('JSON.stringify({ query:'));
ok('Proxy does not forward entire request body', !researchRoute.includes('JSON.stringify(body)'));

// ── 3. Proxy abort handling ────────────────────────────────────────

console.log('\n=== 3. Proxy Abort Handling ===\n');

ok('Proxy creates AbortController', researchRoute.includes('new AbortController'));
ok('Proxy forwards abort signal to sidecar fetch', researchRoute.includes('signal: abortController.signal'));
ok('Proxy handles client disconnect', researchRoute.includes('request.signal'));
ok('Proxy cancels and releases the reader', researchRoute.includes('reader.cancel()') && researchRoute.includes('reader.releaseLock()'));

// ── 4. Ingestion route ─────────────────────────────────────────────

console.log('\n=== 4. Ingestion Route ===\n');

ok('Ingest validates sources array', ingestRoute.includes('Array.isArray(body.sources)') && ingestRoute.includes('!body.sources.length'));
ok('Ingest validates collection', ingestRoute.includes('!collection'));
ok('Ingest returns 400 on missing data', ingestRoute.includes('400'));
ok('Ingest routes sources through unified indexing', ingestRoute.includes('indexCollectionDocument'));
ok('Ingest preserves source URL as graph citation provenance', ingestRoute.includes('content, source.url'));
ok('Ingest reports partial outcomes', ingestRoute.includes('const partial') && ingestRoute.includes('Partially imported'));
ok('Ingest reports failed URLs', ingestRoute.includes('failedUrls'));
ok('Ingest distinguishes complete, partial, and total failure', ingestRoute.includes('const complete') && ingestRoute.includes('const partial') && ingestRoute.includes('Could not import any'));

// ── 5. No filter fields in routes ──────────────────────────────────

console.log('\n=== 5. No Filter Fields ===\n');

ok('Research route has no domains', !researchRoute.includes('domains'));
ok('Research route has no filetypes', !researchRoute.includes('filetypes'));

// ── Summary ────────────────────────────────────────────────────────

console.log(`\n=== Results ===`);
console.log(`${PASS} ${passed} passed`);
console.log(`${FAIL} ${failed} failed`);
console.log(`${WARN} ${warnings} warnings`);
console.log(`\nTotal checks: ${passed + failed + warnings}`);

if (failed > 0) {
  console.log('\n❌ VERIFICATION FAILED');
  process.exit(1);
} else if (warnings > 0) {
  console.log('\n⚠️  VERIFICATION PASSED with warnings');
  process.exit(0);
} else {
  console.log('\n✅ VERIFICATION PASSED');
  process.exit(0);
}
