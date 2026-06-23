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

  // General error/success alerts
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Fetch collections
  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch('/api/collections');
      const data = await res.json();
      if (res.ok) {
        setCollections(data.collections || []);
        if (data.collections?.length > 0 && !selectedCollection) {
          setSelectedCollection(data.collections[0]);
        }
      } else {
        setErrorMsg(data.error || 'Failed to load collections');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error connecting to API server');
    }
  }, [selectedCollection]);

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

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logoArea}>
          <div className={styles.logoIcon}></div>
          <h1 className={styles.logoTitle}>NeuralIngest v1</h1>
        </div>
        <div className={styles.dbBadge}>
          <div className={styles.dbIndicator}></div>
          <span>Qdrant Vector DB Active</span>
        </div>
      </header>

      {/* Top Banner Alert System */}
      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
          padding: '0.75rem 2rem',
          textAlign: 'center',
          fontSize: '0.9rem',
          animation: 'slideUp 0.2s ease-out'
        }}>
          ⚠️ {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#a7f3d0',
          padding: '0.75rem 2rem',
          textAlign: 'center',
          fontSize: '0.9rem',
          animation: 'slideUp 0.2s ease-out'
        }}>
          ✓ {successMsg}
        </div>
      )}

      <main className={styles.mainGrid}>
        {/* Left Column: Configuration & Collections */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            <span>⚙️</span> Collection Configuration
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
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>Chunking Rules</h3>
          
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
            <span>📥</span> File Ingestion Portal
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
              <div className={styles.dropzoneIcon}>📄</div>
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
              <div className={styles.dropzoneIcon} style={{ color: 'var(--primary)' }}>📝</div>
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
                <div className={styles.progressBar} style={{ width: '60%', animation: 'pulseGlow 1.5s infinite' }}></div>
              </div>
            </div>
          )}

          {/* Success summary */}
          {ingestSummary && (
            <div className={styles.summaryContainer}>
              <div className={styles.summaryHeader}>
                <span>✓</span>
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
            <span>🔍</span> Vector Search Query
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
            <span className={styles.searchIcon}>🔍</span>

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
                        <span title={result.filename} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                          📁 {result.filename}
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
    </div>
  );
}
