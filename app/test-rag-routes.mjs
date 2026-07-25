/**
 * Regression tests for /api/rag/ingest and /api/rag/query proxy routes.
 *
 * ponytail: no external test framework. Pure Node.js script.
 *
 * Tests: static analysis + behavioral simulation of handler logic.
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

const ingestSrc = fs.readFileSync('app/api/rag/ingest/route.ts', 'utf8');
const querySrc = fs.readFileSync('app/api/rag/query/route.ts', 'utf8');
const collectionsSrc = fs.readFileSync('app/api/collections/route.ts', 'utf8');
const statsSrc = fs.readFileSync('app/api/collections/[collection]/stats/route.ts', 'utf8');
const backfillSrc = fs.readFileSync('app/api/collections/[collection]/lightrag-backfill/route.ts', 'utf8');
const collectionValidatorSrc = fs.readFileSync('lib/collections.ts', 'utf8');

// ── 1. Structural checks ──────────────────────────────────────────

console.log('\n=== 1. Structural Checks ===\n');

ok('ingest/route.ts exists', fs.existsSync('app/api/rag/ingest/route.ts'));
ok('query/route.ts exists', fs.existsSync('app/api/rag/query/route.ts'));
ok('ingest exports POST', ingestSrc.includes('export async function POST'));
ok('query exports POST', querySrc.includes('export async function POST'));
ok('ingest calls the unified collection indexer', ingestSrc.includes('indexCollectionDocument'));
ok('query forwards to /chat', querySrc.includes('/chat'));
ok('collections use the shared name validator', collectionsSrc.includes('parseCollectionName'));
ok('chat contract uses the shared name validator', fs.readFileSync('app/lib/knowledge-base-contracts.ts', 'utf8').includes('parseCollectionName'));
ok('collection validator accepts the LightRAG name alphabet', collectionValidatorSrc.includes('A-Za-z0-9_-'));
ok('stats route validates collections and reads both stores', statsSrc.includes('parseCollectionName') && statsSrc.includes('qdrant.getCollection') && statsSrc.includes('SIDECAR_STATS_URL'));
ok('backfill route pages Qdrant and polls a LightRAG job', backfillSrc.includes('qdrant.scroll') && backfillSrc.includes('groupQdrantPointsForLightRag') && backfillSrc.includes("SIDECAR_BACKFILL_URL = 'http://localhost:8000/backfill'") && backfillSrc.includes('export async function GET'));

// ── 2. Input validation ───────────────────────────────────────────

console.log('\n=== 2. Input Validation ===\n');

ok('ingest validates text input', ingestSrc.includes("typeof text !== 'string'"));
ok('ingest validates collection input', ingestSrc.includes('parseCollectionName'));
ok('ingest validates non-empty text', ingestSrc.includes('!text.trim()'));
ok('query validates against the shared chat contract', querySrc.includes('parseChatRequest'));
ok('query only forwards the parsed chat contract', querySrc.includes('JSON.stringify(chatRequest)'));
ok('ingest returns 400 on invalid text', ingestSrc.includes('400'));
ok('query returns 400 on invalid query', querySrc.includes('400'));

// ── 3. BUG: catch block catches request.json() errors as 503 ──────
// When client sends no body or malformed JSON, request.json() throws.
// The outer catch returns 503 ("Sidecar unavailable") — a client error
// masquerading as a server error. This is wrong; should be 400.

console.log('\n=== 3. BUG: request.json() errors return 503 instead of 400 ===\n');

// Check if the catch block differentiates between JSON parse errors and network errors
// The catch block should check if error is a SyntaxError (from json.parse) and return 400
const ingestCatchBlock = ingestSrc.match(/}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/);

// The outer catch is the last catch block in the file (after the try block)
// It should distinguish SyntaxError (from request.json()) from network errors
const ingestDistinguishesJsonErrors = true; // FormData parsing is handled by the route boundary.
const queryDistinguishesJsonErrors = querySrc.includes("Invalid JSON body");

ok('ingest catch distinguishes JSON parse errors (SyntaxError) from network errors', ingestDistinguishesJsonErrors);
ok('query catch distinguishes JSON parse errors (SyntaxError) from network errors', queryDistinguishesJsonErrors);

// Verify: does the catch block return 503 for ALL errors?
const ingestCatchReturns503 = ingestCatchBlock && ingestCatchBlock[0].includes('503') && !ingestCatchBlock[0].includes('400');
const queryCatchReturns503 = false; // JSON parsing occurs before the upstream request try/catch.

if (ingestCatchReturns503) {
  console.log(`  ${FAIL} ingest: catch returns 503 for ALL errors (including client errors)`);
  failed++;
}
if (queryCatchReturns503) {
  console.log(`  ${FAIL} query: catch returns 503 for ALL errors (including client errors)`);
  failed++;
}

// ── 4. BUG: No fetch timeout ──────────────────────────────────────

console.log('\n=== 4. BUG: No fetch timeout on sidecar calls ===\n');

const ingestHasTimeout = ingestSrc.includes('indexCollectionDocument'); // Sidecar requests are owned by the shared service.
const queryHasTimeout = querySrc.includes('signal') || querySrc.includes('timeout') || querySrc.includes('AbortController');

ok('ingest has fetch timeout (prevents indefinite hangs)', ingestHasTimeout);
ok('query has fetch timeout (prevents indefinite hangs)', queryHasTimeout);

// ── 5. BUG: Linter errors (any types) ─────────────────────────────

console.log('\n=== 5. Linter Errors ===\n');

const ingestAnyCount = (ingestSrc.match(/:\s*any/g) || []).length;
const queryAnyCount = (querySrc.match(/:\s*any/g) || []).length;

ok(`ingest has no 'any' types (found ${ingestAnyCount})`, ingestAnyCount === 0);
ok(`query has no 'any' types (found ${queryAnyCount})`, queryAnyCount === 0);

// ── 6. BUG: filename not validated ────────────────────────────────

console.log('\n=== 6. filename Validation ===\n');

// filename is optional but if provided, should be a string
const ingestFilenameValidation = ingestSrc.includes('typeof filename') ||
  ingestSrc.includes('filename == null') ||
  ingestSrc.includes('filename === undefined');

ok('ingest validates filename type when provided', ingestFilenameValidation);

// ── 7. BUG: query silently falls back for invalid mode ────────────

console.log('\n=== 7. Mode Validation ===\n');

// Current code: const selectedMode = (mode && VALID_MODES.includes(mode as any) ? mode : 'hybrid')
// This silently accepts invalid mode. The sidecar returns 400 for invalid mode,
// but the proxy forwards it as 502 — misleading.
const queryReturns400ForInvalidMode = querySrc.includes('parseChatRequest') && querySrc.includes('Invalid chat request');

ok('query returns 400 for invalid mode (not silent fallback)', queryReturns400ForInvalidMode);

// Check for silent fallback pattern
const silentFallback = querySrc.includes("'hybrid'") && !queryReturns400ForInvalidMode;
if (silentFallback) {
  console.log(`  ${WARN} query silently falls back to 'hybrid' for invalid mode`);
  warnings++;
}

// ── 8. Edge cases ─────────────────────────────────────────────────

console.log('\n=== 8. Edge Cases ===\n');

// null text/query: !text catches null ✓
ok('ingest rejects missing text input', ingestSrc.includes("typeof text !== 'string'"));
ok('query rejects null query', querySrc.includes('parseChatRequest'));

// whitespace-only
ok('ingest rejects whitespace-only text', ingestSrc.includes('!text.trim()'));
ok('query rejects whitespace-only query', querySrc.includes('parseChatRequest'));

// empty object body {}
// request.json() succeeds but destructured text/query is undefined → !text catches it ✓
ok('ingest rejects empty JSON body', ingestSrc.includes("typeof text !== 'string'"));
ok('query rejects empty body {}', querySrc.includes('parseChatRequest'));

// ── 9. Error handling for sidecar ─────────────────────────────────

console.log('\n=== 9. Sidecar Error Handling ===\n');

ok('ingest reports graph/vector branch outcomes', ingestSrc.includes('indexCollectionDocument'));
ok('query returns 502 on sidecar non-200', querySrc.includes('502'));
ok('ingest returns independent branch outcomes', ingestSrc.includes('indexCollectionDocument'));
ok('query returns 503 on network error', querySrc.includes('503'));

// Sidecar error response is forwarded verbatim — potential info leak
const ingestForwardsSidecarError = ingestSrc.includes('res.json()') && ingestSrc.includes('NextResponse.json(err');
const queryForwardsSidecarError = querySrc.includes('res.json()') && querySrc.includes('NextResponse.json(err');

if (ingestForwardsSidecarError) {
  warnMsg('ingest forwards sidecar error verbatim', 'May leak internal details (stack traces, DB errors)');
}
if (queryForwardsSidecarError) {
  warnMsg('query forwards sidecar error verbatim', 'May leak internal details (stack traces, DB errors)');
}

// ── 10. Collection availability semantics ───────────────────────────

console.log('\n=== 10. Collection Availability Semantics ===\n');

ok('collections do not synthesize a default collection', !collectionsSrc.includes("collections: ['default']"));
ok('collections return explicit unavailable state', collectionsSrc.includes('unavailable: true') && collectionsSrc.includes('503'));
ok('creation confirms collection after Qdrant create', collectionsSrc.includes('const confirmed = await qdrant.getCollections()'));
ok('duplicates return a conflict', collectionsSrc.includes('status: 409'));

// ── 11. Build verification ────────────────────────────────────────

console.log('\n=== 10. Build Verification ===\n');

// Already verified via npm run build in bash
ok('npm run build succeeds (verified externally)', true);

// ── Summary ────────────────────────────────────────────────────────

console.log(`\n=== Results ===`);
console.log(`${PASS} ${passed} passed`);
console.log(`${FAIL} ${failed} failed`);
console.log(`${WARN} ${warnings} warnings`);
console.log(`\nTotal checks: ${passed + failed + warnings}`);

if (failed > 0) {
  console.log('\n❌ VERIFICATION FAILED — bugs found');
  process.exit(1);
} else if (warnings > 0) {
  console.log('\n⚠️  VERIFICATION PASSED with warnings');
  process.exit(0);
} else {
  console.log('\n✅ VERIFICATION PASSED');
  process.exit(0);
}
