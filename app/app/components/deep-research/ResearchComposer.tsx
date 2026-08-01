'use client';

import Image from 'next/image';
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
      <section className={styles.dialogueStage} aria-label="Mementos research dialogue">
        <Image
          className={styles.dialogueFrame}
          src="/p5-dialogue/images/db-main-small.png"
          alt=""
          fill
          priority
          sizes="(max-width: 768px) calc(100vw - 2rem), 1040px"
          aria-hidden="true"
        />
        <div className={styles.dialogueContext} aria-hidden="true">
          <span>DEEP RESEARCH</span>
          <span>↗</span>
        </div>
        <div className={styles.dialogueLayer}>
          <div className={styles.dialogueNamePlate}>
            <span className={styles.visuallyHidden}>Mementos</span>
            <span className={styles.dialogueNameText} aria-hidden="true">
              <span className={styles.dialogueNameTile}>M</span>
              <span>EMENTOS</span>
            </span>
          </div>
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
              rows={4}
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
              <span>START RESEARCH</span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
