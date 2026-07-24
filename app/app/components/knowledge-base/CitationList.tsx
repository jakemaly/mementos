'use client';

import styles from './knowledge-base.module.css';

export interface CitationSource { id: string; path: string; snippet: string; }

function externalUrl(path: string): string | null {
  try {
    const url = new URL(path);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch { return null; }
}

export function CitationList({ sources }: { sources: CitationSource[] }) {
  if (!sources.length) return null;
  return <ol className={styles.citations} aria-label="Sources">
    {sources.map((source, index) => {
      const href = externalUrl(source.path);
      return <li id={`source-${source.id}`} key={source.id}>
        {href ? <a href={href} target="_blank" rel="noreferrer">[{index + 1}] {source.path}</a> : <span>[{index + 1}] {source.path}</span>}
        {source.snippet && <p>{source.snippet}</p>}
      </li>;
    })}
  </ol>;
}
