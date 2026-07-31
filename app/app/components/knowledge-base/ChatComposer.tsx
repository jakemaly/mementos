'use client';

import { FormEvent, KeyboardEvent } from 'react';
import styles from './knowledge-base.module.css';

interface ChatComposerProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function ChatComposer({ value, disabled, onChange, onSubmit }: ChatComposerProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!disabled && value.trim()) onSubmit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && value.trim()) onSubmit();
    }
  };

  return <form className={styles.chatComposer} onSubmit={submit}>
    <div className={styles.composerField}>
      <label className={styles.composerLabel} htmlFor="knowledge-base-question">Ask this collection</label>
      <textarea
        id="knowledge-base-question"
        aria-label="Ask Knowledge Base"
        aria-describedby="knowledge-base-question-hint"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder="What should I find in this archive?"
        rows={3}
      />
      <p id="knowledge-base-question-hint" className={styles.composerHint}>Enter to send · Shift+Enter for a new line</p>
    </div>
    <button type="submit" className={styles.sendButton} disabled={disabled || !value.trim()}>
      Ask archive <span aria-hidden="true">↗</span>
    </button>
  </form>;
}
