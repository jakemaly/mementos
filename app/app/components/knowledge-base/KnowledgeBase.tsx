'use client';

import { useState } from 'react';
import { AppShell } from '@/app/components/app-shell/AppShell';
import { VectorSearch } from './VectorSearch';
import styles from './knowledge-base.module.css';

interface KnowledgeBaseProps {
  collections: string[];
  selectedCollection: string;
  unavailable: boolean;
  onCollectionChange: (collection: string) => void;
  onOpenResearch: () => void;
  onOpenCollections: () => void;
}

export function KnowledgeBase(props: KnowledgeBaseProps) {
  const [view, setView] = useState<'chat' | 'vector'>('vector');
  return <AppShell activeDestination="knowledge-base" onOpenResearch={props.onOpenResearch} onOpenCollections={props.onOpenCollections}>
    <main className={styles.workspace}>
      <header className={styles.header}><h1>Knowledge Base</h1><div className={styles.switcher} role="tablist" aria-label="Knowledge Base view">
        <button type="button" role="tab" aria-selected={view === 'chat'} onClick={() => setView('chat')}>Chat</button>
        <button type="button" role="tab" aria-selected={view === 'vector'} onClick={() => setView('vector')}>Vector Search</button>
      </div></header>
      {view === 'chat' ? <section className={styles.placeholder} aria-label="Chat"><h2>Chat</h2><p>Conversational RAG will appear here.</p></section> : <VectorSearch {...props} />}
    </main>
  </AppShell>;
}
