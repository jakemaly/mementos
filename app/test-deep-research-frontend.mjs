/** Focused static checks for the Deep Research composer/workspace shell. */
import * as fs from 'fs';

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
let passed = 0;
let failed = 0;

function ok(name, condition) {
  console.log(`${condition ? PASS : FAIL} ${name}`);
  condition ? passed++ : failed++;
}

const root = fs.readFileSync('app/components/deep-research/DeepResearch.tsx', 'utf8');
const composer = fs.readFileSync('app/components/deep-research/ResearchComposer.tsx', 'utf8');
const workspace = fs.readFileSync('app/components/deep-research/ResearchWorkspace.tsx', 'utf8');
const css = fs.readFileSync('app/components/deep-research/deep-research.module.css', 'utf8');
const state = fs.readFileSync('app/components/deep-research/research-state.ts', 'utf8');
const graph = fs.readFileSync('app/components/deep-research/ExecutionGraph.tsx', 'utf8');

console.log('\n=== Composer ===\n');
ok('Composer renders one query textarea', composer.includes('aria-label="Research query"'));
ok('Composer renders collection selector', composer.includes('aria-label="Target collection"'));
ok('Composer supports Shift+Enter newline behavior', composer.includes('e.shiftKey'));
ok('Composer prevents default Enter submission', composer.includes('e.preventDefault()'));
ok('Composer has accessible submit action', composer.includes('aria-label="Start research"'));

console.log('\n=== Run lifecycle ===\n');
ok('Explicit run states exist', root.includes("'starting'") && root.includes("'researching'") && root.includes("'ingested'"));
ok('Request sends query only', root.includes("JSON.stringify({ query: query.trim() })"));
ok('AbortController is used', root.includes('new AbortController') && root.includes('signal: abortController.signal'));
ok('Cancel returns to idle', root.includes('setRunState(\'idle\')') && root.includes('clearRun()'));
ok('Stale runs are ignored', root.includes('isCurrentRun(runId)'));
ok('Source selection uses canonical URL keys', state.includes('canonicalSourceKey'));
ok('Live sources are merged without duplicates', root.includes('mergeSources(prev, newSources)'));
ok('Deselections survive final reconciliation', root.includes('reconcileFinalSources(finalSources'));
ok('New sources default to selected', root.includes('selectDiscoveredSources(prev, newSources'));

console.log('\\n=== Event-derived graph ===\\n');
ok('Graph derives tool nodes from tool_started events', graph.includes("event.type === 'tool_started'"));
ok('Graph folds completion into invocation status', graph.includes('completionByParent'));
ok('Graph preserves completed nodes', graph.includes("status = completion?.type"));
ok('Graph renders explicit loop edges', graph.includes("label: 'continue'"));
ok('Graph exposes keyboard node selection', graph.includes('tabIndex={0}') && graph.includes('aria-pressed={selected}'));

console.log('\n=== Workspace ===\n');
ok('Workspace has graph pane', workspace.includes('aria-label="Execution graph"'));
ok('Workspace has sketch pane', workspace.includes('aria-label="Research sketch"'));
ok('Workspace has observability pane', workspace.includes('aria-label="Observability"'));
ok('Workspace has sources pane', workspace.includes('aria-label="Sources"'));
ok('Workspace has cancel action', workspace.includes('aria-label="Cancel research"'));
ok('Workspace has new research action', workspace.includes('aria-label="New research"'));

console.log('\n=== Design constraints ===\n');
ok('No gradients in Deep Research CSS', !css.includes('gradient'));
ok('Responsive layout exists', css.includes('@media (max-width: 768px)'));
ok('1024px remains two-column', css.includes('@media (max-width: 900px)'));
ok('Mobile panes use graph/sketch/observability/sources order', css.includes('order: 1') && css.includes('order: 2') && css.includes('order: 3') && css.includes('order: 4'));
ok('Visible focus styles exist', css.includes(':focus-visible'));
ok('Cherry accent is scoped', css.includes('var(--accent)'));

console.log(`\n${PASS} ${passed} passed`);
console.log(`${FAIL} ${failed} failed`);
if (failed) process.exit(1);
