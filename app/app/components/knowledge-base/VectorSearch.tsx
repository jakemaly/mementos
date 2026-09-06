'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import styles from './knowledge-base.module.css';

interface SearchResult { id: string; score: number; text: string; filename: string; }
interface VectorSearchProps { collections: string[]; selectedCollection: string; onCollectionChange: (collection: string) => void; unavailable: boolean; }
type SearchStatus = 'idle' | 'loading' | 'results' | 'empty' | 'error';

export function VectorSearch({ collections, selectedCollection, onCollectionChange, unavailable }: VectorSearchProps) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [limit, setLimit] = useState(5);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [error, setError] = useState('');
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setResults([]);
    setExpanded(new Set());
    setSubmitted('');
    setStatus('idle');
  }, [selectedCollection]);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim() || !selectedCollection) return;
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setSubmitted(query.trim());
    setResults([]);
    setStatus('loading'); setError(''); setExpanded(new Set());
    try {
      const response = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: query.trim(), collection: selectedCollection, limit }), signal: controller.signal });
      const data = await response.json() as { results?: SearchResult[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Search failed');
      if (requestRef.current !== controller) return;
      const next = Array.isArray(data.results) ? data.results : [];
      setResults(next); setStatus(next.length ? 'results' : 'empty');
    } catch (reason) {
      if (controller.signal.aborted || requestRef.current !== controller) return;
      setError(reason instanceof Error ? reason.message : 'Search failed'); setStatus('error');
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  const statusMessage = unavailable
    ? 'Knowledge base storage is unavailable.'
    : status === 'loading'
      ? 'Searching this collection…'
      : status === 'results'
        ? `${results.length} ${results.length === 1 ? 'match' : 'matches'} found.`
        : status === 'empty'
          ? '0 matches. No matching sources found.'
          : status === 'error'
            ? 'Search failed.'
            : selectedCollection ? 'Ready to search the selected collection.' : 'Select a collection to search.';

  return <section className={styles.chat} aria-label="Vector Search">
    <header className={styles.chatHeader}>
      <div className={styles.chatHeaderCopy}>
        <p className={styles.chatKicker}>Vector Search / collection record</p>
      </div>
    </header>

    <p className={styles.searchStatus} role="status" aria-live="polite">{statusMessage}</p>
    {status === 'error' && <p className={styles.errorNotice} role="alert">{error}</p>}

    <div className={`${styles.thread} ${submitted ? styles.threadActive : ''}`}>
      {submitted ? <div className={styles.spine} aria-hidden="true" /> : null}
      {!submitted && <p className={styles.emptyNotice}>No search in this session. Ask the archive below.</p>}
      {submitted && (
        <article className={styles.userMessage} aria-label="Your question">
          <span className={styles.portrait} aria-hidden="true">YOU</span>
          <div className={styles.bubble}>
            <div className={styles.messageMeta}>
              <span className={styles.messageLabel}>You</span>
              <span className={styles.messageState}>Question sent</span>
            </div>
            <p className={styles.messageCopy}>{submitted}</p>
          </div>
        </article>
      )}
      {status === 'loading' && (
        <article className={styles.assistantMessage} aria-label="Archive answer">
          <span className={styles.portrait} aria-hidden="true">VS</span>
          <div className={styles.bubble}>
            <div className={styles.messageMeta}>
              <span className={styles.messageLabel}>Archive</span>
              <span className={styles.messageState}>Searching this collection…</span>
            </div>
            <p className={styles.messageCopy}>Retrieving evidence…</p>
          </div>
        </article>
      )}
      {results.length > 0 && <ol className={styles.results} aria-label="Vector search results">
        {results.map((result) => <li className={styles.result} key={result.id}>
          <article className={styles.assistantMessage}>
            <span className={styles.portrait} aria-hidden="true">VS</span>
            <div className={styles.bubble}>
              <header className={styles.resultHeader}>
                <div>
                  <span className={styles.resultLabel}>Source</span>
                  <strong>{result.filename}</strong>
                </div>
                <span className={styles.score} aria-label={`Similarity score ${result.score.toFixed(2)}`}>{result.score.toFixed(2)}</span>
              </header>
              <p className={styles.resultExcerpt}>{expanded.has(result.id) ? result.text : `${result.text.slice(0, 240)}${result.text.length > 240 ? '…' : ''}`}</p>
              {result.text.length > 240 && <button type="button" className={styles.disclosure} aria-expanded={expanded.has(result.id)} onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(result.id)) next.delete(result.id); else next.add(result.id); return next; })}>
                {expanded.has(result.id) ? 'Show less' : 'Show more'}
              </button>}
            </div>
          </article>
        </li>)}
      </ol>}
    </div>

    <form className={`${styles.chatComposer} ${styles.vectorComposer}`} onSubmit={search}>
      <div className={styles.vectorFields}>
        <div className={styles.collectionField}>
          <label htmlFor="vector-collection">Collection</label>
          <select id="vector-collection" value={selectedCollection} onChange={(event) => onCollectionChange(event.target.value)} disabled={unavailable || status === 'loading'}>
            {collections.map((name) => <option value={name} key={name}>{name}</option>)}
          </select>
        </div>
        <div className={styles.collectionField}>
          <label htmlFor="vector-limit">Results</label>
          <select id="vector-limit" value={limit} onChange={(event) => setLimit(Number(event.target.value))} disabled={status === 'loading'}>
            {[5, 10, 20].map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </div>
        <div className={styles.composerField}>
          <label className={styles.composerLabel} htmlFor="vector-query">Search source text</label>
          <input id="vector-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a passage in this archive" disabled={unavailable || status === 'loading'} />
        </div>
      </div>
      <button type="submit" className={styles.sendButton} disabled={unavailable || status === 'loading' || !query.trim() || !selectedCollection}>
        {status === 'loading' ? 'Searching…' : 'Search'} <span aria-hidden="true">↗</span>
      </button>
    </form>
  </section>;
}
