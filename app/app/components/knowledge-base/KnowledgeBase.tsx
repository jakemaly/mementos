'use client';

import { KeyboardEvent, useRef, useState } from 'react';
import { AppShell } from '@/app/components/app-shell/AppShell';
import { VectorSearch } from './VectorSearch';
import { RagChat } from './RagChat';
import styles from './knowledge-base.module.css';

type LocalView = 'chat' | 'vector';

interface KnowledgeBaseProps {
  collections: string[];
  selectedCollection: string;
  unavailable: boolean;
  onCollectionChange: (collection: string) => void;
  onOpenResearch: () => void;
  onOpenCollectionSettings: () => void;
}

export function KnowledgeBase(props: KnowledgeBaseProps) {
  const [view, setView] = useState<LocalView>('chat');
  const [chatKey, setChatKey] = useState(0);
  const tabRefs = useRef<Record<LocalView, HTMLButtonElement | null>>({ chat: null, vector: null });

  const selectView = (nextView: LocalView) => {
    setView(nextView);
    tabRefs.current[nextView]?.focus();
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const order: LocalView[] = ['chat', 'vector'];
    const currentIndex = order.indexOf(view);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % order.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + order.length) % order.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = order.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    if (nextIndex === currentIndex) return;
    selectView(order[nextIndex]);
  };

  const changeCollection = (collection: string) => {
    if (collection === props.selectedCollection) return;
    setChatKey((key) => key + 1);
    props.onCollectionChange(collection);
  };

  return <AppShell activeDestination="knowledge-base" onOpenResearch={props.onOpenResearch} onOpenCollectionSettings={props.onOpenCollectionSettings}>
    <main className={styles.workspace} aria-labelledby="knowledge-base-title">
      <header className={styles.utility}>
        <h1 id="knowledge-base-title" className={styles.kicker}>
          <span>03</span> Knowledge Base · Archive dossier
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="Knowledge Base view">
          <button
            ref={(element) => { tabRefs.current.chat = element; }}
            id="knowledge-base-chat-tab"
            type="button"
            role="tab"
            aria-selected={view === 'chat'}
            aria-controls="knowledge-base-chat-panel"
            tabIndex={view === 'chat' ? 0 : -1}
            onClick={() => selectView('chat')}
            onKeyDown={onTabKeyDown}
          >Chat</button>
          <button
            ref={(element) => { tabRefs.current.vector = element; }}
            id="knowledge-base-vector-tab"
            type="button"
            role="tab"
            aria-selected={view === 'vector'}
            aria-controls="knowledge-base-vector-panel"
            tabIndex={view === 'vector' ? 0 : -1}
            onClick={() => selectView('vector')}
            onKeyDown={onTabKeyDown}
          >Vector Search</button>
        </div>
        <aside className={styles.archiveStamp} aria-label="Current collection context">
          <span>Collection / active</span>
          <strong>{props.selectedCollection || 'No collection selected'}</strong>
          <small>{props.unavailable ? 'Storage unavailable' : 'Available for chat and search'}</small>
        </aside>
      </header>

      <div className={styles.stage}>
        <div
          id="knowledge-base-chat-panel"
          className={styles.panel}
          role="tabpanel"
          aria-labelledby="knowledge-base-chat-tab"
          tabIndex={0}
          hidden={view !== 'chat'}
        >
          <RagChat
            key={chatKey}
            collection={props.selectedCollection}
            collections={props.collections}
            unavailable={props.unavailable}
            onCollectionChange={changeCollection}
            onNewChat={() => setChatKey((key) => key + 1)}
          />
        </div>
        <div
          id="knowledge-base-vector-panel"
          className={styles.panel}
          role="tabpanel"
          aria-labelledby="knowledge-base-vector-tab"
          tabIndex={0}
          hidden={view !== 'vector'}
        >
          <VectorSearch
            collections={props.collections}
            selectedCollection={props.selectedCollection}
            unavailable={props.unavailable}
            onCollectionChange={changeCollection}
          />
        </div>
      </div>
    </main>
  </AppShell>;
}
