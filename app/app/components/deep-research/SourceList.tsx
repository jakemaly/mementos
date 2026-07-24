'use client';

import { Source } from '@/app/lib/research-contracts';
import styles from './deep-research.module.css';

interface IngestResult {
  totalChunks: number;
  ingestedUrls: string[];
  failedUrls: string[];
}

interface SourceListProps {
  sources: Source[];
  selectedUrls: Set<string>;
  onToggle: (url: string) => void;
  onToggleAll: () => void;
  onIngest: () => void;
  ingestDisabled: boolean;
  ingestResult: IngestResult | null;
  errorMessage: string;
}

function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function SourceList({
  sources,
  selectedUrls,
  onToggle,
  onToggleAll,
  onIngest,
  ingestDisabled,
  ingestResult,
  errorMessage,
}: SourceListProps) {
  if (sources.length === 0) {
    return <div className={styles.sourceEmpty}>No sources yet.</div>;
  }

  return (
    <div className={styles.sourceListContainer}>
      {/* Controls */}
      <div className={styles.sourceControls}>
        <button className={styles.sourceToggleAll} onClick={onToggleAll} type="button">
          {selectedUrls.size === sources.length ? 'Deselect all' : 'Select all'}
        </button>
        <span className={styles.sourceCount}>
          {selectedUrls.size} of {sources.length} selected
        </span>
        <button
          className={styles.ingestButton}
          onClick={onIngest}
          disabled={ingestDisabled}
          type="button"
          aria-label="Import selected sources"
        >
          Import {selectedUrls.size > 0 ? `${selectedUrls.size} sources` : ''}
        </button>
      </div>

      {/* Source rows */}
      <div className={styles.sourceRows}>
        {sources.map((source) => (
          <label key={source.url} className={styles.sourceRow}>
            <input
              type="checkbox"
              checked={selectedUrls.has(source.url)}
              onChange={() => onToggle(source.url)}
              aria-label={`Select ${source.title || source.url}`}
            />
            <div className={styles.sourceInfo}>
              <div className={styles.sourceTitle}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={styles.sourceLink}
                >
                  {source.title || source.url}
                </a>
              </div>
              <span className={styles.sourceDomain}>{sourceDomain(source.url)}</span>
              {source.snippet && (
                <p className={styles.sourceSnippet}>{source.snippet}</p>
              )}
            </div>
          </label>
        ))}
      </div>

      {/* Ingestion result */}
      {ingestResult && (
        <div className={styles.ingestResult} role="status">
          <span className={styles.ingestSuccess}>
            Imported {ingestResult.ingestedUrls.length} sources ({ingestResult.totalChunks} chunks)
          </span>
          {ingestResult.failedUrls.length > 0 && (
            <span className={styles.ingestFailed}>
              {ingestResult.failedUrls.length} source(s) failed
            </span>
          )}
        </div>
      )}

      {errorMessage && <div className={styles.sourceError} role="alert">{errorMessage}</div>}
    </div>
  );
}
