'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatComposer } from './ChatComposer';
import { CitationList, CitationSource } from './CitationList';
import styles from './knowledge-base.module.css';

type Message = { id: string; role: 'user' | 'assistant'; content: string; sources?: CitationSource[]; status?: 'retrieving' | 'streaming' | 'stopped' | 'failed' | 'complete' | 'insufficient' };
type CollectionStats = { qdrant: { points: number }; lightrag: { documents: number; nodes: number; links: number } };
type BackfillResult = { id?: string; status: 'running' | 'complete' | 'partial' | 'failed'; documents: number; indexedDocuments: number; error?: string };
interface RagChatProps { collection: string; collections: string[]; unavailable: boolean; onCollectionChange: (collection: string) => void; onNewChat: () => void; }

export function RagChat({ collection, collections, unavailable, onCollectionChange, onNewChat }: RagChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [statsUnavailable, setStatsUnavailable] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState('');
  const controllerRef = useRef<AbortController | null>(null);
  const turnRef = useRef('');

  useEffect(() => {
    if (!collection || unavailable) { setStats(null); return; }
    const controller = new AbortController();
    setStats(null); setStatsUnavailable(false);
    void fetch(`/api/collections/${encodeURIComponent(collection)}/stats`, { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<CollectionStats> : Promise.reject())
      .then((next) => setStats(next))
      .catch(() => { if (!controller.signal.aborted) setStatsUnavailable(true); });
    return () => controller.abort();
  }, [collection, unavailable]);

  const indexQdrantInLightRag = async () => {
    if (!collection || backfilling) return;
    setBackfilling(true); setBackfillMessage('');
    try {
      const endpoint = `/api/collections/${encodeURIComponent(collection)}/lightrag-backfill`;
      const response = await fetch(endpoint, { method: 'POST' });
      const started = await response.json() as BackfillResult;
      if (!response.ok || !started.status) throw new Error(started.error || 'Indexing failed');
      if (started.status === 'complete') { setBackfillMessage('No Qdrant sources need indexing.'); setBackfilling(false); return; }
      if (!started.id) throw new Error('Could not start indexing');
      const poll = async (): Promise<void> => {
        try {
          const statusResponse = await fetch(`${endpoint}?job=${started.id}`);
          const result = await statusResponse.json() as BackfillResult;
          if (!statusResponse.ok) throw new Error(result.error || 'Could not read indexing status');
          if (result.status === 'running') { setBackfillMessage(`Indexing ${result.indexedDocuments} of ${result.documents} Qdrant sources…`); window.setTimeout(() => void poll(), 2_000); return; }
          setBackfillMessage(`${result.status === 'complete' ? 'Indexed' : 'Partially indexed'} ${result.indexedDocuments} of ${result.documents} Qdrant sources.`);
          const statsResponse = await fetch(`/api/collections/${encodeURIComponent(collection)}/stats`);
          if (statsResponse.ok) setStats(await statsResponse.json() as CollectionStats);
          setBackfilling(false);
        } catch (error) {
          setBackfillMessage(error instanceof Error ? error.message : 'Indexing failed');
          setBackfilling(false);
        }
      };
      await poll();
    } catch (error) {
      setBackfillMessage(error instanceof Error ? error.message : 'Indexing failed');
      setBackfilling(false);
    }
  };

  const start = async () => {
    const question = draft.trim();
    if (!question || running || unavailable) return;
    const turnId = crypto.randomUUID();
    turnRef.current = turnId;
    const history = messages.filter((message) => message.status === 'complete').slice(-20).map((message) => ({ role: message.role, content: message.content }));
    const assistantId = `${turnId}:assistant`;
    setMessages((current) => [...current, { id: `${turnId}:user`, role: 'user', content: question, status: 'complete' }, { id: assistantId, role: 'assistant', content: '', status: 'retrieving' }]);
    setDraft(''); setRunning(true);
    const controller = new AbortController(); controllerRef.current = controller;
    try {
      const response = await fetch('/api/rag/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ query: question, collection, turn_id: turnId, history }) });
      if (!response.ok || !response.body) throw new Error('Chat request failed');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n'); buffer = blocks.pop() || '';
        for (const block of blocks) {
          const event = block.match(/^event:\s*(.+)$/m)?.[1];
          const raw = block.match(/^data:\s*(.+)$/m)?.[1];
          if (!event || !raw || turnRef.current !== turnId) continue;
          const data = JSON.parse(raw) as { text?: string; sources?: CitationSource[] };
          if (event === 'delta') setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: message.content + (data.text || ''), status: 'streaming' } : message));
          if (event === 'sources') setMessages((current) => current.map((message) => {
            if (message.id !== assistantId) return message;
            const sources = Array.from(new Map((data.sources || []).map((source) => [source.id, source])).values());
            return { ...message, sources };
          }));
          if (event === 'done') setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, status: message.status === 'insufficient' ? 'insufficient' : 'complete' } : message));
          if (event === 'insufficient_evidence') setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: 'I do not have enough evidence in this collection to answer that.', status: 'insufficient' } : message));
          if (event === 'error') throw new Error('Answer generation failed');
        }
      }
    } catch {
      const status = controller.signal.aborted ? 'stopped' : 'failed';
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, status, content: message.content || (status === 'stopped' ? 'Stopped.' : 'Answer generation failed.') } : message));
    } finally { if (turnRef.current === turnId) { setRunning(false); controllerRef.current = null; } }
  };

  const stop = () => controllerRef.current?.abort();
  const reset = () => { controllerRef.current?.abort(); turnRef.current = ''; setMessages([]); onNewChat(); };
  return <section className={styles.chat} aria-label="RAG Chat">
    <p className={styles.srOnly} role="status">{running ? 'Retrieving answer' : ''}</p>
    <header className={styles.chatHeader}><div className={styles.collectionContext}><label>Collection <select value={collection} onChange={(event) => onCollectionChange(event.target.value)} disabled={running || backfilling || unavailable}>{collections.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>{stats ? <ul className={styles.stats} aria-label="Collection statistics"><li>Qdrant: {stats.qdrant.points} items</li><li>LightRAG: {stats.lightrag.documents} items</li><li>Graph: {stats.lightrag.nodes} nodes · {stats.lightrag.links} links</li></ul> : statsUnavailable ? <p className={styles.statsUnavailable}>Statistics unavailable</p> : collection ? <p className={styles.statsUnavailable}>Loading statistics…</p> : null}{collection && <button type="button" className={styles.backfillButton} onClick={indexQdrantInLightRag} disabled={backfilling || unavailable}>{backfilling ? 'Indexing Qdrant…' : 'Index Qdrant in LightRAG'}</button>}{backfillMessage && <p className={styles.backfillMessage} role="status">{backfillMessage}</p>}</div><button type="button" onClick={reset}>New chat</button></header>
    <div className={styles.transcript} aria-live="off">{messages.length === 0 && <p className={styles.notice}>Ask a question to search this collection.</p>}{messages.map((message) => <article key={message.id} className={message.role === 'user' ? styles.userMessage : styles.assistantMessage}><strong>{message.role === 'user' ? 'You' : 'Mementos'}</strong><p>{message.content || (message.status === 'retrieving' ? 'Retrieving evidence…' : '')}</p>{message.sources?.length ? <p className={styles.inlineCitations}>{message.sources.map((source, index) => <a href={`#source-${source.id}`} key={source.id}>[{index + 1}]</a>)}</p> : null}<CitationList sources={message.sources || []} />{message.role === 'assistant' && message.status === 'complete' && message.content && <button type="button" className={styles.copyButton} onClick={() => void navigator.clipboard.writeText(message.content)}>Copy</button>}{message.status && message.status !== 'complete' && <small className={message.status === 'insufficient' ? styles.insufficient : ''}>{message.status}</small>}</article>)}</div>
    {running && <button type="button" className={styles.stopButton} onClick={stop}>Stop</button>}
    <ChatComposer value={draft} onChange={setDraft} onSubmit={start} disabled={running || unavailable || !collection} />
  </section>;
}
