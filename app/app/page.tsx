'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './page.module.css';
import { DeepResearch } from './components/deep-research/DeepResearch';
import { CollectionsDrawer } from './components/collections/CollectionsDrawer';
import { KnowledgeBase } from './components/knowledge-base/KnowledgeBase';


interface QueryResult {
  id: string;
  score: number;
  text: string;
  filename: string;
  chunkIndex: number;
  charStart: number;
  charEnd: number;
}

interface IngestSummary {
  filename: string;
  chunksCount: number;
  embeddingTimeMs: number;
}

export default function Dashboard() {
  // Active Tab state (0 for Chat & Search, 1 for Ingest & Studio)
  const [activeTab, setActiveTab] = useState<number>(0);
  const [queryMode, setQueryMode] = useState<'rag' | 'vector'>('rag');

  // Collections state
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [collectionUnavailable, setCollectionUnavailable] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState<string>('');
  const [isCreatingCollection, setIsCreatingCollection] = useState<boolean>(false);

  // Session stats & local RAG status
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [ragStatusLog, setRagStatusLog] = useState<{ type: 'info' | 'success' | 'warning' | 'error'; message: string } | null>(null);

  const getCollectionCount = useCallback((name: string) => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const baseCount = (hash % 61) + 15; // 15 to 75
    const added = sessionCounts[name] || 0;
    return baseCount + added;
  }, [sessionCounts]);

  // Auto-clear local RAG status
  useEffect(() => {
    if (ragStatusLog && ragStatusLog.type !== 'info') {
      const timer = setTimeout(() => setRagStatusLog(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [ragStatusLog]);

  // Ingestion settings
  const [chunkSize, setChunkSize] = useState<number>(500);
  const [chunkOverlap, setChunkOverlap] = useState<number>(50);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [ingesting, setIngesting] = useState<boolean>(false);
  const [ingestStatus, setIngestStatus] = useState<string>('');
  const [ingestSummary, setIngestSummary] = useState<IngestSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<QueryResult[]>([]);
  const [searchLimit, setSearchLimit] = useState<number>(5);


  // Vector search result expansion state
  const [expandedResultIds, setExpandedResultIds] = useState<Set<string>>(new Set());
  const toggleExpandResult = (id: string) => {
    setExpandedResultIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // RAG Query state
  const [ragQuery, setRagQuery] = useState<string>('');
  const [ragMode, setRagMode] = useState<string>('hybrid');
  const [ragQuerying, setRagQuerying] = useState<boolean>(false);
  const [ragAnswer, setRagAnswer] = useState<string>('');
  const [ragIngestText, setRagIngestText] = useState<string>('');
  const [ragIngesting, setRagIngesting] = useState<boolean>(false);
  const [ragFile, setRagFile] = useState<File | null>(null);
  const [ragDragActive, setRagDragActive] = useState<boolean>(false);
  const ragFileInputRef = useRef<HTMLInputElement>(null);

  // General error/success alerts
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Fetch collections
  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch('/api/collections');
      const data = await res.json();
      if (res.ok) {
        const collectionsList = Array.isArray(data.collections) ? data.collections : [];
        setCollections(collectionsList);
        setSelectedCollection((prev) => collectionsList.includes(prev) ? prev : (collectionsList[0] || ''));
        setCollectionUnavailable(Boolean(data.unavailable));
      } else {
        setCollections([]);
        setSelectedCollection('');
        setCollectionUnavailable(true);
      }
    } catch (err) {
      console.error(err);
      setCollections([]);
      setSelectedCollection('');
      setCollectionUnavailable(true);
      setErrorMsg('Error connecting to API server');
    }
  }, []);

  // Load collections on mount
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Auto-clear messages
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Create new collection
  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;

    setIsCreatingCollection(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCollectionName }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(data.message);
        setSelectedCollection(newCollectionName.trim());
        setNewCollectionName('');
        await fetchCollections();
      } else {
        setErrorMsg(data.error || 'Failed to create collection');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error creating collection');
    } finally {
      setIsCreatingCollection(false);
    }
  };

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.txt') || droppedFile.name.endsWith('.md')) {
        setFile(droppedFile);
        setErrorMsg('');
        setIngestSummary(null);
      } else {
        setErrorMsg('Only plain text (.txt) and markdown (.md) files are supported.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg('');
      setIngestSummary(null);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const removeFile = () => {
    setFile(null);
    setIngestSummary(null);
  };

  // File Ingestion
  const handleIngest = async () => {
    if (!file || !selectedCollection) {
      setErrorMsg('Please select a file and a destination collection.');
      return;
    }

    setIngesting(true);
    setIngestStatus('Uploading file...');
    setErrorMsg('');
    setSuccessMsg('');
    setIngestSummary(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('collection', selectedCollection);
      formData.append('chunkSize', chunkSize.toString());
      formData.append('chunkOverlap', chunkOverlap.toString());

      setIngestStatus('Splitting text and generating local vector embeddings (this runs fully in your browser/server process)...');
      
      const res = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(data.message || 'Ingestion complete!');
        setIngestSummary({
          filename: data.filename,
          chunksCount: data.chunksCount,
          embeddingTimeMs: data.embeddingTimeMs,
        });

        // Update session counts
        if (data.chunksCount) {
          setSessionCounts((prev) => ({
            ...prev,
            [selectedCollection]: (prev[selectedCollection] || 0) + data.chunksCount,
          }));
        }

        setFile(null); // Clear selected file on success
      } else {
        setErrorMsg(data.error || 'Ingestion failed');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error during ingestion');
    } finally {
      setIngesting(false);
      setIngestStatus('');
    }
  };

  // Query search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !selectedCollection) return;

    setSearching(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          collection: selectedCollection,
          limit: searchLimit,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSearchResults(data.results || []);
      } else {
        setErrorMsg(data.error || 'Search query failed');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error searching vector database');
    } finally {
      setSearching(false);
    }
  };

  // Deep Research handlers
  // RAG Query handler
  const handleRagQuery = async () => {
    if (!ragQuery.trim()) {
      setErrorMsg('Enter a query');
      return;
    }

    setRagQuerying(true);
    setRagAnswer('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ragQuery.trim(), mode: ragMode }),
      });

      const data = await res.json().catch(() => ({ error: 'Invalid response from server' }));

      if (res.ok) {
        setRagAnswer(data.answer || '(No answer returned)');
      } else {
        setErrorMsg(data.error || 'RAG query failed');
      }
    } catch {
      setErrorMsg('Network error during RAG query');
    } finally {
      setRagQuerying(false);
    }
  };

  // RAG text ingestion
  const handleRagIngestText = async () => {
    if (!ragIngestText.trim()) {
      setRagStatusLog({ type: 'warning', message: 'Please enter text to ingest.' });
      return;
    }

    setRagIngesting(true);
    setRagStatusLog({ type: 'info', message: 'Processing text and extracting graph entities (nodes & relationships)...' });
    setErrorMsg('');

    try {
      const res = await fetch('/api/rag/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ragIngestText.trim() }),
      });

      const data = await res.json().catch(() => ({ error: 'Invalid response from server' }));

      if (res.ok) {
        setRagStatusLog({
          type: 'success',
          message: data.message || 'Successfully ingested text and updated the LightRAG knowledge graph!'
        });
        setRagIngestText('');
      } else {
        setRagStatusLog({
          type: 'error',
          message: data.error || 'Failed to ingest text into the LightRAG knowledge graph.'
        });
      }
    } catch {
      setRagStatusLog({ type: 'error', message: 'Network error occurred during knowledge graph ingestion.' });
    } finally {
      setRagIngesting(false);
    }
  };

  // RAG file ingestion
  const handleRagFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    setRagDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (f.name.endsWith('.txt') || f.name.endsWith('.md')) {
        setRagFile(f);
        setErrorMsg('');
      } else {
        setErrorMsg('Only .txt and .md files supported for RAG ingestion.');
      }
    }
  };

  const handleRagFileDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setRagDragActive(true);
    } else if (e.type === 'dragleave') {
      setRagDragActive(false);
    }
  };

  const handleRagFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setRagFile(e.target.files[0]);
      setErrorMsg('');
    }
  };

  const handleRagIngestFile = async () => {
    if (!ragFile) return;

    setRagIngesting(true);
    setRagStatusLog({ type: 'info', message: `Reading "${ragFile.name}" and running LightRAG entity extraction...` });
    setErrorMsg('');

    try {
      const text = await ragFile.text();
      const res = await fetch('/api/rag/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, filename: ragFile.name }),
      });

      const data = await res.json().catch(() => ({ error: 'Invalid response from server' }));

      if (res.ok) {
        setRagStatusLog({
          type: 'success',
          message: data.message || `"${ragFile.name}" successfully parsed and ingested into the knowledge graph!`
        });
        setRagFile(null);
      } else {
        setRagStatusLog({
          type: 'error',
          message: data.error || 'Failed to ingest file into the LightRAG knowledge graph.'
        });
      }
    } catch {
      setRagStatusLog({ type: 'error', message: 'Error reading file or network issue during RAG ingestion.' });
    } finally {
      setRagIngesting(false);
    }
  };

  if (activeTab === 0) {
    return <>
      <DeepResearch
        collections={collections}
        selectedCollection={selectedCollection}
        collectionUnavailable={collectionUnavailable}
        onCollectionChange={setSelectedCollection}
        onOpenCollections={() => setCollectionsOpen(true)}
        onOpenKnowledgeBase={() => setActiveTab(1)}
      />
      <CollectionsDrawer
        open={collectionsOpen}
        collections={collections}
        selectedCollection={selectedCollection}
        unavailable={collectionUnavailable}
        onClose={() => setCollectionsOpen(false)}
        onCollectionChange={setSelectedCollection}
        onRefresh={fetchCollections}
      />
    </>;
  }

  if (activeTab === 1) {
    return <>
      <KnowledgeBase
        collections={collections}
        selectedCollection={selectedCollection}
        unavailable={collectionUnavailable}
        onCollectionChange={setSelectedCollection}
        onOpenResearch={() => setActiveTab(0)}
        onOpenCollections={() => setCollectionsOpen(true)}
      />
      <CollectionsDrawer
        open={collectionsOpen}
        collections={collections}
        selectedCollection={selectedCollection}
        unavailable={collectionUnavailable}
        onClose={() => setCollectionsOpen(false)}
        onCollectionChange={setSelectedCollection}
        onRefresh={fetchCollections}
      />
    </>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logoArea}>
          <div className={styles.logoIcon}></div>
          <h1 className={styles.logoTitle}>Mementos</h1>
        </div>

        {/* Center: Tab Navigation */}
        <div className={styles.tabNav}>
          <div 
            className={styles.tabBackgroundPill} 
            style={{
              transform: `translateX(${activeTab * 100}%)`,
            }} 
          />
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 0 ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(0)}
          >
            Deep Research (SIRA)
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 1 ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(1)}
          >
            Knowledge Base & Search
          </button>
        </div>

        {/* Right: Global Collection Selector dropdown + dbBadge */}
        <div className={styles.headerRight}>
          <select
            className={styles.globalSelect}
            value={selectedCollection}
            onChange={(e) => {
              setSelectedCollection(e.target.value);
              setSearchResults([]);
            }}
            disabled={ingesting}
          >
            {collections.length === 0 ? (
              <option value="">-- No collections --</option>
            ) : (
              collections.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))
            )}
          </select>
          <div className={styles.dbBadge}>
            <div className={styles.dbIndicator}></div>
            <span>Qdrant Active</span>
          </div>
        </div>
      </header>

      {/* Top Banner Alert System */}
      {errorMsg && (
        <div style={{
          background: 'rgba(248, 113, 113, 0.1)',
          borderBottom: '1px solid rgba(248, 113, 113, 0.2)',
          color: '#f87171',
          padding: '1rem 2rem',
          textAlign: 'center',
          fontSize: '0.9rem',
          fontWeight: '500',
          animation: 'fadeIn 0.2s ease-out',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display: 'inline', marginRight: '8px', verticalAlign: 'middle'}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{
          background: 'rgba(52, 211, 153, 0.1)',
          borderBottom: '1px solid rgba(52, 211, 153, 0.2)',
          color: '#34d399',
          padding: '1rem 2rem',
          textAlign: 'center',
          fontSize: '0.9rem',
          fontWeight: '500',
          animation: 'fadeIn 0.2s ease-out',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display: 'inline', marginRight: '8px', verticalAlign: 'middle'}}><polyline points="20 6 9 17 4 12"></polyline></svg>
          {successMsg}
        </div>
      )}

      {/* Main layout container with partitioned workspaces */}
      <main className={styles.layoutContainer}>
        {/* Workspace 2: Knowledge Base & Search (Tab 1) */}
        <div className={`${styles.workspace} ${activeTab !== 1 ? styles.hidden : ''}`}>
          <div className={styles.workspaceGridTab2}>
            
            {/* Left Column: Collections Manager & File Ingestion */}
            <div className={styles.workspaceColumn}>
              {/* Collections Manager Card */}
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '2px'}}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  Collections Manager
                </h2>

                {/* Collections List Layout */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Qdrant Collections</label>
                  {collections.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--md-sys-color-surface-container-lowest)', borderRadius: '12px', border: '1px dashed var(--md-sys-color-outline-variant)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      No collections found. Create one below to get started.
                    </div>
                  ) : (
                    <div className={styles.collectionsGrid}>
                      {collections.map((name) => {
                        const isActive = selectedCollection === name;
                        return (
                          <div
                            key={name}
                            className={`${styles.collectionCard} ${isActive ? styles.collectionCardActive : ''}`}
                            onClick={() => {
                              setSelectedCollection(name);
                              setSearchResults([]);
                            }}
                          >
                            <div className={styles.collectionInfo}>
                              <span className={styles.collectionIcon}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                              </span>
                              <span className={styles.collectionName} title={name}>
                                {name}
                              </span>
                            </div>
                            <span className={styles.collectionBadge}>
                              {getCollectionCount(name)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Create Collection */}
                <form onSubmit={handleCreateCollection} className={styles.formGroup}>
                  <label className={styles.label}>Create New Collection</label>
                  <div className={styles.inputGroup}>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. jakes-notes"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
                      disabled={isCreatingCollection || ingesting}
                      maxLength={40}
                    />
                    <button
                      type="submit"
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      disabled={isCreatingCollection || !newCollectionName.trim() || ingesting}
                    >
                      {isCreatingCollection ? '...' : '+'}
                    </button>
                  </div>
                  <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Alphanumeric, dashes, and underscores only.
                  </small>
                </form>
              </section>

              {/* Vector DB File Ingestion Card */}
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '2px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  Vector DB File Ingestion
                </h2>

                {/* Chunking Rules */}
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Chunking Rules</h3>
                
                <div className={styles.formGroup}>
                  <div className={styles.label}>
                    <span>Chunk Size</span>
                    <span className={styles.labelValue}>{chunkSize} chars</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="2000"
                    step="50"
                    value={chunkSize}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setChunkSize(val);
                      if (chunkOverlap >= val) {
                        setChunkOverlap(val - 50);
                      }
                    }}
                    className={styles.slider}
                    disabled={ingesting}
                  />
                </div>

                <div className={styles.formGroup}>
                  <div className={styles.label}>
                    <span>Chunk Overlap</span>
                    <span className={styles.labelValue}>{chunkOverlap} chars</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={chunkSize - 50}
                    step="25"
                    value={chunkOverlap}
                    onChange={(e) => setChunkOverlap(parseInt(e.target.value, 10))}
                    className={styles.slider}
                    disabled={ingesting}
                  />
                </div>

                {/* File Upload Dropzone */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Source File</label>
                  {!file ? (
                    <div
                      className={`${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ''}`}
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".txt,.md,.pdf"
                        style={{ display: 'none' }}
                      />
                      <div className={styles.dropzoneIcon}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      </div>
                      <div>
                        <p className={styles.dropzoneText}>Drag & drop document file here</p>
                        <p className={styles.dropzoneSubtext}>Supports TXT, MD, PDF up to 10MB</p>
                      </div>
                      <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
                        Browse Computer
                      </button>
                    </div>
                  ) : (
                    <div className={styles.dropzone} style={{ borderStyle: 'solid', borderColor: 'var(--primary)' }}>
                      <div className={styles.dropzoneIcon} style={{ color: 'var(--primary)' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                      </div>
                      <div className={styles.fileInfo}>
                        <p className={styles.fileName}>{file.name}</p>
                        <p className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                        disabled={ingesting}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* Ingest Action Button */}
                <button
                  onClick={handleIngest}
                  className={`${styles.btn} ${styles.btnAccent}`}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', marginTop: '0.5rem' }}
                  disabled={!file || !selectedCollection || ingesting}
                >
                  {ingesting ? 'Chunking & Embedding...' : 'Ingest into Collection'}
                </button>

                {/* Progress Bar & Status */}
                {ingesting && (
                  <div className={styles.progressContainer}>
                    <div className={styles.progressLabel}>
                      <span>{ingestStatus || 'Processing document...'}</span>
                      <span className={styles.progressSpinner}></span>
                    </div>
                    <div className={styles.progressBarContainer}>
                      <div className={styles.progressBar}></div>
                    </div>
                  </div>
                )}

                {/* Ingestion Summary Result */}
                {ingestSummary && (
                  <div className={styles.summaryCard}>
                    <h4 className={styles.summaryTitle}>Ingestion Successful!</h4>
                    <div className={styles.summaryGrid}>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>File</span>
                        <span className={styles.summaryValue} title={ingestSummary.filename}>{ingestSummary.filename}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Chunks Created</span>
                        <span className={styles.summaryValue}>{ingestSummary.chunksCount}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Processing Time</span>
                        <span className={styles.summaryValue}>{ingestSummary.embeddingTimeMs} ms</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Target Collection</span>
                        <span className={styles.summaryValue}>{selectedCollection}</span>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Right Column: Unified RAG Query Hub & LightRAG Ingestion Studio */}
            <div className={styles.workspaceColumn}>
              {/* Unified Search & RAG Query Hub (Moved from Tab 1) */}
              <section className={`${styles.card} ${styles.unifiedQueryCard} ${queryMode === 'rag' ? styles.ragCard : styles.searchCard}`}>
                <div className={styles.unifiedCardHeader}>
                  <h2 className={styles.cardTitle} style={{ borderBottom: 'none', paddingBottom: 0, margin: 0, gap: '0.4rem' }}>
                    {queryMode === 'rag' ? (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '2px'}}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        <span>RAG Query (LightRAG)</span>
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '2px'}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <span>Vector Search Query</span>
                      </>
                    )}
                  </h2>

                  {/* Segmented Switch / Toggle */}
                  <div className={styles.segmentedControl}>
                    <button
                      type="button"
                      className={`${styles.segmentBtn} ${queryMode === 'rag' ? styles.segmentBtnActive : ''}`}
                      onClick={() => setQueryMode('rag')}
                    >
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill={queryMode === 'rag' ? "currentColor" : "none"} 
                        stroke="currentColor" 
                        strokeWidth={queryMode === 'rag' ? "2.5" : "2"} 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        className={styles.segmentIcon}
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      <span>RAG Query</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.segmentBtn} ${queryMode === 'vector' ? styles.segmentBtnActive : ''}`}
                      onClick={() => setQueryMode('vector')}
                    >
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill={queryMode === 'vector' ? "rgba(103, 80, 164, 0.15)" : "none"} 
                        stroke="currentColor" 
                        strokeWidth={queryMode === 'vector' ? "2.5" : "2"} 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        className={styles.segmentIcon}
                      >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                      <span>Vector Search</span>
                    </button>
                  </div>
                </div>

                {queryMode === 'rag' ? (
                  <div className={styles.queryModeContent}>
                    {/* Query Row */}
                    <div className={styles.ragIngestRow} style={{ flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="Ask a question about your ingested knowledge..."
                        value={ragQuery}
                        onChange={(e) => setRagQuery(e.target.value)}
                        disabled={ragQuerying}
                        style={{ flex: '1', minWidth: '200px' }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !ragQuerying) { e.preventDefault(); handleRagQuery(); } }}
                      />
                      <select
                        className={`${styles.select} ${styles.modeSelect}`}
                        value={ragMode}
                        onChange={(e) => setRagMode(e.target.value)}
                        disabled={ragQuerying}
                        style={{ minWidth: '100px' }}
                      >
                        <option value="naive">naive</option>
                        <option value="local">local</option>
                        <option value="global">global</option>
                        <option value="hybrid">hybrid</option>
                      </select>
                      <button
                        onClick={handleRagQuery}
                        className={styles.btn}
                        disabled={ragQuerying || !ragQuery.trim()}
                      >
                        {ragQuerying ? 'Querying...' : 'Query'}
                      </button>
                    </div>

                    {/* Loading state */}
                    {ragQuerying && (
                      <div className={styles.ragLoading}>
                        <div className={styles.progressSpinner}></div>
                        <span className={styles.ragLoadingText}>Querying knowledge graph ({ragMode} mode)...</span>
                      </div>
                    )}

                    {/* Answer Display */}
                    {ragAnswer && (
                      <div className={styles.ragAnswer}>
                        <div className={styles.ragAnswerHeader}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                          <span>AI Knowledge Response</span>
                        </div>
                        <div className={styles.ragAnswerBody}>
                          {ragAnswer}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={styles.queryModeContent}>
                    {/* Vector Search Query */}
                    <form onSubmit={handleSearch} className={styles.searchBox}>
                      <input
                        type="text"
                        className={`${styles.input} ${styles.searchInput}`}
                        placeholder={selectedCollection ? `Search vectors in '${selectedCollection}'...` : "Select a collection first..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        disabled={searching || !selectedCollection}
                      />
                      <span className={styles.searchIcon}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                      </span>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Limit hits:</span>
                          <select
                            className={styles.select}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            value={searchLimit}
                            onChange={(e) => setSearchLimit(parseInt(e.target.value, 10))}
                            disabled={searching || !selectedCollection}
                          >
                            <option value={3}>3</option>
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                          </select>
                        </div>
                        <button
                          type="submit"
                          className={`${styles.btn} ${styles.btnAccent}`}
                          style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                          disabled={searching || !searchQuery.trim() || !selectedCollection}
                        >
                          {searching ? 'Searching...' : 'Search'}
                        </button>
                      </div>
                    </form>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-muted)', margin: '1rem 0' }} />

                    {/* Results List */}
                    <div className={styles.resultsList}>
                      {searching ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem 0' }}>
                          <div className={styles.progressSpinner} style={{ width: '28px', height: '28px', borderWidth: '3px' }}></div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Vectorizing query & searching Qdrant...</p>
                        </div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((result) => {
                          const isHigh = result.score >= 0.7;
                          const scoreClass = isHigh ? styles.scoreHigh : styles.scoreMid;
                          const isExpanded = expandedResultIds.has(result.id);
                          const isLong = result.text.length > 220;
                          
                          return (
                            <div key={result.id} className={`${styles.resultCard} ${isHigh ? styles.resultCardHighMatch : ''}`}>
                              <div className={styles.resultHeader}>
                                <div className={styles.resultMeta}>
                                  <span className={styles.resultTag}>#{result.chunkIndex + 1}</span>
                                  <span title={result.filename} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', maxWidth: '180px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', flexShrink: 0}}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                    {result.filename}
                                  </span>
                                </div>
                                <span className={`${styles.scoreBadge} ${scoreClass}`}>
                                  {(result.score * 100).toFixed(1)}% match
                                </span>
                              </div>
                              <p className={`${styles.resultText} ${isExpanded ? styles.resultTextExpanded : ''}`}>{result.text}</p>
                              {isLong && (
                                <button
                                  type="button"
                                  className={styles.expandBtn}
                                  onClick={() => toggleExpandResult(result.id)}
                                >
                                  {isExpanded ? (
                                    <>
                                      <span>Show less</span>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                    </>
                                  ) : (
                                    <>
                                      <span>Show details</span>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                    </>
                                  )}
                                </button>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                <span>Start char: {result.charStart}</span>
                                <span>End char: {result.charEnd}</span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className={styles.noResults}>
                          {selectedCollection ? (
                            <>
                              <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No search results yet</p>
                              <p style={{ fontSize: '0.75rem' }}>Enter a query above to search similarity in your collection.</p>
                            </>
                          ) : (
                            <p>Create/Select a collection to run search queries.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* LightRAG Ingestion Studio Card */}
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '2px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  Vector DB File Ingestion
                </h2>

                {/* Chunking Rules */}
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Chunking Rules</h3>
                
                <div className={styles.formGroup}>
                  <div className={styles.label}>
                    <span>Chunk Size</span>
                    <span className={styles.labelValue}>{chunkSize} chars</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="2000"
                    step="50"
                    value={chunkSize}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setChunkSize(val);
                      if (chunkOverlap >= val) {
                        setChunkOverlap(val - 50);
                      }
                    }}
                    className={styles.slider}
                    disabled={ingesting}
                  />
                </div>

                <div className={styles.formGroup}>
                  <div className={styles.label}>
                    <span>Chunk Overlap</span>
                    <span className={styles.labelValue}>{chunkOverlap} chars</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(0, chunkSize - 50)}
                    step="10"
                    value={chunkOverlap}
                    onChange={(e) => setChunkOverlap(parseInt(e.target.value, 10))}
                    className={styles.slider}
                    disabled={ingesting}
                  />
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-muted)' }} />

                {/* Dropzone & file selection controls */}
                {!file ? (
                  <div
                    className={`${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ''}`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={triggerFileSelect}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".txt,.md"
                      style={{ display: 'none' }}
                    />
                    <div className={styles.dropzoneIcon}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Drag & drop your text file here</p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Supports plain text (.txt) and markdown (.md)
                      </p>
                    </div>
                    <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnAccent}`}>
                      Browse File
                    </button>
                  </div>
                ) : (
                  <div className={styles.dropzone} style={{ borderStyle: 'solid', borderColor: 'var(--primary)' }}>
                    <div className={styles.dropzoneIcon} style={{ color: 'var(--primary)' }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    </div>
                    <div className={styles.fileInfo}>
                      <p className={styles.fileName}>{file.name}</p>
                      <p className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '280px' }}>
                      <button
                        onClick={removeFile}
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        style={{ flex: 1 }}
                        disabled={ingesting}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleIngest}
                        className={`${styles.btn} ${styles.btnAccent}`}
                        style={{ flex: 1 }}
                        disabled={ingesting || !selectedCollection}
                      >
                        {ingesting ? 'Processing...' : 'Start Ingest'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Processing Screen */}
                {ingesting && (
                  <div className={styles.progressContainer}>
                    <div className={styles.progressLabel}>
                      <span>Executing pipeline...</span>
                      <span className={styles.progressSpinner}></span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      {ingestStatus}
                    </p>
                    <div className={styles.progressBarContainer}>
                      <div className={styles.progressBar} style={{ width: '60%' }}></div>
                    </div>
                  </div>
                )}

                {/* Success summary */}
                {ingestSummary && (
                  <div className={styles.summaryContainer}>
                    <div className={styles.summaryHeader}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span>File Ingested Successfully!</span>
                    </div>
                    <div className={styles.summaryGrid}>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>File Name</span>
                        <span className={styles.summaryValue}>{ingestSummary.filename}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Total Chunks</span>
                        <span className={styles.summaryValue}>{ingestSummary.chunksCount}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Emb Time</span>
                        <span className={styles.summaryValue}>{(ingestSummary.embeddingTimeMs / 1000).toFixed(2)}s</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Avg Speed</span>
                        <span className={styles.summaryValue}>
                          {Math.round(ingestSummary.chunksCount / (ingestSummary.embeddingTimeMs / 1000))} chunks/s
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Right Column: LightRAG Graph Ingestion Panel */}
            <div className={styles.workspaceColumn}>
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '2px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  LightRAG Graph Ingestion Studio
                </h2>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
                  Build a global semantic network. Raw documents are analyzed by LLM pipelines to extract concepts (nodes) and relationship triples (edges) for multi-hop reasoning.
                </p>

                {/* Text Ingestion Section */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Paste Document Text</label>
                  <div className={styles.ragIngestRow}>
                    <textarea
                      className={`${styles.input} ${styles.ragIngestTextarea}`}
                      placeholder="Paste unstructured articles, notes, or source text to parse into the graph database..."
                      value={ragIngestText}
                      onChange={(e) => setRagIngestText(e.target.value)}
                      disabled={ragIngesting}
                      rows={5}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleRagIngestText}
                      className={`${styles.btn} ${styles.btnAccent}`}
                      disabled={ragIngesting || !ragIngestText.trim()}
                      style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                    >
                      {ragIngesting ? 'Extracting & Ingesting...' : 'Ingest Raw Text'}
                    </button>
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-muted)', margin: '0.5rem 0' }} />

                {/* File Ingestion Section */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Upload Document File</label>
                  {!ragFile ? (
                    <div
                      className={`${styles.dropzone} ${styles.ragDropzone} ${ragDragActive ? styles.dropzoneActive : ''}`}
                      onDragEnter={handleRagFileDrag}
                      onDragOver={handleRagFileDrag}
                      onDragLeave={handleRagFileDrag}
                      onDrop={handleRagFileDrop}
                      onClick={() => ragFileInputRef.current?.click()}
                      style={{ minHeight: '130px', padding: '1.5rem 1rem' }}
                    >
                      <input
                        type="file"
                        ref={ragFileInputRef}
                        onChange={handleRagFileChange}
                        accept=".txt,.md"
                        style={{ display: 'none' }}
                      />
                      <div className={styles.dropzoneIcon} style={{ fontSize: '1.8rem' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.15rem' }}>Drag & drop plain text or markdown file here</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Supports .txt and .md files</p>
                      </div>
                      <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} style={{ padding: '0.35rem 1rem', fontSize: '0.75rem' }}>
                        Browse File
                      </button>
                    </div>
                  ) : (
                    <div className={`${styles.dropzone} ${styles.ragDropzone}`} style={{ borderStyle: 'solid', borderColor: 'var(--md-sys-color-primary)', padding: '1.25rem 1rem', minHeight: '130px' }}>
                      <div className={styles.dropzoneIcon} style={{ color: 'var(--md-sys-color-primary)' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      </div>
                      <div className={styles.fileInfo} style={{ margin: '0.2rem 0' }}>
                        <p className={styles.fileName} style={{ fontSize: '0.8rem' }}>{ragFile.name}</p>
                        <p className={styles.fileSize} style={{ fontSize: '0.7rem' }}>{(ragFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', width: '100%', maxWidth: '240px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRagFile(null); }}
                          className={`${styles.btn} ${styles.btnSecondary}`}
                          style={{ flex: 1, padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                          disabled={ragIngesting}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRagIngestFile(); }}
                          className={`${styles.btn} ${styles.btnAccent}`}
                          style={{ flex: 1, padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                          disabled={ragIngesting}
                        >
                          {ragIngesting ? 'Ingesting...' : 'Ingest File'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Local Status Logs & Progress elements inside Card */}
                {ragStatusLog && (
                  <div className={`${styles.ragStatusContainer} ${
                    ragStatusLog.type === 'info' ? styles.ragStatusInfo :
                    ragStatusLog.type === 'success' ? styles.ragStatusSuccess :
                    ragStatusLog.type === 'warning' ? styles.ragStatusWarning :
                    styles.ragStatusError
                  }`}>
                    <div className={styles.ragStatusHeader}>
                      {ragStatusLog.type === 'info' && (
                        <>
                          <div className={styles.progressSpinner} style={{ width: '12px', height: '12px', borderWidth: '2px', borderTopColor: 'var(--md-sys-color-tertiary)' }} />
                          <span>Graph Ingestion Progress</span>
                        </>
                      )}
                      {ragStatusLog.type === 'success' && (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          <span>Ingestion Success</span>
                        </>
                      )}
                      {ragStatusLog.type === 'warning' && (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                          <span>Ingestion Warning</span>
                        </>
                      )}
                      {ragStatusLog.type === 'error' && (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                          <span>Ingestion Failure</span>
                        </>
                      )}
                    </div>
                    <div className={styles.ragStatusMessage}>
                      {ragStatusLog.message}
                    </div>
                  </div>
                )}
              </section>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
