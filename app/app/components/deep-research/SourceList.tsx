'use client';

import { Source } from '@/app/lib/research-contracts';
import styles from './deep-research.module.css';

interface IngestResult {
  success: boolean;
  partial: boolean;
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
    return new URL(url).hostname.replace(/^www\./, '');
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
  const allSelected = sources.length > 0 && selectedUrls.size === sources.length;
  const selectedCount = sources.filter((source) => selectedUrls.has(source.url)).length;

  return (
    <div className={styles.sourceListContainer}>
      <div className={styles.sourceControls}>
        <button
          className={styles.sourceToggleAll}
          onClick={onToggleAll}
          type="button"
          aria-pressed={allSelected}
          disabled={sources.length === 0}
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
        <span className={styles.sourceCount} aria-live="polite">
          {selectedCount} of {sources.length} selected
        </span>
        <button
          className={styles.ingestButton}
          onClick={onIngest}
          disabled={ingestDisabled}
          type="button"
          aria-label="Import selected sources"
        >
          Import selected sources
        </button>
      </div>

      {sources.length === 0 ? (
        <p className={styles.sourceEmpty} role="status">
          No sources yet. Evidence will appear here as searches return.
        </p>
      ) : (
        <ol className={styles.sourceRows} aria-label="Discovered evidence sources">
          {sources.map((source, index) => {
            const checkboxId = `source-${index}`;
            const checked = selectedUrls.has(source.url);
            return (
              <li key={source.url} className={styles.sourceRow}>
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(source.url)}
                  aria-label={`Select source ${index + 1}: ${source.title || source.url}`}
                />
                <span className={styles.sourceNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div className={styles.sourceInfo}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.sourceLink}
                  >
                    {source.title || source.url}
                  </a>
                  <span className={styles.sourceDomain}>{sourceDomain(source.url)}</span>
                  {source.snippet && <p className={styles.sourceSnippet}>{source.snippet}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {ingestResult && (
        <div className={styles.ingestResult} role="status" aria-live="polite">
          <strong className={ingestResult.success ? styles.ingestSuccess : ingestResult.partial ? styles.ingestWarning : styles.ingestFailed}>
            {ingestResult.success
              ? `Imported ${ingestResult.ingestedUrls.length} source${ingestResult.ingestedUrls.length === 1 ? '' : 's'} · ${ingestResult.totalChunks} chunks`
              : ingestResult.partial
                ? `Partially imported ${ingestResult.ingestedUrls.length} source${ingestResult.ingestedUrls.length === 1 ? '' : 's'} · ${ingestResult.totalChunks} chunks`
                : 'Import failed for all selected sources'}
          </strong>
          {ingestResult.failedUrls.length > 0 && (
            <span className={styles.ingestFailed}>
              {ingestResult.failedUrls.length} source{ingestResult.failedUrls.length === 1 ? '' : 's'} failed.
            </span>
          )}
        </div>
      )}

      {errorMessage && <p className={styles.sourceError} role="alert">{errorMessage}</p>}
    </div>
  );
}
