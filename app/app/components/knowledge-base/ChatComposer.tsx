'use client';

import { KeyboardEvent } from 'react';
import styles from './knowledge-base.module.css';

interface ChatComposerProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function ChatComposer({ value, disabled, onChange, onSubmit }: ChatComposerProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && value.trim()) onSubmit();
    }
  };
  return <div className={styles.chatComposer}>
    <textarea aria-label="Ask Knowledge Base" value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} disabled={disabled} placeholder="Ask about this collection" rows={2} />
    <button type="button" onClick={onSubmit} disabled={disabled || !value.trim()}>Send</button>
  </div>;
}
