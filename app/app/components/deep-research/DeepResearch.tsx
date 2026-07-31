'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ResearchComposer } from './ResearchComposer';
import { AppShell } from '@/app/components/app-shell/AppShell';
import { ResearchWorkspace } from './ResearchWorkspace';
import { Source, TraceEvent, ResearchBrief, Sketch } from '@/app/lib/research-contracts';
import styles from './deep-research.module.css';
import {
  canonicalSourceKey,
  mergeSources,
  reconcileFinalSources,
  selectDiscoveredSources,
} from './research-state';

type RunState = 'idle' | 'starting' | 'researching' | 'completed' | 'failed' | 'ingesting' | 'ingested';

interface IngestResult {
  success: boolean;
  partial: boolean;
  totalChunks: number;
  ingestedUrls: string[];
  failedUrls: string[];
}

interface DeepResearchProps {
  collections: string[];
  selectedCollection: string;
  collectionUnavailable: boolean;
  onCollectionChange: (collection: string) => void;
  onOpenCollections?: () => void;
  onOpenKnowledgeBase?: () => void;
}

export function DeepResearch({
  collections,
  selectedCollection,
  collectionUnavailable,
  onCollectionChange,
  onOpenCollections,
  onOpenKnowledgeBase,
}: DeepResearchProps) {
  const [runState, setRunState] = useState<RunState>('idle');
  const [query, setQuery] = useState('');
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [brief, setBrief] = useState<ResearchBrief | null>(null);
  const [sketch, setSketch] = useState<Sketch | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSourceUrls, setSelectedSourceUrls] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState('');
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string>('');
  const deselectedUrlsRef = useRef<Set<string>>(new Set());

  const isCurrentRun = useCallback((runId: string) => runIdRef.current === runId, []);

  // Auto-clear error after 6s
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (!startedAt || (runState !== 'starting' && runState !== 'researching')) return;
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, runState]);

  const clearRun = useCallback((clearQuery = true) => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    runIdRef.current = '';
    setTrace([]);
    setBrief(null);
    setSketch(null);
    setSources([]);
    setSelectedSourceUrls(new Set());
    deselectedUrlsRef.current = new Set();
    setErrorMessage('');
    setIngestResult(null);
    setStartedAt(null);
    setElapsedMs(0);
    if (clearQuery) setQuery('');
  }, []);

  const handleSubmit = useCallback(() => {
    if (!query.trim() || !selectedCollection || collectionUnavailable) return;

    clearRun(false);

    const runId = crypto.randomUUID();
    runIdRef.current = runId;
    setStartedAt(Date.now());
    setRunState('starting');
    setErrorMessage('');

    const abortController = new AbortController();
    abortRef.current = abortController;

    fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.trim() }),
      signal: abortController.signal,
    })
      .then(async (res) => {
        if (!isCurrentRun(runId)) return;
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Research failed' }));
          setErrorMessage(err.error || 'Research failed');
          setRunState('failed');
          return;
        }

        setRunState('researching');

        const reader = res.body?.getReader();
        if (!reader) {
          setErrorMessage('No response stream');
          setRunState('failed');
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!isCurrentRun(runId)) return;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const block of lines) {
            const eventMatch = block.match(/^event:\s*(.+)$/m);
            const dataMatch = block.match(/^data:\s*(.+)$/m);
            if (!eventMatch || !dataMatch) continue;

            const eventType = eventMatch[1].trim();
            try {
              const data = JSON.parse(dataMatch[1].trim());

              if (eventType === 'brief_generated') {
                setTrace((prev) => [...prev, data]);
                const payload = data.payload || data;
                setBrief({
                  reasoning_trace: payload.reasoning || [],
                  brief: payload.brief || '',
                  tools: payload.tools || [],
                  queries: payload.queries || { overview: [], specific: [] },
                });
                const sk = payload.sketch;
                if (sk) {
                  setSketch({
                    expected_concepts: sk.expected_concepts || sk.expectedConcepts || [],
                    discriminative_terms: sk.discriminative_terms || sk.discriminativeTerms || [],
                    expected_patterns: sk.expected_patterns || sk.expectedPatterns || [],
                    preferred_domains: sk.preferred_domains || sk.preferredDomains || [],
                  });
                }
              } else if (eventType === 'sources_discovered') {
                const payload = data.payload || data;
                const newSources = (payload.sources as Source[]) || [];
                setSources((prev) => mergeSources(prev, newSources));
                // Auto-select newly discovered sources unless explicitly deselected
                setSelectedSourceUrls((prev) =>
                  selectDiscoveredSources(prev, newSources, deselectedUrlsRef.current),
                );
              } else if (eventType === 'done') {
                setTrace((prev) => [...prev, {
                  id: `done-${runId}`,
                  type: 'done',
                  payload: { source_count: Array.isArray(data.sources) ? data.sources.length : 0, partial: Boolean(data.partial) },
                  timestamp: Date.now() / 1000,
                }]);
                if (data.sources) {
                  const finalSources = data.sources.map((s: { url: string; title?: string; snippet?: string; score?: number }) => ({
                    url: s.url,
                    title: s.title || s.url,
                    snippet: s.snippet || '',
                    score: s.score || 0,
                  }));
                  // Reconcile final ranked sources with existing selection
                  setSources(finalSources);
                  // Preserve deselections
                  setSelectedSourceUrls(
                    reconcileFinalSources(finalSources, deselectedUrlsRef.current),
                  );
                }
                const sk = data.sketch;
                if (sk) {
                  setSketch({
                    expected_concepts: sk.expected_concepts || sk.expectedConcepts || [],
                    discriminative_terms: sk.discriminative_terms || sk.discriminativeTerms || [],
                    expected_patterns: sk.expected_patterns || sk.expectedPatterns || [],
                    preferred_domains: sk.preferred_domains || sk.preferredDomains || [],
                  });
                }
                if (data.partial) {
                  setErrorMessage(`Research timed out at ${data.timeout_phase || 'unknown phase'}`);
                  setRunState('failed');
                } else {
                  setRunState('completed');
                }
              } else if (eventType === 'error') {
                setTrace((prev) => [...prev, {
                  id: `error-${runId}`,
                  type: 'error',
                  payload: { message: data.payload?.message || data.message || 'Research error' },
                  timestamp: Date.now() / 1000,
                }]);
                setErrorMessage(data.payload?.message || data.message || 'Research error');
                setRunState('failed');
              } else {
                setTrace((prev) => [...prev, data]);
              }
            } catch {
              // Skip malformed SSE blocks
            }
          }
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError' || !isCurrentRun(runId)) return;
        setErrorMessage('Network error during research');
        setRunState('failed');
      })
      .finally(() => {
        if (isCurrentRun(runId)) abortRef.current = null;
      });
  }, [query, selectedCollection, collectionUnavailable, clearRun, isCurrentRun]);

  const handleCancel = useCallback(() => {
    clearRun();
    setRunState('idle');
  }, [clearRun]);

  const handleNewResearch = useCallback(() => {
    clearRun();
    setRunState('idle');
  }, [clearRun]);

  const handleToggleSource = useCallback((url: string) => {
    setSelectedSourceUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
        const nextDeselected = new Set(deselectedUrlsRef.current);
        nextDeselected.add(canonicalSourceKey(url));
        deselectedUrlsRef.current = nextDeselected;
      } else {
        const nextDeselected = new Set(deselectedUrlsRef.current);
        nextDeselected.delete(canonicalSourceKey(url));
        deselectedUrlsRef.current = nextDeselected;
        next.add(url);
      }
      return next;
    });
  }, []);

  const handleToggleAllSources = useCallback(() => {
    if (selectedSourceUrls.size === sources.length) {
      setSelectedSourceUrls(new Set());
      deselectedUrlsRef.current = new Set(sources.map((s) => canonicalSourceKey(s.url)));
    } else {
      setSelectedSourceUrls(new Set(sources.map((s) => s.url)));
      deselectedUrlsRef.current = new Set();
    }
  }, [sources, selectedSourceUrls]);

  const handleIngest = useCallback(async () => {
    if (selectedSourceUrls.size === 0 || !selectedCollection || collectionUnavailable) return;

    setRunState('ingesting');
    setIngestResult(null);
    setErrorMessage('');

    try {
      const res = await fetch('/api/research/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: sources.filter((s) => selectedSourceUrls.has(s.url)),
          collection: selectedCollection,
          chunkSize: 500,
          chunkOverlap: 50,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const result: IngestResult = {
          success: Boolean(data.success),
          partial: Boolean(data.partial),
          totalChunks: data.totalChunks || 0,
          ingestedUrls: data.ingestedUrls || [],
          failedUrls: data.failedUrls || [],
        };
        setIngestResult(result);
        if (!result.success && !result.partial) {
          setErrorMessage(data.message || 'No selected sources could be imported');
          setRunState('completed');
        } else {
          setRunState('ingested');
        }
      } else {
        setErrorMessage(data.error || 'Ingestion failed');
        setRunState('completed');
      }
    } catch {
      setErrorMessage('Network error during ingestion');
      setRunState('completed');
    }
  }, [sources, selectedSourceUrls, selectedCollection, collectionUnavailable]);

  if (runState === 'idle') {
    return (
      <AppShell activeDestination="research" onOpenKnowledgeBase={onOpenKnowledgeBase} onOpenCollections={onOpenCollections}>
        <main className={styles.composerMain}>
          <div className={styles.composerIntro}>
            <p className={styles.composerKicker}><span>01</span> Navigator</p>
            <p className={styles.composerStatus}>Research entry / {selectedCollection || 'Choose a collection'}</p>
            <h1>Begin with the question.</h1>
            <p className={styles.composerLede}>
              Turn a loose question into a traceable brief, a search route, and evidence you can revisit.
            </p>
          </div>

          <div className={styles.composerDeck}>
            <div className={styles.routeNote} aria-hidden="true">
              <span className={styles.routeNoteLine} />
              <span className={styles.routeNoteLabel}>Question → brief → evidence</span>
            </div>
            <div className={styles.composerPanel}>
              <ResearchComposer
                query={query}
                onQueryChange={setQuery}
                selectedCollection={selectedCollection}
                onCollectionChange={onCollectionChange}
                collections={collections}
                onSubmit={handleSubmit}
                disabled={collectionUnavailable || !query.trim() || !selectedCollection}
                placeholder="What should Mementos research?"
              />
              <p className={styles.composerHint}>Press Enter to begin · Shift + Enter for a new line</p>
            </div>
          </div>
          {errorMessage && <div className={styles.error} role="alert">{errorMessage}</div>}
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell activeDestination="research" onNewResearch={handleNewResearch} onOpenKnowledgeBase={onOpenKnowledgeBase} onOpenCollections={onOpenCollections}>
      <ResearchWorkspace
      query={query}
      runState={runState}
      elapsedMs={elapsedMs}
      onNewResearch={handleNewResearch}
      onCancel={handleCancel}
      trace={trace}
      brief={brief}
      sketch={sketch}
      sources={sources}
      selectedSourceUrls={selectedSourceUrls}
      onToggleSource={handleToggleSource}
      onToggleAllSources={handleToggleAllSources}
      onIngest={handleIngest}
      ingestDisabled={
        selectedSourceUrls.size === 0
        || runState === 'starting'
        || runState === 'researching'
        || runState === 'ingesting'
      }
      ingestResult={ingestResult}
      errorMessage={errorMessage}
      />
    </AppShell>
  );
}
