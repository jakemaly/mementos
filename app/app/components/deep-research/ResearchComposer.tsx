'use client';

import { useCallback } from 'react';
import styles from './deep-research.module.css';
import { DialogueCanvas } from './DialogueCanvas';

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
        <h2 id="research-dialogue-title" className={styles.dialogueTitle}>MEMENTOS / DEEP RESEARCH</h2>
        <DialogueCanvas
          name="MEMENTOS"
          text={query}
          input={(
            <label className={styles.dialogueField}>
              <span className={styles.visuallyHidden}>Research query</span>
              <textarea
                id="research-query"
                name="query"
                className={styles.dialogueInput}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={3}
                aria-label="Research query"
                autoFocus
              />
            </label>
          )}
        />
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
              {collections.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <button type="submit" className={styles.dialogueSubmit} disabled={disabled} aria-label="Start research">
            <span>Start research</span><span aria-hidden="true">↗</span>
          </button>
        </div>
      </section>
    </form>
  );
}
