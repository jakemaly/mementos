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
      className={styles.dialogueForm}
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSubmit();
      }}
    >
      <section className={styles.dialogueStage} aria-labelledby="research-dialogue-title">
        <div className={styles.dialogueFrame} aria-hidden="true" />
        <p className={styles.dialogueContext} aria-hidden="true">
          <span>Deep Research</span>
          <span>↗</span>
        </p>
        <div className={styles.dialogueContent}>
          <h2 id="research-dialogue-title" className={styles.dialogueNamePlate}>
            <span className={styles.visuallyHidden}>Mementos</span>
            <span aria-hidden="true">Mementos</span>
          </h2>
          <label className={styles.dialogueField}>
            <span className={styles.dialoguePrompt}>What should Mementos research?</span>
            <textarea
              id="research-query"
              name="query"
              className={styles.dialogueInput}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={8}
              aria-label="Research query"
              autoFocus
            />
          </label>
          <div className={styles.dialogueFooter}>
            <label className={styles.dialogueCollection}>
              <span className={styles.dialogueLabel}>Save evidence to</span>
              <select
                id="target-collection"
                name="collection"
                className={styles.dialogueSelect}
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
              className={styles.dialogueSubmit}
              disabled={disabled}
              aria-label="Start research"
            >
              <span>Start research</span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
