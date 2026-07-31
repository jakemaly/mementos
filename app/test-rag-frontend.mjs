/** Focused static checks for the redesigned Knowledge Base. */
import * as fs from 'fs';

let passed = 0;
let failed = 0;
function ok(name, condition) {
  console.log(`${condition ? '✓' : '✗'} ${name}`);
  if (condition) passed++; else failed++;
}

const page = fs.readFileSync('app/page.tsx', 'utf8');
const knowledgeBase = fs.readFileSync('app/components/knowledge-base/KnowledgeBase.tsx', 'utf8');
const vectorSearch = fs.readFileSync('app/components/knowledge-base/VectorSearch.tsx', 'utf8');
const ragChat = fs.readFileSync('app/components/knowledge-base/RagChat.tsx', 'utf8');
const chatComposer = fs.readFileSync('app/components/knowledge-base/ChatComposer.tsx', 'utf8');
const citations = fs.readFileSync('app/components/knowledge-base/CitationList.tsx', 'utf8');
const drawer = fs.readFileSync('app/components/collections/CollectionsDrawer.tsx', 'utf8');
const drawerCss = fs.readFileSync('app/components/collections/collections-drawer.module.css', 'utf8');
const globals = fs.readFileSync('app/globals.css', 'utf8');
const knowledgeBaseCss = fs.readFileSync('app/components/knowledge-base/knowledge-base.module.css', 'utf8');

console.log('\n=== Knowledge Base redesign ===\n');
ok('page composes Deep Research and Knowledge Base views', page.includes('<DeepResearch') && page.includes('<KnowledgeBase'));
ok('legacy dashboard state is removed', !page.includes('ragMode') && !page.includes('ragIngestText') && !page.includes('sessionCounts'));
ok('Chat is the default local view', knowledgeBase.includes("useState<LocalView>('chat')"));
ok('Collection changes reset chat without a confirmation popup', knowledgeBase.includes('setChatKey((key) => key + 1)') && !knowledgeBase.includes('window.confirm'));
ok('text-labelled local view switch exists', knowledgeBase.includes('>Chat</button>') && knowledgeBase.includes('>Vector Search</button>'));
ok('archive dossier names the active collection context', knowledgeBase.includes('Archive dossier') && knowledgeBase.includes('selectedCollection'));
ok('tabs expose keyboard and tab-panel semantics', knowledgeBase.includes('aria-controls') && knowledgeBase.includes('ArrowRight') && knowledgeBase.includes('role="tabpanel"'));
ok('Chat and Vector Search retain in-session state while switching', knowledgeBase.includes("hidden={view !== 'chat'}") && knowledgeBase.includes("hidden={view !== 'vector'}"));
ok('Vector Search clears state on collection changes', vectorSearch.includes('}, [selectedCollection])'));
ok('Vector Search supports 5, 10, and 20 results', vectorSearch.includes('[5, 10, 20]'));
ok('Vector results show source, snippet, and score', vectorSearch.includes('result.filename') && vectorSearch.includes('result.score.toFixed(2)') && !vectorSearch.includes('charStart'));
ok('snippet disclosure is keyboard-accessible', vectorSearch.includes('aria-expanded={expanded.has(result.id)}'));
ok('Chat sends collection-bound SSE requests', ragChat.includes("fetch('/api/rag/query'") && ragChat.includes('collection, turn_id: turnId, history'));
ok('Chat supports Stop, New chat, and Copy', ragChat.includes('controllerRef.current?.abort()') && ragChat.includes('>New chat</button>') && ragChat.includes('navigator.clipboard.writeText(message.content)'));
ok('Chat rejects late events and bounds history', ragChat.includes('turnRef.current !== turnId') && ragChat.includes('.slice(-20)'));
ok('Composer supports Enter send and Shift+Enter newline', chatComposer.includes("event.key === 'Enter' && !event.shiftKey"));
ok('Chat composer includes collection selection', ragChat.includes('onCollectionChange(event.target.value)'));
ok('Chat composer is a semantic form with readable guidance', chatComposer.includes('<form') && chatComposer.includes('Shift+Enter'));
ok('Chat shows explicit readable turn states', ragChat.includes('Answer ready') && ragChat.includes('Retrieving evidence') && ragChat.includes('Stopped'));
ok('Chat shows Qdrant and LightRAG collection statistics', ragChat.includes('/stats`,') && ragChat.includes('stats.qdrant.points') && ragChat.includes('stats.lightrag.nodes'));
ok('Chat can explicitly backfill LightRAG from Qdrant', ragChat.includes('Index Qdrant in LightRAG') && ragChat.includes('lightrag-backfill') && ragChat.includes('setBackfilling(true)'));
ok('Chat renders deduplicated sources and inline markers', ragChat.includes("event === 'sources'") && ragChat.includes('href={`#source-${message.id}-${source.id}`}'));
ok('external citations are safe and local sources stay text', citations.includes('rel="noreferrer"') && citations.includes('source.path'));
ok('citations are grouped as a source index', citations.includes('Source index') && citations.includes('aria-labelledby'));
ok('vector search reports explicit result state', vectorSearch.includes("status === 'results'") && vectorSearch.includes('matches'));
ok('dossier styling provides an asymmetric spine and soft paper boundary', knowledgeBaseCss.includes('.spine') && knowledgeBaseCss.includes('.paper') && knowledgeBaseCss.includes('clip-path'));
ok('drawer is hidden by default and uses dialog semantics', drawer.includes('if (!open) return null') && drawer.includes('role="dialog"'));
ok('drawer retains a partial-failure file and restores focus', drawer.includes("if (data.status === 'complete') setFile(null)") && drawer.includes("getElementById('collections-trigger')?.focus()"));
ok('drawer traps Tab focus while open', drawer.includes("event.key === 'Tab'") && drawer.includes('drawerRef.current.querySelectorAll'));
ok('drawer closes when its backdrop is clicked', drawer.includes('event.target === event.currentTarget') && drawer.includes('requestClose()'));
ok('drawer is full-width on narrow screens', drawerCss.includes('@media (max-width: 768px)') && drawerCss.includes('width: 100%'));

console.log('\n=== Accessibility and Responsive Quality ===\n');
ok('global surface is matte rather than gradient', !globals.includes('radial-gradient'));
ok('global visible focus treatment exists', globals.includes(':focus-visible') && globals.includes('--red-bright'));
ok('reduced motion is respected globally', globals.includes('prefers-reduced-motion: reduce'));
ok('streamed tokens are not individually announced', ragChat.includes('aria-live="off"') && ragChat.includes('role="status"'));
ok('shell prevents narrow-screen horizontal overflow', fs.readFileSync('app/components/app-shell/app-shell.module.css', 'utf8').includes('overflow-x: hidden'));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
