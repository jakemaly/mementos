'use client';

import { FormEvent, useEffect, useState } from 'react';
import styles from './knowledge-base.module.css';

interface SearchResult { id: string; score: number; text: string; filename: string; }
interface VectorSearchProps { collections: string[]; selectedCollection: string; onCollectionChange: (collection: string) => void; unavailable: boolean; }

export function VectorSearch({ collections, selectedCollection, onCollectionChange, unavailable }: VectorSearchProps) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(5);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => { setResults([]); setExpanded(new Set()); setStatus('idle'); }, [selectedCollection]);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim() || !selectedCollection) return;
    setStatus('loading'); setError(''); setExpanded(new Set());
    try {
      const response = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: query.trim(), collection: selectedCollection, limit }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Search failed');
      const next = Array.isArray(data.results) ? data.results : [];
      setResults(next); setStatus(next.length ? 'idle' : 'empty');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Search failed'); setStatus('error');
    }
  };

  return <section className={styles.view} aria-label="Vector Search">
    <form className={styles.searchForm} onSubmit={search}>
      <label className={styles.srOnly} htmlFor="vector-query">Search collection</label>
      <input id="vector-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search indexed sources" disabled={unavailable || status === 'loading'} />
      <label>Collection <select value={selectedCollection} onChange={(event) => onCollectionChange(event.target.value)} disabled={unavailable || status === 'loading'}>{collections.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
      <label>Results <select value={limit} onChange={(event) => setLimit(Number(event.target.value))} disabled={status === 'loading'}>{[5, 10, 20].map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
      <button type="submit" disabled={unavailable || status === 'loading' || !query.trim() || !selectedCollection}>{status === 'loading' ? 'Searching…' : 'Search'}</button>
    </form>
    {unavailable && <p className={styles.notice} role="alert">Knowledge base storage is unavailable.</p>}
    {status === 'empty' && <p className={styles.notice}>No matching sources found.</p>}
    {status === 'error' && <p className={styles.notice} role="alert">{error}</p>}
    <div className={styles.results} aria-live="polite">
      {results.map((result) => <article className={styles.result} key={result.id}>
        <header><strong>{result.filename}</strong><span>{result.score.toFixed(2)}</span></header>
        <p>{expanded.has(result.id) ? result.text : `${result.text.slice(0, 240)}${result.text.length > 240 ? '…' : ''}`}</p>
        {result.text.length > 240 && <button type="button" className={styles.disclosure} aria-expanded={expanded.has(result.id)} onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(result.id)) next.delete(result.id); else next.add(result.id); return next; })}>{expanded.has(result.id) ? 'Show less' : 'Show more'}</button>}
      </article>)}
    </div>
  </section>;
}
