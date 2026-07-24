'use client';

import { useCallback } from 'react';
import styles from './deep-research.module.css';

interface ResearchComposerProps {
  query: string;
  onQueryChange: (q: string) => void;
  selectedCollection: string;
  onCollectionChange: (c: string) => void;
  collections: string[];
  onSubmit: () => void;
  disabled: boolean;
  placeholder: string;
}

export function ResearchComposer({
  query,
  onQueryChange,
  selectedCollection,
  onCollectionChange,
  collections,
  onSubmit,
  disabled,
  placeholder,
}: ResearchComposerProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!disabled) onSubmit();
      }
    },
    [onSubmit, disabled],
  );

  return (
    <form
      className={styles.composerForm}
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSubmit();
      }}
    >
      <textarea
        className={styles.composerInput}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={3}
        aria-label="Research query"
        autoFocus
      />
      <div className={styles.composerFooter}>
        <select
          className={styles.collectionSelect}
          value={selectedCollection}
          onChange={(e) => onCollectionChange(e.target.value)}
          aria-label="Target collection"
        >
          {collections.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={disabled}
          aria-label="Start research"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        </button>
      </div>
    </form>
  );
}
