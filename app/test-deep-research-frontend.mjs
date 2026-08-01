/** Focused static checks for the Deep Research composer/workspace shell. */
import * as fs from 'fs';

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
let passed = 0;
let failed = 0;

function ok(name, condition) {
  console.log(`${condition ? PASS : FAIL} ${name}`);
  if (condition) passed++; else failed++;
}

const root = fs.readFileSync('app/components/deep-research/DeepResearch.tsx', 'utf8');
const page = fs.readFileSync('app/page.tsx', 'utf8');
const shell = fs.readFileSync('app/components/app-shell/AppShell.tsx', 'utf8');
const shellCss = fs.readFileSync('app/components/app-shell/app-shell.module.css', 'utf8');
const composer = fs.readFileSync('app/components/deep-research/ResearchComposer.tsx', 'utf8');
const workspace = fs.readFileSync('app/components/deep-research/ResearchWorkspace.tsx', 'utf8');
const css = fs.readFileSync('app/components/deep-research/deep-research.module.css', 'utf8');
const globals = fs.readFileSync('app/globals.css', 'utf8');
const state = fs.readFileSync('app/components/deep-research/research-state.ts', 'utf8');
const graph = fs.readFileSync('app/components/deep-research/ExecutionGraph.tsx', 'utf8');
const timeline = fs.readFileSync('app/components/deep-research/ObservabilityTimeline.tsx', 'utf8');
const sources = fs.readFileSync('app/components/deep-research/SourceList.tsx', 'utf8');

console.log('\n=== Composer ===\n');
ok('Composer renders one query textarea', composer.includes('aria-label="Research query"'));
ok('Composer renders collection selector', composer.includes('aria-label="Target collection"'));
ok('Composer supports Shift+Enter newline behavior', composer.includes('e.shiftKey'));
ok('Composer prevents default Enter submission', composer.includes('e.preventDefault()'));
ok('Composer has accessible submit action', composer.includes('aria-label="Start research"'));
ok('Composer uses a visible start label', composer.includes('>Start research'));
ok('Composer labels the target collection visibly', composer.includes('Save evidence to'));
ok('Composer fields have stable form names', composer.includes('name="query"') && composer.includes('name="collection"'));
ok('Composer omits the redundant prompt header', !composer.includes('dialoguePrompt'));
ok('Composer uses one dialogue surface', composer.includes('dialogueStage') && composer.includes('dialogueFrame'));
ok('Composer uses the reference frame and Optima font', css.includes('/p5-dialogue/images/db-main-medium.png') && css.includes('OptimaNovaLT-Black.woff2'));
ok('Composer uses the full dotted page treatment', css.includes('backgroundDot.png') && css.includes('background-size: cover'));
ok('Composer gives the question a substantial writing area', css.includes('min-height: 14rem'));
ok('Composer has a dedicated narrow layout', css.includes('@media (max-width: 480px)') && css.includes('.dialogueContent'));
ok('Composer keeps disabled action text readable', css.includes('.dialogueSubmit:disabled') && css.includes('color: #d7c9cb'));
ok('Dialogue surface stays transparent over the page background', css.includes('border: 0;\n  background: transparent;'));
ok('Mementos uses the requested angle and lower placement', css.includes('top: clamp(5.25rem, 8vw, 7.25rem)') && css.includes('rotate(-25deg)'));
ok('Mementos matches the heading shadow treatment', css.includes('text-shadow: 0.055em 0.055em 0 #111') && css.includes('-webkit-text-stroke: 1px #111'));
ok('Mementos is sized as a focal label', css.includes('font-size: clamp(1.35rem, 3vw, 2.25rem)'));
ok('Textarea surface is visually invisible', css.includes('border: 0;\n  border-radius: 0;\n  background: transparent;'));
ok('Textarea is inset toward the frame center', css.includes('width: calc(100% - clamp(3rem, 6vw, 6rem))') && css.includes('margin-inline: auto'));
ok('Footer action is larger and anchored low', css.includes('min-width: 13rem') && css.includes('min-height: 3.35rem') && css.includes('8.5rem) 0.75rem'));
ok('Footer controls share a vertical rhythm', css.includes('.dialogueSelect') && css.includes('min-height: 3.35rem'));
ok('Navigator uses a question-first heading', root.includes('Begin with the question.'));
ok('Composer uses the shared application shell', root.includes('<AppShell activeDestination="research"'));
ok('Shell has semantic main navigation', shell.includes('aria-label="Main navigation"'));
ok('Shell exposes destination actions', shell.includes('Deep Research') && shell.includes('Knowledge Base') && shell.includes('Collections'));
ok('Shell includes disabled future Settings', shell.includes('Settings (not available yet)'));
ok('Shell uses compact non-clipping mobile navigation', shellCss.includes('@media (max-width: 768px)') && shellCss.includes('flex-wrap: wrap') && shellCss.includes('overflow-x: hidden'));
ok('Shell identifies Mementos as a research notebook', shell.includes('A research notebook'));
ok('Shell keeps destination helper text readable', shell.includes('Ask a question') && shell.includes('Review evidence'));
ok('Shared visual tokens use paper and cherry red', globals.includes('--paper: #f5f1e9') && globals.includes('--red: #b7193b') && globals.includes('--font-display: Georgia'));
ok('Page owns collection loading', page.includes("fetch('/api/collections')") && page.includes('setCollectionUnavailable'));
ok('Deep Research receives shared collection state', root.includes('collectionUnavailable: boolean') && root.includes('onCollectionChange: (collection: string) => void'));
ok('Deep Research does not refetch collections', !root.includes("fetch('/api/collections')"));

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
ok('Import waits for completed research', root.includes("runState === 'researching'") && root.includes('ingestDisabled'));
ok('Source selection uses canonical keys for imports', root.includes('selectedSourceKeys.has(canonicalSourceKey(source.url))'));

console.log('\\n=== Event-derived graph ===\\n');
ok('Graph derives tool nodes from tool_started events', graph.includes("event.type === 'tool_started'"));
ok('Graph folds completion into invocation status', graph.includes('completionByParent'));
ok('Graph preserves completed nodes', graph.includes("status = completion?.type"));
ok('Graph renders explicit loop edges', graph.includes("label: 'continue'"));
ok('Graph exposes keyboard node selection', graph.includes('type="button"') && graph.includes('aria-pressed={selected}'));
ok('Recoverable tool failures do not fail the route', graph.includes("const hasFailure = runState === 'failed' || trace.some((event) => event.type === 'error');"));
ok('Import stays outside the route topology', !graph.includes("id: 'import'"));
ok('Client failures do not create synthetic route nodes', !graph.includes("id: 'route-failure'"));
ok('Timeline renders terminal completion', timeline.includes('Research complete'));

console.log('\n=== Workspace ===\n');
ok('Workspace has graph pane', workspace.includes('aria-label="Execution graph"'));
ok('Workspace has sketch pane', workspace.includes('aria-label="Research sketch"'));
ok('Workspace has observability pane', workspace.includes('aria-label="Observability"'));
ok('Workspace has sources pane', workspace.includes('aria-label="Sources"'));
ok('Workspace has cancel action', workspace.includes('aria-label="Cancel research"'));
ok('Workspace has new research action', workspace.includes('aria-label="New research"'));
ok('Elapsed timer stays outside the live status region', workspace.includes('styles.statusContext') && !workspace.includes('<small className={styles.elapsed}>'));
ok('Route names the brief-to-evidence path', graph.includes('From brief to evidence'));
ok('Workspace makes the route map primary', workspace.includes('Route map') && workspace.includes('routePanel'));
ok('Workspace keeps import as the route handoff', workspace.includes('Import selected sources'));

console.log('\n=== Route and evidence presentation ===\n');
ok('Route is an ordered semantic map', graph.includes('<ol') && graph.includes('routeNode'));
ok('Route includes explicit stage labels', graph.includes('routeStages') && graph.includes('Upcoming'));
ok('Selected route nodes expose detail', graph.includes('routeDetail') && graph.includes('Status'));
ok('Route selection keeps related timeline detail', timeline.includes('aria-current') && timeline.includes('timelineItemFocused'));
ok('Route selection reveals related timeline detail', timeline.includes('scrollIntoView'));
ok('Live events do not reset trace selection scrolling', timeline.includes('}, [focusedNodeId]);'));
ok('Evidence is an ordered numbered list', sources.includes('<ol') && sources.includes('sourceNumber'));
ok('Evidence import action is explicit', sources.includes('Import selected sources'));
ok('Evidence selection status is announced', sources.includes('aria-live="polite"'));

console.log('\n=== Design constraints ===\n');
ok('No gradients in Deep Research CSS', !css.includes('gradient'));
ok('Responsive layout exists', css.includes('@media (max-width: 768px)'));
ok('1024px remains two-column', css.includes('@media (max-width: 900px)'));
ok('Mobile panes use graph/sketch/observability/sources order', css.includes('order: 1') && css.includes('order: 2') && css.includes('order: 3') && css.includes('order: 4'));
ok('Desktop panes remain constrained and scrollable', css.includes('@media (min-width: 769px)') && css.includes('overflow-y: auto'));
ok('Scrollable detail panes are keyboard-focusable', workspace.includes('styles.sketchPanel') && workspace.includes('styles.tracePanel') && workspace.includes('tabIndex={0}'));
ok('Visible focus styles exist', css.includes(':focus-visible'));
ok('Cherry accent is scoped', css.includes('--accent: #9f1239') && css.includes('var(--accent)'));
ok('Reduced motion is respected', css.includes('prefers-reduced-motion: reduce'));
ok('Settings entry is present', shell.includes('Settings (not available yet)'));

console.log(`\n${PASS} ${passed} passed`);
console.log(`${FAIL} ${failed} failed`);
if (failed) process.exit(1);
