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

console.log('\n=== Knowledge Base redesign ===\n');
ok('page composes Deep Research and Knowledge Base views', page.includes('<DeepResearch') && page.includes('<KnowledgeBase'));
ok('legacy dashboard state is removed', !page.includes('ragMode') && !page.includes('ragIngestText') && !page.includes('sessionCounts'));
ok('Chat is the default local view', knowledgeBase.includes("useState<'chat' | 'vector'>('chat')"));
ok('text-labelled local view switch exists', knowledgeBase.includes('>Chat</button>') && knowledgeBase.includes('>Vector Search</button>'));
ok('Vector Search clears state on collection changes', vectorSearch.includes('}, [selectedCollection])'));
ok('Vector Search supports 5, 10, and 20 results', vectorSearch.includes('[5, 10, 20]'));
ok('Vector results show source, snippet, and score', vectorSearch.includes('result.filename') && vectorSearch.includes('result.score.toFixed(2)') && !vectorSearch.includes('charStart'));
ok('snippet disclosure is keyboard-accessible', vectorSearch.includes('aria-expanded={expanded.has(result.id)}'));
ok('Chat sends collection-bound SSE requests', ragChat.includes("fetch('/api/rag/query'") && ragChat.includes('collection, turn_id: turnId, history'));
ok('Chat supports Stop, New chat, and Copy', ragChat.includes('controllerRef.current?.abort()') && ragChat.includes('>New chat</button>') && ragChat.includes('navigator.clipboard.writeText(message.content)'));
ok('Chat rejects late events and bounds history', ragChat.includes('turnRef.current !== turnId') && ragChat.includes('.slice(-20)'));
ok('Composer supports Enter send and Shift+Enter newline', chatComposer.includes("event.key === 'Enter' && !event.shiftKey"));
ok('Chat composer includes collection selection', ragChat.includes('onCollectionChange(event.target.value)'));
ok('Chat renders deduplicated sources and inline markers', ragChat.includes("event === 'sources'") && ragChat.includes('href={`#source-${source.id}`}'));
ok('external citations are safe and local sources stay text', citations.includes('rel="noreferrer"') && citations.includes('<span>[{index + 1}] {source.path}</span>'));
ok('drawer is hidden by default and uses dialog semantics', drawer.includes('if (!open) return null') && drawer.includes('role="dialog"'));
ok('drawer retains a partial-failure file and restores focus', drawer.includes("if (data.status === 'complete') setFile(null)") && drawer.includes("getElementById('collections-trigger')?.focus()"));
ok('drawer traps Tab focus while open', drawer.includes("event.key === 'Tab'") && drawer.includes('drawerRef.current.querySelectorAll'));
ok('drawer closes when its backdrop is clicked', drawer.includes('event.target === event.currentTarget') && drawer.includes('requestClose()'));
ok('drawer is full-width on narrow screens', drawerCss.includes('@media (max-width: 768px)') && drawerCss.includes('width: 100%'));

console.log('\n=== Accessibility and Responsive Quality ===\n');
ok('global surface is matte rather than gradient', !globals.includes('radial-gradient'));
ok('global visible focus treatment exists', globals.includes('button:focus-visible') && globals.includes('#9f1239'));
ok('reduced motion is respected globally', globals.includes('prefers-reduced-motion: reduce'));
ok('streamed tokens are not individually announced', ragChat.includes('aria-live="off"') && ragChat.includes('role="status"'));
ok('shell prevents narrow-screen horizontal overflow', fs.readFileSync('app/components/app-shell/app-shell.module.css', 'utf8').includes('overflow-x: hidden'));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
