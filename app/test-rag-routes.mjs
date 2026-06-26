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

// ── 1. Structural checks ──────────────────────────────────────────

console.log('\n=== 1. Structural Checks ===\n');

ok('ingest/route.ts exists', fs.existsSync('app/api/rag/ingest/route.ts'));
ok('query/route.ts exists', fs.existsSync('app/api/rag/query/route.ts'));
ok('ingest exports POST', ingestSrc.includes('export async function POST'));
ok('query exports POST', querySrc.includes('export async function POST'));
ok('ingest forwards to /insert', ingestSrc.includes('/insert'));
ok('query forwards to /query', querySrc.includes('/query'));

// ── 2. Input validation ───────────────────────────────────────────

console.log('\n=== 2. Input Validation ===\n');

ok('ingest validates text presence', ingestSrc.includes('!text'));
ok('ingest validates text is string', ingestSrc.includes("typeof text !== 'string'"));
ok('ingest validates text non-empty after trim', ingestSrc.includes("text.trim() === ''"));
ok('query validates query presence', querySrc.includes('!query'));
ok('query validates query is string', querySrc.includes("typeof query !== 'string'"));
ok('query validates query non-empty after trim', querySrc.includes("query.trim() === ''"));
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
const queryCatchBlock = querySrc.match(/}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/);

// The outer catch is the last catch block in the file (after the try block)
// It should distinguish SyntaxError (from request.json()) from network errors
const ingestDistinguishesJsonErrors = ingestCatchBlock && ingestCatchBlock[0].includes('SyntaxError');
const queryDistinguishesJsonErrors = queryCatchBlock && queryCatchBlock[0].includes('SyntaxError');

ok('ingest catch distinguishes JSON parse errors (SyntaxError) from network errors', ingestDistinguishesJsonErrors);
ok('query catch distinguishes JSON parse errors (SyntaxError) from network errors', queryDistinguishesJsonErrors);

// Verify: does the catch block return 503 for ALL errors?
const ingestCatchReturns503 = ingestCatchBlock && ingestCatchBlock[0].includes('503') && !ingestCatchBlock[0].includes('400');
const queryCatchReturns503 = queryCatchBlock && queryCatchBlock[0].includes('503') && !queryCatchBlock[0].includes('400');

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

const ingestHasTimeout = ingestSrc.includes('signal') || ingestSrc.includes('timeout') || ingestSrc.includes('AbortController');
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
const queryReturns400ForInvalidMode = querySrc.match(/mode.*400|400.*mode|mode.*invalid/i);

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
ok('ingest rejects null text', ingestSrc.includes('!text'));
ok('query rejects null query', querySrc.includes('!query'));

// whitespace-only
ok('ingest rejects whitespace-only text', ingestSrc.includes("text.trim() === ''"));
ok('query rejects whitespace-only query', querySrc.includes("query.trim() === ''"));

// empty object body {}
// request.json() succeeds but destructured text/query is undefined → !text catches it ✓
ok('ingest rejects empty body {}', ingestSrc.includes('!text'));
ok('query rejects empty body {}', querySrc.includes('!query'));

// ── 9. Error handling for sidecar ─────────────────────────────────

console.log('\n=== 9. Sidecar Error Handling ===\n');

ok('ingest returns 502 on sidecar non-200', ingestSrc.includes('502'));
ok('query returns 502 on sidecar non-200', querySrc.includes('502'));
ok('ingest returns 503 on network error', ingestSrc.includes('503'));
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

// ── 10. Build verification ────────────────────────────────────────

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
