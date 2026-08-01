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
      <div className={styles.dialogueHeader}>
        <span className={styles.speakerPlate}>MEMENTOS</span>
        <span className={styles.dialogueContext}>DEEP RESEARCH</span>
      </div>
      <div className={styles.dialoguePrompt}>
        <h1>Begin with the question.</h1>
      </div>
      <label className={styles.questionField}>
        <span className={styles.fieldLabel}>Research question</span>
        <textarea
          id="research-query"
          name="query"
          className={styles.composerInput}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={4}
          aria-label="Research query"
          autoFocus
        />
      </label>
      <div className={styles.composerFooter}>
        <label className={styles.collectionField}>
          <span className={styles.fieldLabel}>Save evidence to</span>
          <select
            id="target-collection"
            name="collection"
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
        </label>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={disabled}
          aria-label="Start research"
        >
          <span>START RESEARCH</span>
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </form>
  );
}
