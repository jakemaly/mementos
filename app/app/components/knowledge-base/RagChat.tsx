'use client';

import { useRef, useState } from 'react';
import { ChatComposer } from './ChatComposer';
import { CitationList, CitationSource } from './CitationList';
import styles from './knowledge-base.module.css';

type Message = { id: string; role: 'user' | 'assistant'; content: string; sources?: CitationSource[]; status?: 'retrieving' | 'streaming' | 'stopped' | 'failed' | 'complete' | 'insufficient' };
interface RagChatProps { collection: string; unavailable: boolean; onNewChat: () => void; }

export function RagChat({ collection, unavailable, onNewChat }: RagChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [running, setRunning] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const turnRef = useRef('');

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
    <header className={styles.chatHeader}><span>Collection: {collection || 'None'}</span><button type="button" onClick={reset}>New chat</button></header>
    <div className={styles.transcript} aria-live="polite">{messages.length === 0 && <p className={styles.notice}>Ask a question to search this collection.</p>}{messages.map((message) => <article key={message.id} className={message.role === 'user' ? styles.userMessage : styles.assistantMessage}><strong>{message.role === 'user' ? 'You' : 'Mementos'}</strong><p>{message.content || (message.status === 'retrieving' ? 'Retrieving evidence…' : '')}</p>{message.sources?.length ? <p className={styles.inlineCitations}>{message.sources.map((source, index) => <a href={`#source-${source.id}`} key={source.id}>[{index + 1}]</a>)}</p> : null}<CitationList sources={message.sources || []} />{message.status && message.status !== 'complete' && <small className={message.status === 'insufficient' ? styles.insufficient : ''}>{message.status}</small>}</article>)}</div>
    {running && <button type="button" className={styles.stopButton} onClick={stop}>Stop</button>}
    <ChatComposer value={draft} onChange={setDraft} onSubmit={start} disabled={running || unavailable || !collection} />
  </section>;
}
