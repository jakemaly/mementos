'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './collections-drawer.module.css';

interface CollectionsDrawerProps {
  open: boolean;
  collections: string[];
  selectedCollection: string;
  unavailable: boolean;
  onClose: () => void;
  onCollectionChange: (collection: string) => void;
  onRefresh: () => Promise<void>;
}

type Result = { status: 'complete' | 'partial' | 'failed'; vector: { status: string }; graph: { status: string } };

export function CollectionsDrawer({
  open,
  collections,
  selectedCollection,
  unavailable,
  onClose,
  onCollectionChange,
  onRefresh,
}: CollectionsDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [message, setMessage] = useState('');

  const requestClose = useCallback(() => {
    if (ingesting) return;
    onClose();
    document.getElementById('collections-trigger')?.focus();
  }, [ingesting, onClose]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
      if (event.key === 'Tab' && drawerRef.current) {
        const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, requestClose]);

  if (!open) return null;

  const createCollection = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setMessage('');
    try {
      const response = await fetch('/api/collections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create collection');
      setName('');
      await onRefresh();
      onCollectionChange(data.name);
      setMessage(`Created ${data.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create collection');
    } finally {
      setCreating(false);
    }
  };

  const ingestFile = async () => {
    if (!file || !selectedCollection) return;
    setIngesting(true);
    setMessage('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('collection', selectedCollection);
      const response = await fetch('/api/ingest', { method: 'POST', body: form });
      const data = await response.json() as Result & { error?: string };
      if (!response.ok && data.status !== 'failed') throw new Error(data.error || 'Ingestion failed');
      setMessage(`Vector: ${data.vector?.status || 'failed'} · Graph: ${data.graph?.status || 'failed'}`);
      if (data.status === 'complete') setFile(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ingestion failed');
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className={styles.backdrop} role="presentation">
      <aside ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-label="Collections manager">
        <header className={styles.header}>
          <h2>Collections</h2>
          <button ref={closeRef} type="button" onClick={requestClose} disabled={ingesting} aria-label="Close collections">Close</button>
        </header>
        {unavailable ? <p className={styles.message} role="alert">Knowledge base storage is unavailable.</p> : <>
          <label className={styles.label}>Active collection
            <select value={selectedCollection} onChange={(event) => onCollectionChange(event.target.value)} disabled={ingesting}>
              {collections.map((collection) => <option key={collection} value={collection}>{collection}</option>)}
            </select>
          </label>
          <form className={styles.section} onSubmit={createCollection}>
            <label className={styles.label}>New collection
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={64} disabled={creating || ingesting} />
            </label>
            <button type="submit" disabled={!name || creating || ingesting}>{creating ? 'Creating…' : 'Create collection'}</button>
          </form>
          <section className={styles.section} aria-label="Ingest one document">
            <label className={styles.label}>TXT or Markdown file
              <input type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" onChange={(event) => setFile(event.target.files?.[0] || null)} disabled={ingesting} />
            </label>
            {file && <p className={styles.fileName}>{file.name}</p>}
            <button type="button" onClick={ingestFile} disabled={!file || ingesting}>{ingesting ? 'Indexing…' : 'Index file'}</button>
          </section>
          {message && <p className={styles.message} role="status">{message}</p>}
        </>}
      </aside>
    </div>
  );
}
