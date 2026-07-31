'use client';

import styles from './knowledge-base.module.css';

export interface CitationSource { id: string; path: string; snippet: string; }

function externalUrl(path: string): string | null {
  try {
    const url = new URL(path);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch { return null; }
}

interface CitationListProps {
  sources: CitationSource[];
  anchorPrefix?: string;
}

export function CitationList({ sources, anchorPrefix = '' }: CitationListProps) {
  const uniqueSources = Array.from(new Map(sources.map((source) => [source.id, source])).values());
  if (!uniqueSources.length) return null;

  return <section className={styles.sourceIndex} aria-labelledby={`${anchorPrefix}-source-index`}>
    <header className={styles.sourceIndexHeader}>
      <h3 id={`${anchorPrefix}-source-index`}>Source index</h3>
      <span>{uniqueSources.length} {uniqueSources.length === 1 ? 'source' : 'sources'}</span>
    </header>
    <ol className={styles.citations}>
      {uniqueSources.map((source, index) => {
        const href = externalUrl(source.path);
        const anchorId = `source-${anchorPrefix}-${source.id}`;
        return <li id={anchorId} key={source.id}>
          <div className={styles.citationRow}>
            <span className={styles.citationNumber}>[{index + 1}]</span>
            <div className={styles.citationBody}>
              {href ? <a href={href} target="_blank" rel="noreferrer">{source.path}</a> : <span>{source.path}</span>}
              {source.snippet && <p>{source.snippet}</p>}
            </div>
          </div>
        </li>;
      })}
    </ol>
  </section>;
}
