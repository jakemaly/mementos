'use client';

import { useState } from 'react';
import { AppShell } from '@/app/components/app-shell/AppShell';
import { VectorSearch } from './VectorSearch';
import { RagChat } from './RagChat';
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
  const [view, setView] = useState<'chat' | 'vector'>('chat');
  const [chatKey, setChatKey] = useState(0);
  const changeCollection = (collection: string) => {
    if (collection === props.selectedCollection) return;
    if (window.confirm('Changing collections starts a new chat. Continue?')) setChatKey((key) => key + 1);
    else return;
    props.onCollectionChange(collection);
  };
  return <AppShell activeDestination="knowledge-base" onOpenResearch={props.onOpenResearch} onOpenCollections={props.onOpenCollections}>
    <main className={styles.workspace}>
      <header className={styles.header}><h1>Knowledge Base</h1><div className={styles.switcher} role="tablist" aria-label="Knowledge Base view">
        <button type="button" role="tab" aria-selected={view === 'chat'} onClick={() => setView('chat')}>Chat</button>
        <button type="button" role="tab" aria-selected={view === 'vector'} onClick={() => setView('vector')}>Vector Search</button>
      </div></header>
      {view === 'chat' ? <RagChat key={chatKey} collection={props.selectedCollection} collections={props.collections} unavailable={props.unavailable} onCollectionChange={changeCollection} onNewChat={() => setChatKey((key) => key + 1)} /> : <VectorSearch collections={props.collections} selectedCollection={props.selectedCollection} unavailable={props.unavailable} onCollectionChange={changeCollection} />}
    </main>
  </AppShell>;
}
