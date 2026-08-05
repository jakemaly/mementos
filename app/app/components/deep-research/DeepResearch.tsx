'use client';

import Image from 'next/image';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import { projectTrace } from './trace-model';

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
  onOpenCollectionSettings?: () => void;
  onOpenKnowledgeBase?: () => void;
}

export function DeepResearch({
  collections,
  selectedCollection,
  collectionUnavailable,
  onCollectionChange,
  onOpenCollectionSettings,
  onOpenKnowledgeBase,
}: DeepResearchProps) {
  const [runState, setRunState] = useState<RunState>('idle');
  const [query, setQuery] = useState('');
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [brief, setBrief] = useState<ResearchBrief | null>(null);
  const [sketch, setSketch] = useState<Sketch | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSourceKeys, setSelectedSourceKeys] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState('');
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string>('');
  const traceRef = useRef<TraceEvent[]>([]);
  const deselectedUrlsRef = useRef<Set<string>>(new Set());
  const traceProjection = useMemo(() => projectTrace(trace), [trace]);

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

  const appendTraceEvent = useCallback((event: TraceEvent) => {
    const nextTrace = [...traceRef.current, event];
    traceRef.current = nextTrace;
    setTrace(nextTrace);

    const projection = projectTrace(nextTrace);
    if (projection.brief) setBrief(projection.brief.briefData);
    if (projection.sketch) setSketch(projection.sketch);

    const discoveredSources = projection.sourceDiscoveries.flatMap((fact) => fact.sources);
    if (discoveredSources.length > 0) {
      setSources((prev) => mergeSources(prev, discoveredSources));
      setSelectedSourceKeys((prev) =>
        selectDiscoveredSources(prev, discoveredSources, deselectedUrlsRef.current),
      );
    }
  }, []);

  const clearRun = useCallback((clearQuery = true) => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    runIdRef.current = '';
    traceRef.current = [];
    setTrace([]);
    setBrief(null);
    setSketch(null);
    setSources([]);
    setSelectedSourceKeys(new Set());
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
              const data = JSON.parse(dataMatch[1].trim()) as unknown;
              const record = asRecord(data);

              if (eventType === 'done') {
                const finalSourceData = Array.isArray(record.sources) ? record.sources : [];
                appendTraceEvent({
                  id: `done-${runId}`,
                  type: 'done',
                  payload: {
                    source_count: finalSourceData.length,
                    partial: record.partial === true,
                    timeout_phase: record.timeout_phase,
                    brief: record.brief,
                    sketch: record.sketch,
                  },
                  timestamp: Date.now() / 1000,
                });
                const finalSources = mergeSources([], finalSourceData.flatMap(toTerminalSource));
                if (Array.isArray(record.sources)) {
                  // Reconcile final ranked sources with existing selection.
                  setSources(finalSources);
                  // Preserve deselections.
                  setSelectedSourceKeys(
                    reconcileFinalSources(finalSources, deselectedUrlsRef.current),
                  );
                }
                if (record.partial === true) {
                  setErrorMessage(`Research timed out at ${asText(record.timeout_phase) || 'unknown phase'}`);
                  setRunState('failed');
                } else {
                  setRunState('completed');
                }
              } else if (eventType === 'error') {
                const errorPayload = isRecord(record.payload) ? record.payload : record;
                const message = asText(errorPayload.message) || asText(errorPayload.error) || 'Research error';
                appendTraceEvent({
                  id: `error-${runId}`,
                  type: 'error',
                  payload: { message, phase: errorPayload.phase },
                  timestamp: Date.now() / 1000,
                });
                setErrorMessage(message);
                setRunState('failed');
              } else {
                appendTraceEvent(toIncomingTraceEvent(data, eventType, runId));
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
  }, [query, selectedCollection, collectionUnavailable, clearRun, isCurrentRun, appendTraceEvent]);

  const handleCancel = useCallback(() => {
    clearRun();
    setRunState('idle');
  }, [clearRun]);

  const handleNewResearch = useCallback(() => {
    clearRun();
    setRunState('idle');
  }, [clearRun]);

  const handleToggleSource = useCallback((url: string) => {
    const key = canonicalSourceKey(url);
    setSelectedSourceKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        const nextDeselected = new Set(deselectedUrlsRef.current);
        nextDeselected.add(key);
        deselectedUrlsRef.current = nextDeselected;
      } else {
        const nextDeselected = new Set(deselectedUrlsRef.current);
        nextDeselected.delete(key);
        deselectedUrlsRef.current = nextDeselected;
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleToggleAllSources = useCallback(() => {
    const selectedCount = sources.filter((source) => selectedSourceKeys.has(canonicalSourceKey(source.url))).length;
    if (selectedCount === sources.length) {
      setSelectedSourceKeys(new Set());
      deselectedUrlsRef.current = new Set(sources.map((s) => canonicalSourceKey(s.url)));
    } else {
      setSelectedSourceKeys(new Set(sources.map((s) => canonicalSourceKey(s.url))));
      deselectedUrlsRef.current = new Set();
    }
  }, [sources, selectedSourceKeys]);

  const handleIngest = useCallback(async () => {
    const sourcesToIngest = sources.filter((source) => selectedSourceKeys.has(canonicalSourceKey(source.url)));
    if (sourcesToIngest.length === 0 || !selectedCollection || collectionUnavailable) return;

    setRunState('ingesting');
    setIngestResult(null);
    setErrorMessage('');

    try {
      const res = await fetch('/api/research/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: sourcesToIngest,
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
  }, [sources, selectedSourceKeys, selectedCollection, collectionUnavailable]);

  const hasSelectedSources = sources.some((source) => selectedSourceKeys.has(canonicalSourceKey(source.url)));

  if (runState === 'idle') {
    return (
      <AppShell activeDestination="research" onOpenKnowledgeBase={onOpenKnowledgeBase} onOpenCollectionSettings={onOpenCollectionSettings}>
        <main className={styles.composerMain}>
          <div className={styles.composerIntro}>
            <p className={styles.composerKicker}><span>01</span> Phantom archive</p>
            <p className={styles.composerStatus}>Research entry / {selectedCollection || 'Choose a collection'}</p>
            <h1>What to research today?</h1>
            <Image className={styles.knifeMark} src="/p5-dialogue/images/knife.png" alt="" width={32} height={44} aria-hidden="true" />
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
    <AppShell activeDestination="research" onNewResearch={handleNewResearch} onOpenKnowledgeBase={onOpenKnowledgeBase} onOpenCollectionSettings={onOpenCollectionSettings}>
      <ResearchWorkspace
      query={query}
      selectedCollection={selectedCollection}
      runState={runState}
      elapsedMs={elapsedMs}
      onNewResearch={handleNewResearch}
      onCancel={handleCancel}
      traceProjection={traceProjection}
      brief={brief}
      sketch={sketch}
      sources={sources}
      selectedSourceKeys={selectedSourceKeys}
      onToggleSource={handleToggleSource}
      onToggleAllSources={handleToggleAllSources}
      onIngest={handleIngest}
      ingestDisabled={
        !hasSelectedSources
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

function toIncomingTraceEvent(data: unknown, eventType: string, runId: string): TraceEvent {
  const record = asRecord(data);
  const timestamp = typeof record.timestamp === 'number' && Number.isFinite(record.timestamp)
    ? record.timestamp
    : Date.now() / 1000;
  const event: TraceEvent = {
    id: asText(record.id) || `${eventType}-${runId}-${Date.now()}`,
    type: eventType as TraceEvent['type'],
    payload: isRecord(record.payload) ? record.payload : record,
    timestamp,
  };
  const parentId = asText(record.parent_id);
  const iteration = typeof record.iteration === 'number' ? record.iteration : undefined;
  if (parentId) event.parent_id = parentId;
  if (iteration !== undefined) event.iteration = iteration;
  return event;
}

function toTerminalSource(value: unknown): Source[] {
  if (!isRecord(value) || !asText(value.url)) return [];
  return [{
    url: asText(value.url),
    title: asText(value.title) || asText(value.url),
    snippet: asText(value.snippet),
    score: typeof value.score === 'number' ? value.score : 0,
  }];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
