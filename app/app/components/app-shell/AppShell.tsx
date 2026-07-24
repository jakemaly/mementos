'use client';

import { ReactNode } from 'react';
import styles from './app-shell.module.css';

type Destination = 'research' | 'knowledge-base';

interface AppShellProps {
  activeDestination: Destination;
  children: ReactNode;
  onNewResearch?: () => void;
  onOpenKnowledgeBase?: () => void;
  onOpenCollections?: () => void;
}

export function AppShell({
  activeDestination,
  children,
  onNewResearch,
  onOpenKnowledgeBase,
  onOpenCollections,
}: AppShellProps) {
  return (
    <div className={styles.shell}>
      <nav className={styles.navigation} aria-label="Main navigation">
        <span className={styles.wordmark}>Mementos</span>
        <div className={styles.destinations}>
          <button type="button" className={styles.destination} aria-current={activeDestination === 'research' ? 'page' : undefined}>
            Deep Research
          </button>
          <button type="button" className={styles.destination} aria-current={activeDestination === 'knowledge-base' ? 'page' : undefined} onClick={onOpenKnowledgeBase}>
            Knowledge Base
          </button>
          <button type="button" className={styles.destination} onClick={onOpenCollections}>
            Collections
          </button>
          <button type="button" className={styles.destination} disabled aria-label="Settings (not available yet)">
            Settings
          </button>
        </div>
        {onNewResearch && (
          <button type="button" className={styles.contextAction} onClick={onNewResearch} aria-label="New research">
            New research
          </button>
        )}
      </nav>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
