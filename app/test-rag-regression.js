#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Adversarial regression tests for Step 7: Frontend RAG Styles (page.module.css)
 * Tests CSS completeness, parity with original inline styles, edge cases, and rubric compliance.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CSS_PATH = path.join(__dirname, 'app/page.module.css');
const TSX_PATH = path.join(__dirname, 'app/page.tsx');
const GLOBALS_PATH = path.join(__dirname, 'app/globals.css');

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName, detail = '') {
  if (condition) {
    passed++;
    results.push(`✅ PASS: ${testName}`);
  } else {
    failed++;
    results.push(`❌ FAIL: ${testName}${detail ? ' — ' + detail : ''}`);
  }
}

const css = fs.readFileSync(CSS_PATH, 'utf8');
const tsx = fs.readFileSync(TSX_PATH, 'utf8');
const globals = fs.readFileSync(GLOBALS_PATH, 'utf8');

// ============================================================
// RUBRIC: Step 7 verification criteria
// ============================================================

// R1: CSS classes exist for: RAG query input, mode dropdown, query button, answer display, ingestion textarea, file dropzone
const ragClasses = ['ragAnswer', 'ragLoading', 'ragLoadingText', 'ragIngestRow', 'ragIngestTextarea', 'ragIngestBtn'];
const definedClasses = new Set();
css.replace(/(?:^|[\s,])\.([a-zA-Z_]\w*)/gm, (_, c) => { definedClasses.add(c); return _; });

for (const cls of ragClasses) {
  assert(definedClasses.has(cls), `[Rubric R1] RAG class .${cls} exists`);
}

// R2: Uses existing CSS custom properties
const ragSection = css.substring(css.indexOf('/* RAG Query Panel */'));
const cssVarRefs = [...ragSection.matchAll(/var\((--[\w-]+)\)/g)].map(m => m[1]);
const globalVars = [...globals.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]);
const missingVars = [...new Set(cssVarRefs)].filter(v => !globalVars.includes(v));
assert(missingVars.length === 0, '[Rubric R2] All CSS custom properties defined in globals',
  missingVars.length > 0 ? `Missing: ${missingVars.join(', ')}` : '');

// R3: Glassmorphism styling matches existing cards
const cardMatch = css.match(/\.card\s*{([^}]+)}/);
assert(cardMatch && cardMatch[1].includes('backdrop-filter'), '[Rubric R3] Card has glassmorphism');

// R4: Responsive at existing breakpoints
assert(css.includes('@media (max-width: 1280px)'), '[Rubric R4] 1280px breakpoint');
assert(css.includes('@media (max-width: 768px)'), '[Rubric R4] 768px breakpoint');

// R5: No CSS conflicts with existing classes
const ragClassNames = [...definedClasses].filter(c => c.startsWith('rag'));
const criticalClasses = ['card', 'btn', 'input', 'select', 'dropzone', 'container', 'header', 'mainGrid'];
const conflicts = ragClassNames.filter(c => criticalClasses.includes(c));
assert(conflicts.length === 0, '[Rubric R5] No RAG class name conflicts',
  conflicts.length > 0 ? `Conflicts: ${conflicts.join(', ')}` : '');

// R6: Build succeeds
try {
  execSync('npm run build', { cwd: __dirname, stdio: 'pipe', timeout: 60000 });
  assert(true, '[Rubric R6] npm run build succeeds');
} catch (e) {
  assert(false, '[Rubric R6] npm run build succeeds', e.message.substring(0, 200));
}

// ============================================================
// ADVERSARIAL: Edge cases and production outage checks
// ============================================================

// A1: All TSX-referenced CSS classes are defined (runtime crash prevention)
const usedClasses = new Set();
tsx.replace(/styles\.(\w+)/g, (_, c) => { usedClasses.add(c); return _; });
const missing = [...usedClasses].filter(c => !definedClasses.has(c));
assert(missing.length === 0, '[A1] All TSX CSS references resolve (no runtime undefined)',
  missing.length > 0 ? `Missing: ${missing.join(', ')}` : '');

// A2: CSS syntax validity (balanced braces)
const openBraces = (css.match(/{/g) || []).length;
const closeBraces = (css.match(/}/g) || []).length;
assert(openBraces === closeBraces, '[A2] CSS braces balanced',
  `Open: ${openBraces}, Close: ${closeBraces}`);

// A3: All referenced keyframes exist (across globals + module)
const allCss = css + '\n' + globals;
const animationRefs = [...new Set([...allCss.matchAll(/animation:\s*([-\w]+)/g)].map(m => m[1]))];
const keyframeDefs = [...allCss.matchAll(/@keyframes\s+([-\w]+)/g)].map(m => m[1]);
const missingKeyframes = animationRefs.filter(a => !keyframeDefs.includes(a));
assert(missingKeyframes.length === 0, '[A3] All keyframes defined',
  missingKeyframes.length > 0 ? `Missing: ${missingKeyframes.join(', ')}` : '');

// A4: .ragAnswer has white-space: pre-wrap (spec requirement for answer display)
const ragAnswerMatch = css.match(/\.ragAnswer\s*{([^}]+)}/);
assert(ragAnswerMatch && ragAnswerMatch[1].includes('white-space: pre-wrap'),
  '[A4] .ragAnswer has white-space: pre-wrap');

// A5: .ragAnswer has scroll containment (prevents layout explosion with long answers)
assert(ragAnswerMatch && ragAnswerMatch[1].includes('max-height'),
  '[A5] .ragAnswer has max-height');
assert(ragAnswerMatch && ragAnswerMatch[1].includes('overflow-y'),
  '[A5] .ragAnswer has overflow-y');

// A6: No CSS that hides critical elements
const dangerousProps = ragSection.match(/(display:\s*none|visibility:\s*hidden|opacity:\s*0[^.]|position:\s*absolute)/g);
assert(!dangerousProps || dangerousProps.length === 0, '[A6] No CSS hiding RAG elements',
  dangerousProps ? dangerousProps.join('; ') : '');

// A7: .ragIngestTextarea composes correctly with .input
const ragIngestTextMatch = css.match(/\.ragIngestTextarea\s*{([^}]+)}/);
assert(ragIngestTextMatch && ragIngestTextMatch[1].includes('flex'),
  '[A7] .ragIngestTextarea has flex');
assert(ragIngestTextMatch && ragIngestTextMatch[1].includes('resize'),
  '[A7] .ragIngestTextarea has resize');

// A8: .ragIngestRow uses flex layout
const ragIngestRowMatch = css.match(/\.ragIngestRow\s*{([^}]+)}/);
assert(ragIngestRowMatch && ragIngestRowMatch[1].includes('display: flex'),
  '[A8] .ragIngestRow uses flex');

// A9: .ragLoading uses flex for spinner + text alignment
const ragLoadingMatch = css.match(/\.ragLoading\s*{([^}]+)}/);
assert(ragLoadingMatch && ragLoadingMatch[1].includes('display: flex'),
  '[A9] .ragLoading uses flex layout');

// A10: .ragIngestBtn height doesn't clip text (>= 36px with border-box)
const ragIngestBtnMatch = css.match(/\.ragIngestBtn\s*{([^}]+)}/);
const btnHeight = ragIngestBtnMatch ? ragIngestBtnMatch[1].match(/height:\s*(\d+)px/) : null;
assert(btnHeight && parseInt(btnHeight[1]) >= 36,
  '[A10] .ragIngestBtn height sufficient for text (>= 36px)',
  btnHeight ? `Height: ${btnHeight[1]}px` : 'No height defined');

// A11: Inline style → CSS class parity check (query row)
// Original: display: flex, gap: 0.5rem, alignItems: flex-end, flexWrap: wrap
// CSS: display: flex, gap: 0.5rem, align-items: flex-end
// Inline preserved: flexWrap: wrap
assert(ragIngestRowMatch && ragIngestRowMatch[1].includes('gap: 0.5rem'),
  '[A11] .ragIngestRow gap matches original inline style');

// A12: Inline style → CSS class parity check (loading state)
// Original: display: flex, alignItems: center, gap: 0.75rem, padding: 1rem 0
assert(ragLoadingMatch && ragLoadingMatch[1].includes('align-items: center'),
  '[A12] .ragLoading align-items matches original');
assert(ragLoadingMatch && ragLoadingMatch[1].includes('gap: 0.75rem'),
  '[A12] .ragLoading gap matches original');
assert(ragLoadingMatch && ragLoadingMatch[1].includes('padding: 1rem 0'),
  '[A12] .ragLoading padding matches original');

// A13: Inline style → CSS class parity check (answer display)
// Original: background, border, borderRadius, padding, whiteSpace, fontSize, lineHeight, color, maxHeight, overflowY, paddingRight
assert(ragAnswerMatch && ragAnswerMatch[1].includes('rgba(79, 70, 229, 0.04)'),
  '[A13] .ragAnswer background matches original');
assert(ragAnswerMatch && ragAnswerMatch[1].includes('border: 1px solid rgba(79, 70, 229, 0.12)'),
  '[A13] .ragAnswer border matches original');
assert(ragAnswerMatch && ragAnswerMatch[1].includes('max-height: 400px'),
  '[A13] .ragAnswer max-height matches original');

// A14: RAG section in TSX uses CSS classes (not just inline styles)
const ragSectionTSX = tsx.substring(tsx.indexOf('RAG Query Section'));
const ragClassUsage = [...ragSectionTSX.matchAll(/styles\.rag\w+/g)];
assert(ragClassUsage.length >= 6, '[A14] RAG section uses CSS classes',
  `Found ${ragClassUsage.length} RAG class usages`);

// A15: No hardcoded colors in RAG CSS (uses design tokens)
const hardcodedColors = [...ragSection.matchAll(/#[0-9a-fA-F]{3,8}/g)];
assert(hardcodedColors.length <= 2, '[A15] RAG CSS uses design tokens',
  `Found ${hardcodedColors.length} hardcoded color refs`);

// A16: TypeScript compiles without errors
try {
  execSync('npx tsc --noEmit', { cwd: __dirname, stdio: 'pipe', timeout: 30000 });
  assert(true, '[A16] TypeScript compiles cleanly');
} catch (e) {
  assert(false, '[A16] TypeScript compiles cleanly', e.message.substring(0, 200));
}

// A17: RAG section doesn't break existing sections (regression check)
// Check that existing CSS classes are unchanged
const existingClasses = ['card', 'btn', 'input', 'select', 'dropzone', 'mainGrid', 'header'];
for (const cls of existingClasses) {
  const hasClass = new RegExp('\\.' + cls + '[\\s,{]').test(css);
  assert(hasClass, `[A17] Existing class .${cls} still defined`);
}

// A18: CSS module doesn't have duplicate class definitions
const classDefCounts = {};
const classDefRegex = /^\s*\.(\\w+)\s*{/gm;
let match;
while ((match = classDefRegex.exec(css)) !== null) {
  const cls = match[1];
  classDefCounts[cls] = (classDefCounts[cls] || 0) + 1;
}
const duplicates = Object.entries(classDefCounts).filter(([_, count]) => count > 1);
// Duplicates are OK for pseudo-selectors (:hover, :focus) but not for base classes
assert(duplicates.length === 0 || duplicates.every(([cls]) => !ragClassNames.includes(cls)),
  '[A18] No duplicate RAG class definitions',
  duplicates.length > 0 ? `Duplicates: ${duplicates.map(([c]) => c).join(', ')}` : '');

// ============================================================
// Summary
// ============================================================
console.log('\n=== Step 7: Frontend RAG Styles — Regression Test Results ===\n');
results.forEach(r => console.log(r));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
