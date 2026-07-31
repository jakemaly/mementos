'use client';

import { ReactNode } from 'react';
import styles from './app-shell.module.css';

type Destination = 'research' | 'knowledge-base';

interface AppShellProps {
  activeDestination: Destination;
  children: ReactNode;
  onNewResearch?: () => void;
  onOpenResearch?: () => void;
  onOpenKnowledgeBase?: () => void;
  onOpenCollections?: () => void;
}

export function AppShell({
  activeDestination,
  children,
  onNewResearch,
  onOpenResearch,
  onOpenKnowledgeBase,
  onOpenCollections,
}: AppShellProps) {
  return (
    <div className={styles.shell}>
      <nav className={styles.navigation} aria-label="Main navigation">
        <div className={styles.identity}>
          <span className={styles.wordmark}>
            Mementos<span className={styles.wordmarkMark} aria-hidden="true" />
          </span>
          <span className={styles.identityNote}>A research notebook</span>
        </div>

        <div className={styles.navGroup}>
          <span className={styles.navLabel}>Navigate</span>
          <div className={styles.destinations}>
            <button
              type="button"
              className={styles.destination}
              aria-current={activeDestination === 'research' ? 'page' : undefined}
              onClick={onOpenResearch}
            >
              <span className={styles.navNumber} aria-hidden="true">01</span>
              <span className={styles.navCopy}>
                <span>Deep Research</span>
                <small>Ask a question</small>
              </span>
            </button>
            <button
              type="button"
              className={styles.destination}
              aria-current={activeDestination === 'knowledge-base' ? 'page' : undefined}
              onClick={onOpenKnowledgeBase}
            >
              <span className={styles.navNumber} aria-hidden="true">02</span>
              <span className={styles.navCopy}>
                <span>Knowledge Base</span>
                <small>Review evidence</small>
              </span>
            </button>
            <button
              id="collections-trigger"
              type="button"
              className={styles.destination}
              onClick={onOpenCollections}
            >
              <span className={styles.navNumber} aria-hidden="true">03</span>
              <span className={styles.navCopy}>
                <span>Collections</span>
                <small>Choose a source set</small>
              </span>
            </button>
            <button
              type="button"
              className={styles.destination}
              disabled
              aria-label="Settings (not available yet)"
            >
              <span className={styles.navNumber} aria-hidden="true">04</span>
              <span className={styles.navCopy}>
                <span>Settings</span>
                <small>Not available yet</small>
              </span>
            </button>
          </div>
        </div>

        <div className={styles.navFoot}>
          {onNewResearch && (
            <button type="button" className={styles.contextAction} onClick={onNewResearch}>
              <span>New research</span>
              <span aria-hidden="true">↗</span>
            </button>
          )}
          <p className={styles.navFootnote}>Follow a question from brief to evidence.</p>
        </div>
      </nav>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
