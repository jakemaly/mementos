'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './page.module.css';

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

interface ResearchSource {
  url: string;
  title: string;
  snippet: string;
  score: number;
}

interface ResearchSketch {
  expectedConcepts: string[];
  discriminativeTerms: string[];
  searchQueries: string[];
}

export default function Dashboard() {
  // Collections state
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [newCollectionName, setNewCollectionName] = useState<string>('');
  const [isCreatingCollection, setIsCreatingCollection] = useState<boolean>(false);

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

  // Deep Research state
  const [researchQuery, setResearchQuery] = useState<string>('');
  const [researchDomains, setResearchDomains] = useState<string>('');
  const [researchFiletypes, setResearchFiletypes] = useState<string>('');
  const [sketch, setSketch] = useState<ResearchSketch | null>(null);
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [researching, setResearching] = useState<boolean>(false);
  const [ingestingWeb, setIngestingWeb] = useState<boolean>(false);
  const [ingestWebStatus, setIngestWebStatus] = useState<string>('');

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
        const collections = data.collections || [];
        setCollections(collections);
        if (collections.length > 0) {
          setSelectedCollection((prev) => prev || collections[0]);
        }
      } else {
        setErrorMsg(data.error || 'Failed to load collections');
      }
    } catch (err) {
      console.error(err);
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
  const handleResearch = async () => {
    if (!researchQuery.trim()) {
      setErrorMsg('Enter a research query');
      return;
    }

    setResearching(true);
    setErrorMsg('');
    setSketch(null);
    setSources([]);
    setSelectedSources(new Set());

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: researchQuery,
          domains: researchDomains
            ? researchDomains.split(',').map((d) => d.trim()).filter(Boolean)
            : [],
          filetypes: researchFiletypes
            ? researchFiletypes.split(',').map((f) => f.trim()).filter(Boolean)
            : [],
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSketch(data.sketch);
        setSources(data.sources || []);
      } else {
        setErrorMsg(data.error || 'Research failed');
      }
    } catch {
      setErrorMsg('Network error during research');
    } finally {
      setResearching(false);
    }
  };

  const toggleSource = (url: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  const toggleAllSources = () => {
    setSelectedSources((prev) =>
      prev.size === sources.length
        ? new Set()
        : new Set(sources.map((s) => s.url))
    );
  };

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
      setErrorMsg('Enter text to ingest');
      return;
    }

    setRagIngesting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/rag/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ragIngestText.trim() }),
      });

      const data = await res.json().catch(() => ({ error: 'Invalid response from server' }));

      if (res.ok) {
        setSuccessMsg(data.message || 'Text ingested into RAG knowledge graph');
        setRagIngestText('');
      } else {
        setErrorMsg(data.error || 'RAG ingestion failed');
      }
    } catch {
      setErrorMsg('Network error during RAG ingestion');
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
        setSuccessMsg(data.message || `"${ragFile.name}" ingested into RAG knowledge graph`);
        setRagFile(null);
      } else {
        setErrorMsg(data.error || 'RAG ingestion failed');
      }
    } catch {
      setErrorMsg('RAG file ingestion failed');
    } finally {
      setRagIngesting(false);
    }
  };

  const handleIngestWeb = async () => {
    if (selectedSources.size === 0 || !selectedCollection) {
      setErrorMsg('Select sources and a collection to ingest');
      return;
    }

    setIngestingWeb(true);
    setIngestWebStatus('Starting ingestion...');
    setErrorMsg('');
    setSuccessMsg('');

    try {
      setIngestWebStatus('Fetching and processing selected sources...');

      const res = await fetch('/api/research/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: sources.filter((s) => selectedSources.has(s.url)),
          collection: selectedCollection,
          chunkSize,
          chunkOverlap,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(data.message || 'Ingestion complete!');
        setIngestWebStatus('');
      } else {
        setErrorMsg(data.error || 'Ingestion failed');
      }
    } catch {
      setErrorMsg('Network error during ingestion');
    } finally {
      setIngestingWeb(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logoArea}>
          <div className={styles.logoIcon}></div>
          <h1 className={styles.logoTitle}>NeuralIngest</h1>
        </div>
        <div className={styles.dbBadge}>
          <div className={styles.dbIndicator}></div>
          <span>Qdrant Active</span>
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

      <main className={styles.mainGrid}>
        {/* Left Column: Configuration & Collections */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '2px'}}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Collection Configuration
          </h2>

          {/* Select Collection */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Select Qdrant Collection</label>
            <select
              className={styles.select}
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
          </div>

          {/* Create Collection */}
          <form onSubmit={handleCreateCollection} className={styles.formGroup}>
            <label className={styles.label}>Or Create New Collection</label>
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

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-muted)' }} />

          {/* Ingestion Parameters */}
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
        </section>

        {/* Center Column: Drag-and-drop & Ingest status */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '2px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            File Ingestion Portal
          </h2>

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

        {/* Right Column: Query & Similarity Results */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '2px'}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            Vector Search Query
          </h2>

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

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-muted)' }} />

          {/* Results List */}
          <div className={styles.resultsList}>
            {searching ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem 0' }}>
                <div className={styles.progressSpinner} style={{ width: '28px', height: '28px', borderWidth: '3px' }}></div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Vectorizing query & searching Qdrant...</p>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((result) => {
                // Determine style depending on cosine similarity score
                const isHigh = result.score >= 0.7;
                const scoreClass = isHigh ? styles.scoreHigh : styles.scoreMid;
                
                return (
                  <div key={result.id} className={styles.resultCard}>
                    <div className={styles.resultHeader}>
                      <div className={styles.resultMeta}>
                        <span className={styles.resultTag}>#{result.chunkIndex + 1}</span>
                        <span title={result.filename} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', maxWidth: '180px' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', flexShrink: 0}}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                          {result.filename}
                        </span>
                      </div>
                      <span className={`${styles.scoreBadge} ${scoreClass}`}>
                        {(result.score * 100).toFixed(1)}% match
                      </span>
                    </div>
                    <p className={styles.resultText}>{result.text}</p>
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
        </section>
      </main>

      {/* Deep Research Section */}
      <section className={styles.card} style={{ maxWidth: '100%', margin: '0 1.25rem 1.25rem', width: 'calc(100% - 2.5rem)' }}>
        <h2 className={styles.cardTitle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '2px'}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          Deep Research (SIRA)
        </h2>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <textarea
            className={styles.input}
            placeholder="Enter your research query..."
            value={researchQuery}
            onChange={(e) => setResearchQuery(e.target.value)}
            disabled={researching}
            rows={3}
            style={{ flex: '1', minWidth: '250px', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '200px' }}>
            <input
              type="text"
              className={styles.input}
              placeholder="Domains (e.g. arxiv.org, github.com)"
              value={researchDomains}
              onChange={(e) => setResearchDomains(e.target.value)}
              disabled={researching}
            />
            <input
              type="text"
              className={styles.input}
              placeholder="Filetypes (e.g. pdf, html)"
              value={researchFiletypes}
              onChange={(e) => setResearchFiletypes(e.target.value)}
              disabled={researching}
            />
          </div>
        </div>

        <button
          onClick={handleResearch}
          className={`${styles.btn} ${styles.btnAccent}`}
          disabled={researching || !researchQuery.trim()}
        >
          {researching ? 'Running Research...' : 'Run Deep Research'}
        </button>

        {/* Sketch Display */}
        {sketch && (
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Expected-Response Sketch
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {sketch.expectedConcepts.map((c, i) => (
                <span key={i} className={styles.pill} style={{ background: 'rgba(79, 70, 229, 0.08)', color: 'var(--primary)', border: '1px solid rgba(79, 70, 229, 0.15)' }}>
                  {c}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {sketch.discriminativeTerms.map((t, i) => (
                <span key={i} className={styles.pill} style={{ background: 'rgba(13, 148, 136, 0.08)', color: 'var(--accent)', border: '1px solid rgba(13, 148, 136, 0.15)' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sources List */}
        {sources.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Discovered Sources ({sources.length})
              </h3>
              <button
                onClick={toggleAllSources}
                className={`${styles.btn} ${styles.btnSecondary}`}
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
              >
                {selectedSources.size === sources.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.4rem' }}>
              {sources.map((source) => (
                <div
                  key={source.url}
                  className={styles.resultCard}
                  style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: 'pointer' }}
                  onClick={() => toggleSource(source.url)}
                >
                  <input
                    type="checkbox"
                    checked={selectedSources.has(source.url)}
                    onChange={() => toggleSource(source.url)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginTop: '0.25rem', accentColor: 'var(--primary)' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {source.title}
                      </span>
                      <span className={`${styles.scoreBadge} ${source.score >= 0.3 ? styles.scoreHigh : styles.scoreMid}`}>
                        {(source.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {source.snippet}
                    </p>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {source.url}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Ingest Controls */}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {selectedSources.size} selected → ingest into
              </span>
              <select
                className={styles.select}
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                disabled={ingestingWeb}
                style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
              >
                {collections.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={handleIngestWeb}
                className={`${styles.btn} ${styles.btnAccent}`}
                disabled={ingestingWeb || selectedSources.size === 0 || !selectedCollection}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
              >
                {ingestingWeb ? 'Ingesting...' : `Ingest ${selectedSources.size} Sources`}
              </button>
            </div>

            {ingestingWeb && (
              <div className={styles.progressContainer} style={{ marginTop: '0.75rem' }}>
                <div className={styles.progressLabel}>
                  <span>{ingestWebStatus || 'Processing...'}</span>
                  <span className={styles.progressSpinner}></span>
                </div>
                <div className={styles.progressBarContainer}>
                  <div className={styles.progressBar} style={{ width: '60%', animation: 'pulse 1.5s ease-in-out infinite' }}></div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* RAG Query Section */}
      <section className={styles.card} style={{ maxWidth: '100%', margin: '0 1.25rem 1.25rem', width: 'calc(100% - 2.5rem)' }}>
        <h2 className={styles.cardTitle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '2px'}}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          RAG Query (LightRAG)
        </h2>

        {/* Query Row */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
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
            className={styles.select}
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
            className={`${styles.btn} ${styles.btnAccent}`}
            disabled={ragQuerying || !ragQuery.trim()}
          >
            {ragQuerying ? 'Querying...' : 'Query'}
          </button>
        </div>

        {/* Loading state */}
        {ragQuerying && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 0' }}>
            <div className={styles.progressSpinner}></div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Querying knowledge graph ({ragMode} mode)...</span>
          </div>
        )}

        {/* Answer Display */}
        {ragAnswer && (
          <div style={{
            background: 'rgba(79, 70, 229, 0.04)',
            border: '1px solid rgba(79, 70, 229, 0.12)',
            borderRadius: '8px',
            padding: '1.25rem',
            whiteSpace: 'pre-wrap',
            fontSize: '0.9rem',
            lineHeight: '1.6',
            color: 'var(--text-primary)',
            maxHeight: '400px',
            overflowY: 'auto',
            paddingRight: '0.4rem',
          }}>
            {ragAnswer}
          </div>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-muted)' }} />

        {/* Ingestion Area */}
        <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Ingest into Knowledge Graph</h3>

        {/* Text ingestion */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <textarea
            className={styles.input}
            placeholder="Paste text to ingest into the knowledge graph..."
            value={ragIngestText}
            onChange={(e) => setRagIngestText(e.target.value)}
            disabled={ragIngesting}
            rows={3}
            style={{ flex: '1', resize: 'vertical' }}
          />
          <button
            onClick={handleRagIngestText}
            className={`${styles.btn} ${styles.btnSecondary}`}
            disabled={ragIngesting || !ragIngestText.trim()}
            style={{ height: '40px' }}
          >
            {ragIngesting ? '...' : 'Ingest'}
          </button>
        </div>

        {/* File ingestion */}
        <div
          className={`${styles.dropzone} ${ragDragActive ? styles.dropzoneActive : ''}`}
          style={{ minHeight: '100px', padding: '1.5rem' }}
          onDragEnter={handleRagFileDrag}
          onDragOver={handleRagFileDrag}
          onDragLeave={handleRagFileDrag}
          onDrop={handleRagFileDrop}
          onClick={() => ragFileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={ragFileInputRef}
            onChange={handleRagFileChange}
            accept=".txt,.md"
            style={{ display: 'none' }}
          />
          {ragFile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
              <span style={{ flex: 1, fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ragFile.name}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {(ragFile.size / 1024).toFixed(1)} KB
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleRagIngestFile(); }}
                className={`${styles.btn} ${styles.btnAccent}`}
                disabled={ragIngesting}
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', height: 'auto' }}
              >
                {ragIngesting ? '...' : 'Ingest'}
              </button>
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
              Drop a .txt or .md file here, or click to browse
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
