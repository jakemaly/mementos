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

const tabLabels: Record<LocalView, string> = {
  chat: 'Chat',
  vector: 'Vector Search',
};

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

  const viewDescription = view === 'chat'
    ? 'Ask the archive and read each answer beside its supporting sources.'
    : 'Search the same collection directly when you need the raw matches.';

  return <AppShell activeDestination="knowledge-base" onOpenResearch={props.onOpenResearch} onOpenCollectionSettings={props.onOpenCollectionSettings}>
    <main className={styles.workspace} aria-labelledby="knowledge-base-title">
      <header className={styles.pageHeader}>
        <div className={styles.headingCopy}>
          <p className={styles.eyebrow}><span>03</span> Knowledge Base / archive</p>
          <h1 id="knowledge-base-title">Archive dossier.</h1>
          <p className={styles.pageLede}>One collection, two ways to read its record. Keep the conversation readable and the evidence close.</p>
        </div>
        <aside className={styles.archiveStamp} aria-label="Current collection context">
          <span>Collection / active</span>
          <strong>{props.selectedCollection || 'No collection selected'}</strong>
          <small>{props.unavailable ? 'Storage unavailable' : 'Available for chat and search'}</small>
        </aside>
      </header>

      <div className={styles.dossierLayout}>
        <aside className={styles.spine} aria-label="Archive dossier context">
          <p className={styles.spineKicker}>Collection / dossier</p>
          <h2 className={styles.spineTitle}>{props.selectedCollection || 'Unselected archive'}</h2>
          <div className={styles.spineMark} aria-hidden="true">KB</div>
          <dl className={styles.spineMeta}>
            <div><dt>Workspace</dt><dd>Knowledge Base</dd></div>
            <div><dt>View</dt><dd>{tabLabels[view]}</dd></div>
            <div><dt>Storage</dt><dd>{props.unavailable ? 'Unavailable' : props.selectedCollection ? 'Ready' : 'Waiting'}</dd></div>
          </dl>
        </aside>

        <section className={styles.paper} aria-label="Knowledge Base workspace">
          <header className={styles.paperHeader}>
            <div className={styles.paperHeading}>
              <p className={styles.sectionLabel}>Current record</p>
              <h2>{view === 'chat' ? 'Read the archive.' : 'Search the archive.'}</h2>
              <p>{viewDescription}</p>
            </div>
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
          </header>

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
        </section>
      </div>
    </main>
  </AppShell>;
}
