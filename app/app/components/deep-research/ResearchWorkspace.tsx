'use client';

import { useState, useMemo } from 'react';
import { ExecutionGraph } from './ExecutionGraph';
import { ResearchSketch } from './ResearchSketch';
import { ObservabilityTimeline } from './ObservabilityTimeline';
import { SourceList } from './SourceList';
import { TraceEvent, ResearchBrief, Sketch, Source } from '@/app/lib/research-contracts';
import styles from './deep-research.module.css';

type RunState = 'starting' | 'researching' | 'completed' | 'failed' | 'ingesting' | 'ingested';

interface IngestResult {
  success: boolean;
  partial: boolean;
  totalChunks: number;
  ingestedUrls: string[];
  failedUrls: string[];
}

interface ResearchWorkspaceProps {
  query: string;
  runState: RunState;
  elapsedMs: number;
  onNewResearch: () => void;
  onCancel: () => void;
  trace: TraceEvent[];
  brief: ResearchBrief | null;
  sketch: Sketch | null;
  sources: Source[];
  selectedSourceUrls: Set<string>;
  onToggleSource: (url: string) => void;
  onToggleAllSources: () => void;
  onIngest: () => void;
  ingestDisabled: boolean;
  ingestResult: IngestResult | null;
  errorMessage: string;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

export function ResearchWorkspace({
  query,
  runState,
  elapsedMs,
  onNewResearch,
  onCancel,
  trace,
  brief,
  sketch,
  sources,
  selectedSourceUrls,
  onToggleSource,
  onToggleAllSources,
  onIngest,
  ingestDisabled,
  ingestResult,
  errorMessage,
}: ResearchWorkspaceProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const isRunning = runState === 'starting' || runState === 'researching';
  const briefNodeId = trace.find((event) => event.type === 'brief_generated')?.id;
  const statusLabel = useMemo(() => {
    switch (runState) {
      case 'starting': return 'Starting';
      case 'researching': return 'Researching';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      case 'ingesting': return 'Importing';
      case 'ingested': return 'Imported';
      default: return runState;
    }
  }, [runState]);

  return (
    <div className={styles.mainContent}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <div className={styles.queryStatus}>
            <span className={styles.srOnly} aria-live="polite">Research status: {statusLabel}</span>
            <span className={styles.queryText} title={query}>&quot;{query}&quot;</span>
            <span className={`${styles.statusBadge} ${styles[`status-${runState}`]}`}>
              {statusLabel}
            </span>
            {isRunning && <span className={styles.elapsed}>{formatElapsed(elapsedMs)}</span>}
          </div>
          {isRunning && (
            <button className={styles.cancelButton} onClick={onCancel} aria-label="Cancel research">
              Cancel
            </button>
          )}
          {!isRunning && (
            <button className={styles.newButton} onClick={onNewResearch} aria-label="New research">
              New research
            </button>
          )}
        </div>

        {/* Four-pane grid */}
        <div className={styles.grid}>
          {/* Left column: graph + observability */}
          <div className={styles.leftColumn}>
            <section className={styles.pane} aria-label="Execution graph">
              <h2 className={styles.paneTitle}>Execution Graph</h2>
              <ExecutionGraph
                trace={trace}
                brief={brief}
                isResearching={isRunning}
                selectedNodeId={selectedNodeId}
                onNodeSelect={setSelectedNodeId}
              />
            </section>
            <section className={styles.pane} aria-label="Observability">
              <h2 className={styles.paneTitle}>Observability</h2>
              <ObservabilityTimeline
                trace={trace}
                brief={brief}
                isResearching={isRunning}
                focusedNodeId={selectedNodeId}
              />
            </section>
          </div>

          {/* Right column: sketch + sources */}
          <div className={styles.rightColumn}>
            <section className={styles.pane} aria-label="Research sketch">
              <h2 className={styles.paneTitle}>Research Sketch</h2>
              <ResearchSketch sketch={sketch} brief={brief} focused={selectedNodeId === briefNodeId} />
            </section>
            <section className={styles.pane} aria-label="Sources">
              <h2 className={styles.paneTitle}>
                Sources ({sources.length})
              </h2>
              <SourceList
                sources={sources}
                selectedUrls={selectedSourceUrls}
                onToggle={onToggleSource}
                onToggleAll={onToggleAllSources}
                onIngest={onIngest}
                ingestDisabled={ingestDisabled}
                ingestResult={ingestResult}
                errorMessage={errorMessage}
              />
            </section>
          </div>
        </div>
    </div>
  );
}
