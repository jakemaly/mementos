'use client';

import { useState } from 'react';
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
  selectedCollection: string;
  runState: RunState;
  elapsedMs: number;
  onNewResearch: () => void;
  onCancel: () => void;
  trace: TraceEvent[];
  brief: ResearchBrief | null;
  sketch: Sketch | null;
  sources: Source[];
  selectedSourceKeys: Set<string>;
  onToggleSource: (url: string) => void;
  onToggleAllSources: () => void;
  onIngest: () => void;
  ingestDisabled: boolean;
  ingestResult: IngestResult | null;
  errorMessage: string;
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function statusCopy(runState: RunState): { label: string; detail: string } {
  switch (runState) {
    case 'starting': return { label: 'Starting', detail: 'Preparing the research brief.' };
    case 'researching': return { label: 'Researching', detail: 'Following search and supervisor events.' };
    case 'completed': return { label: 'Route mapped', detail: 'Evidence is ready to review.' };
    case 'failed': return { label: 'Failed', detail: 'The route stopped before completion.' };
    case 'ingesting': return { label: 'Importing', detail: 'Adding selected evidence to the collection.' };
    case 'ingested': return { label: 'Imported', detail: 'Selected evidence is in the collection.' };
  }
}

export function ResearchWorkspace({
  query,
  selectedCollection,
  runState,
  elapsedMs,
  onNewResearch,
  onCancel,
  trace,
  brief,
  sketch,
  sources,
  selectedSourceKeys,
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
  const status = statusCopy(runState);

  return (
    <main className={styles.mainContent} aria-labelledby="research-workspace-title">
      <header className={styles.workspaceHeader}>
        <div className={styles.workspaceKicker}>02 / Deep Research · route map</div>
        <div className={styles.workspaceTitleRow}>
          <div className={styles.workspaceHeading}>
            <h1 id="research-workspace-title">Follow the route.</h1>
            <p>One visible path from the brief through search to evidence, ready for review.</p>
          </div>
          <div className={styles.statusContext}>
            <div className={`${styles.statusStamp} ${styles[`status-${runState}`]}`} role="status" aria-live="polite">
              <span className={styles.statusMark} aria-hidden="true">{runState === 'failed' ? '!' : runState === 'ingested' ? '✓' : '•'}</span>
              <span>
                <strong>{status.label}</strong>
                <small>{status.detail}</small>
              </span>
            </div>
            {isRunning && <p className={styles.elapsed}>Elapsed {formatElapsed(elapsedMs)}</p>}
          </div>
        </div>
        <div className={styles.routeContext}>
          <div className={styles.routeQuery}>
            <span className={styles.fieldLabel}>Question / {selectedCollection || 'chosen collection'}</span>
            <p title={query}>{query}</p>
          </div>
          <div className={styles.routeActions}>
            {isRunning ? (
              <button type="button" className={styles.cancelButton} onClick={onCancel} aria-label="Cancel research">
                Cancel
              </button>
            ) : (
              <button type="button" className={styles.newButton} onClick={onNewResearch} aria-label="New research">
                New research
              </button>
            )}
          </div>
        </div>
        {runState === 'failed' && errorMessage && (
          <p className={styles.workspaceError} role="alert">{errorMessage}</p>
        )}
      </header>

      <div className={styles.workspaceGrid}>
        <section className={`${styles.panel} ${styles.routePanel}`} aria-label="Execution graph">
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.panelKicker}>Route / execution</span>
              <h2 className={styles.panelTitle}>Route map.</h2>
            </div>
            <span className={styles.panelMeta}>Event-derived · selectable</span>
          </div>
          <ExecutionGraph
            trace={trace}
            isResearching={isRunning}
            runState={runState}
            sourceCount={sources.length}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
          />
        </section>

        <section className={`${styles.panel} ${styles.sketchPanel}`} aria-label="Research sketch" tabIndex={0}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.panelKicker}>Brief / research sketch</span>
              <h2 className={styles.panelTitle}>What the route is looking for.</h2>
            </div>
            <span className={styles.panelMeta}>Read only</span>
          </div>
          <ResearchSketch sketch={sketch} brief={brief} focused={selectedNodeId === briefNodeId} />
        </section>

        <section className={`${styles.panel} ${styles.tracePanel}`} aria-label="Observability" tabIndex={0}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.panelKicker}>Trace / observability</span>
              <h2 className={styles.panelTitle}>What happened, in order.</h2>
            </div>
            <span className={styles.panelMeta}>Chronological · plain language</span>
          </div>
          <ObservabilityTimeline
            trace={trace}
            brief={brief}
            isResearching={isRunning}
            focusedNodeId={selectedNodeId}
          />
        </section>

        <section className={`${styles.panel} ${styles.evidencePanel}`} aria-label="Sources">
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.panelKicker}>Evidence / source register</span>
              <h2 className={styles.panelTitle}>Review, then import.</h2>
            </div>
            <span className={styles.panelMeta}>{sources.length} discovered</span>
          </div>
          <p className={styles.panelDescription}>Select the evidence worth keeping, then Import selected sources into {selectedCollection || 'the chosen collection'}.</p>
          <SourceList
            sources={sources}
            selectedKeys={selectedSourceKeys}
            onToggle={onToggleSource}
            onToggleAll={onToggleAllSources}
            onIngest={onIngest}
            ingestDisabled={ingestDisabled}
            ingestResult={ingestResult}
            errorMessage={runState === 'failed' ? '' : errorMessage}
          />
        </section>
      </div>
    </main>
  );
}
