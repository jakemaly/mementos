'use client';

import { ReactNode, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ResearchBrief, Sketch, Source } from '@/app/lib/research-contracts';
import { ResearchTraceProjection } from './trace-model';
import { buildTraceRoute, CheckpointNode, IngestNode } from './trace-route';
import { SourceList } from './SourceList';
import { createCallingCardText } from '@/lib/calling-card-text';
import styles from './deep-research.module.css';

type RunState = 'starting' | 'researching' | 'completed' | 'failed' | 'ingesting' | 'ingested';

interface IngestResult {
  success: boolean;
  partial: boolean;
  totalChunks: number;
  ingestedUrls: string[];
  failedUrls: string[];
}

interface TraceSurfaceProps {
  query: string;
  selectedCollection: string;
  runState: RunState;
  elapsedMs: number;
  onNewResearch: () => void;
  onCancel: () => void;
  traceProjection: ResearchTraceProjection;
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
    case 'researching': return { label: 'Researching', detail: 'Following the search route.' };
    case 'completed': return { label: 'Route mapped', detail: 'Evidence is ready to review.' };
    case 'failed': return { label: 'Failed', detail: 'The route stopped before completion.' };
    case 'ingesting': return { label: 'Importing', detail: 'Adding selected evidence to the collection.' };
    case 'ingested': return { label: 'Imported', detail: 'Selected evidence is in the collection.' };
  }
}

// ── Calling-card query artwork ─────────────────────────────────────────

const CALLING_CARD_FONT_SIZE = 44;
const MAX_QUERY_LINES = 3;

/** Wrap a long query into a few readable lines, ellipsizing overflow. */
function wrapQueryLines(text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return [text];
  context.font = `bold ${CALLING_CARD_FONT_SIZE}px sans-serif`;

  const lines: string[] = [];
  let current = '';
  let dropped = false;

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const candidate = current ? `${current} ${word}` : word;
    if (!current || context.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === MAX_QUERY_LINES - 1) {
      dropped = index + 1 < words.length;
      break;
    }
  }

  if (!dropped) {
    lines.push(current);
  } else {
    let rest = current;
    while (rest && context.measureText(`${rest}…`).width > maxWidth) rest = rest.slice(0, -1);
    lines.push(rest ? `${rest}…` : '…');
  }
  return lines;
}

/**
 * Renders the query once as calling-card lettering. The artwork is
 * generated once per query and stays stable across live trace updates;
 * the wrapped text is composited as separate lines and scaled to fit.
 */
function CallingCardArt({ text }: { text: string }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;

    const width = Math.max(320, frame.clientWidth || 640);
    const lines = wrapQueryLines(text, width);
    const lineCanvases = lines.map((line) => createCallingCardText(line, { fontSize: CALLING_CARD_FONT_SIZE }));
    const gap = 12;
    const totalWidth = Math.max(...lineCanvases.map((item) => item.width));
    const totalHeight = lineCanvases.reduce((sum, item) => sum + item.height, 0) + gap * Math.max(0, lineCanvases.length - 1);

    canvas.width = totalWidth;
    canvas.height = totalHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, totalWidth, totalHeight);
    let y = 0;
    for (const line of lineCanvases) {
      context.drawImage(line, 0, y);
      y += line.height + gap;
    }
  }, [text]);

  return (
    <div ref={frameRef} className={styles.callingCardFrame}>
      <canvas ref={canvasRef} className={styles.callingCardCanvas} aria-hidden="true" />
    </div>
  );
}

// ── Connector geometry (deterministic, behind semantic content) ────────

function RowConnector({ active }: { active?: boolean }) {
  return (
    <svg
      className={`${styles.traceConnector} ${active ? styles.traceConnectorActive : ''}`}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M 50 40 L 46 30 L 54 20 L 46 10 L 50 0" />
    </svg>
  );
}

function BatchConnector({ right, active }: { right?: boolean; active?: boolean }) {
  return (
    <svg
      className={`${styles.traceConnector} ${styles.traceConnectorBatch} ${active ? styles.traceConnectorActive : ''}`}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={right
        ? 'M 50 40 L 54 28 L 66 14 L 70 0'
        : 'M 50 40 L 46 28 L 34 14 L 30 0'} />
    </svg>
  );
}

// ── Artifact popover ───────────────────────────────────────────────────

interface ArtifactPopoverProps {
  id: string;
  title: string;
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}

function ArtifactPopover({ id, title, open, onClose, triggerRef, children }: ArtifactPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const popover = popoverRef.current;
    const focusable = popover?.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
    focusable?.[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'Tab' && popover) {
        const items = Array.from(popover.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popover && !popover.contains(target) && !triggerRef.current?.contains(target)) {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;
  return (
    <div ref={popoverRef} id={id} role="dialog" aria-label={title} className={styles.artifactPopover}>
      <div className={styles.artifactPopoverHead}>
        <strong>{title}</strong>
        <button type="button" className={styles.popoverClose} onClick={onClose} aria-label={`Close ${title}`}>
          ✕
        </button>
      </div>
      <div className={styles.artifactPopoverBody}>{children}</div>
    </div>
  );
}

function ArtifactList({ label, items }: { label: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.artifactSection}>
      <span className={styles.artifactLabel}>{label}</span>
      <ul className={styles.artifactList}>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

// ── Trace surface ──────────────────────────────────────────────────────

export function TraceSurface({
  query,
  selectedCollection,
  runState,
  elapsedMs,
  onNewResearch,
  onCancel,
  traceProjection,
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
}: TraceSurfaceProps) {
  const [openArtifact, setOpenArtifact] = useState<'brief' | 'sketch' | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const briefTriggerRef = useRef<HTMLButtonElement | null>(null);
  const sketchTriggerRef = useRef<HTMLButtonElement | null>(null);

  const isRunning = runState === 'starting' || runState === 'researching';
  const status = statusCopy(runState);

  const ingestState = !ingestResult
    ? runState === 'ingesting' ? 'importing' : 'idle'
    : ingestResult.success ? 'imported' : 'failed';

  const route = useMemo(
    () => buildTraceRoute({ projection: traceProjection, runState, ingestState }),
    [traceProjection, runState, ingestState],
  );

  const checkpoints = useMemo(
    () => route.nodes.filter((node): node is CheckpointNode => node.kind === 'checkpoint'),
    [route],
  );

  const activeCheckpointId = useMemo(() => {
    const active = [...checkpoints]
      .reverse()
      .find((cp) => cp.status === 'running' || cp.batches.some((batch) => batch.status === 'running'));
    return active?.id;
  }, [checkpoints]);

  const closeArtifact = useCallback(() => {
    setOpenArtifact((current) => {
      if (current === 'brief') briefTriggerRef.current?.focus();
      if (current === 'sketch') sketchTriggerRef.current?.focus();
      return null;
    });
  }, []);

  // Close the dialog on the native close event (Escape or explicit close).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => setModalOpen(false);
    dialog.addEventListener('close', onClose);
    return () => dialog.removeEventListener('close', onClose);
  }, []);

  // A successful import closes the modal; partial/total failures stay
  // visible in the checklist so failed sources remain retryable.
  useEffect(() => {
    if (ingestResult?.success && modalOpen) dialogRef.current?.close();
  }, [ingestResult, modalOpen]);

  const openModal = useCallback(() => {
    setModalOpen(true);
    dialogRef.current?.showModal();
  }, []);

  const summary = useMemo(() => {
    const total = checkpoints.reduce((sum, cp) => sum + cp.batches.length, 0);
    const resolved = checkpoints.reduce(
      (sum, cp) => sum + cp.batches.filter((batch) => batch.status === 'completed' || batch.status === 'failed').length,
      0,
    );
    const failed = checkpoints.reduce((sum, cp) => sum + cp.batches.filter((batch) => batch.status === 'failed').length, 0);
    const parts = [`${resolved} of ${total} searches resolved`, `${sources.length} unique sources found`];
    if (failed > 0) parts.push(`${failed} search${failed === 1 ? '' : 'es'} failed`);
    return parts.join(' · ');
  }, [checkpoints, sources.length]);

  const checkpointRows = checkpoints.map((cp, index) => {
    const isActive = cp.id === activeCheckpointId;
    const side = index % 2 === 0 ? 'left' : 'right';
    return (
      <li key={cp.id} className={`${styles.traceRow} ${styles.traceRowCheckpoint} ${styles[`traceRow-${side}`]}`}>
        <RowConnector active={isActive} />
        <div className={styles.checkpointCard}>
          <span className={`${styles.traceMarker} ${cp.status === 'running' ? styles.traceMarkerRunning : ''}`} aria-hidden="true">
            {cp.status === 'completed' ? '✓' : '•'}
          </span>
          <span className={styles.checkpointCopy}>
            <strong>Supervisor · Pass {cp.iteration + 1}</strong>
            {(cp.decision || cp.reason) && <small>{[cp.decision, cp.reason].filter(Boolean).join(' · ')}</small>}
          </span>
        </div>
        {cp.batches.length > 0 && (
          <ul className={styles.fanOut}>
            {cp.batches.map((batch, batchIndex) => (
              <li key={batch.id} className={`${styles.batchRow} ${batchIndex % 2 === 1 ? styles.batchRowRight : ''}`}>
                <BatchConnector right={batchIndex % 2 === 1} active={isActive && (batch.status === 'pending' || batch.status === 'running')} />
                <div className={styles.batchCard} data-status={batch.status}>
                  <span className={styles.batchMarker} aria-hidden="true">
                    {batch.status === 'completed' ? '✓' : batch.status === 'failed' ? '!' : batch.status === 'running' ? '•' : '○'}
                  </span>
                  <span className={styles.batchCopy}>
                    <span className={styles.batchQuery} title={batch.query}>{batch.query}</span>
                    <small>
                      {batch.status === 'pending' && 'planned'}
                      {batch.status === 'running' && `searching · ${batch.tool || 'search'}`}
                      {batch.status === 'completed' && (batch.zero ? '0 sources' : `${batch.newCount} new source${batch.newCount === 1 ? '' : 's'} · ${batch.tool || 'search'}`)}
                      {batch.status === 'failed' && `failed · ${batch.tool || 'search'}`}
                    </small>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  });

  const milestone = route.milestone;
  const ranked = route.ranked;
  const ingest = route.ingest;
  const briefCreated = milestone.brief === 'created';
  const sketchCreated = milestone.sketch === 'created';

  return (
    <main className={styles.traceMain} aria-labelledby="trace-surface-title">
      <header className={styles.traceUtility}>
        <span id="trace-surface-title" className={styles.workspaceKicker}>02 / Deep Research · research trace</span>
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
      </header>

      <section className={styles.traceQuery} aria-label="Research question">
        <CallingCardArt text={query} />
        <p className={styles.traceQueryText}>{query}</p>
      </section>

      {runState === 'failed' && errorMessage && (
        <p className={styles.workspaceError} role="alert">{errorMessage}</p>
      )}

      <div className={styles.traceRouteWrap}>
        <ol className={styles.traceRoute}>
          <li className={`${styles.traceRow} ${styles.traceRowMilestone}`}>
            <div className={styles.milestoneCard}>
              <span className={styles.milestoneKicker}>Brief + Sketch</span>
              <div className={styles.artifactRows}>
                <div className={styles.artifactRowWrap}>
                  {briefCreated ? (
                    <button
                      ref={briefTriggerRef}
                      type="button"
                      className={`${styles.artifactRow} ${styles.artifactRowCreated}`}
                      onClick={() => setOpenArtifact(openArtifact === 'brief' ? null : 'brief')}
                      aria-expanded={openArtifact === 'brief'}
                      aria-controls="brief-popover"
                    >
                      <span aria-hidden="true">✓</span>
                      <span><strong>Brief created</strong><small>Review the scoped brief</small></span>
                    </button>
                  ) : (
                    <div className={`${styles.artifactRow} ${styles.artifactRowPending}`}>
                      <span className={styles.traceMarkerRunning} aria-hidden="true">•</span>
                      <span><strong>Brief pending</strong><small>Waiting for the brief</small></span>
                    </div>
                  )}
                  {briefCreated && brief && (
                    <ArtifactPopover
                      id="brief-popover"
                      title="Research brief"
                      open={openArtifact === 'brief'}
                      onClose={closeArtifact}
                      triggerRef={briefTriggerRef}
                    >
                      <p className={styles.artifactLead}>{brief.brief}</p>
                      <ArtifactList label="Tools" items={brief.tools} />
                      <ArtifactList label="Plan · overview" items={brief.queries.overview} />
                      <ArtifactList label="Plan · specific" items={brief.queries.specific} />
                    </ArtifactPopover>
                  )}
                </div>
                <div className={styles.artifactRowWrap}>
                  {sketchCreated ? (
                    <button
                      ref={sketchTriggerRef}
                      type="button"
                      className={`${styles.artifactRow} ${styles.artifactRowCreated}`}
                      onClick={() => setOpenArtifact(openArtifact === 'sketch' ? null : 'sketch')}
                      aria-expanded={openArtifact === 'sketch'}
                      aria-controls="sketch-popover"
                    >
                      <span aria-hidden="true">✓</span>
                      <span><strong>Sketch created</strong><small>Review concepts and search context</small></span>
                    </button>
                  ) : (
                    <div className={`${styles.artifactRow} ${styles.artifactRowPending}`}>
                      <span className={styles.traceMarkerRunning} aria-hidden="true">•</span>
                      <span><strong>Sketch pending</strong><small>Waiting for the sketch</small></span>
                    </div>
                  )}
                  {sketchCreated && sketch && (
                    <ArtifactPopover
                      id="sketch-popover"
                      title="Research sketch"
                      open={openArtifact === 'sketch'}
                      onClose={closeArtifact}
                      triggerRef={sketchTriggerRef}
                    >
                      <ArtifactList label="Expected concepts" items={sketch.expected_concepts} />
                      <ArtifactList label="Discriminative terms" items={sketch.discriminative_terms} />
                      <ArtifactList label="Expected patterns" items={sketch.expected_patterns ?? []} />
                      <ArtifactList label="Preferred domains" items={sketch.preferred_domains ?? []} />
                      {brief && <ArtifactList label="Search context" items={[...brief.queries.overview, ...brief.queries.specific]} />}
                    </ArtifactPopover>
                  )}
                </div>
              </div>
            </div>
          </li>

          {checkpointRows}

          <li className={`${styles.traceRow} ${styles.traceRowRanked}`}>
            <RowConnector active={ranked.status === 'running'} />
            <div className={styles.rankedCard} data-status={ranked.status}>
              <span className={`${styles.traceMarker} ${ranked.status === 'running' ? styles.traceMarkerRunning : ''}`} aria-hidden="true">
                {ranked.status === 'completed' ? '✓' : ranked.status === 'running' ? '•' : '○'}
              </span>
              <span className={styles.checkpointCopy}>
                <strong>Evidence ranked</strong>
                <small>
                  {ranked.status === 'completed' && 'Ranked, deduplicated evidence is ready.'}
                  {ranked.status === 'running' && 'Ranking the evidence set…'}
                  {ranked.status === 'pending' && 'Waiting for the final ranked evidence.'}
                </small>
              </span>
            </div>
          </li>

          <li className={`${styles.traceRow} ${styles.traceRowIngest}`}>
            <RowConnector active={ingest.status === 'importing'} />
            <div className={styles.ingestCard}>
              <button
                type="button"
                className={styles.ingestNode}
                onClick={openModal}
                disabled={ingest.status === 'locked' || ingest.status === 'importing'}
              >
                <span className={styles.ingestMarker} aria-hidden="true">
                  {ingest.status === 'imported' ? '✓' : ingest.status === 'import-failed' ? '!' : ingest.status === 'importing' ? '•' : '○'}
                </span>
                <span className={styles.checkpointCopy}>
                  <strong>Ingest Sources</strong>
                  <small>{ingestCopy(ingest, sources.length, ingestResult)}</small>
                </span>
              </button>
            </div>
          </li>
        </ol>
      </div>

      <p className={styles.traceSummary} aria-live="polite">{summary}</p>

      <dialog
        ref={dialogRef}
        className={styles.sourceModal}
        aria-labelledby="source-modal-title"
        aria-describedby="source-modal-note"
      >
        <div className={styles.sourceModalHead}>
          <div>
            <span className={styles.panelKicker}>Final evidence / {selectedCollection || 'chosen collection'}</span>
            <h2 id="source-modal-title">Review ranked sources</h2>
            <p id="source-modal-note">Ranked and deduplicated. Import the evidence worth keeping.</p>
          </div>
          <button type="button" className={styles.popoverClose} onClick={() => dialogRef.current?.close()} aria-label="Close source checklist">
            ✕
          </button>
        </div>
        <div className={styles.sourceModalBody}>
          <SourceList
            sources={sources}
            selectedKeys={selectedSourceKeys}
            onToggle={onToggleSource}
            onToggleAll={onToggleAllSources}
            onIngest={onIngest}
            ingestDisabled={ingestDisabled}
            ingestResult={ingestResult}
            errorMessage={''}
          />
        </div>
      </dialog>
    </main>
  );
}

function ingestCopy(ingest: IngestNode, sourceCount: number, ingestResult: IngestResult | null): string {
  switch (ingest.status) {
    case 'locked': return 'Locked until the ranked evidence arrives.';
    case 'ready': return `Review ${sourceCount} ranked source${sourceCount === 1 ? '' : 's'} and import.`;
    case 'importing': return 'Importing selected sources…';
    case 'imported':
      return ingestResult
        ? `Imported ${ingestResult.ingestedUrls.length} source${ingestResult.ingestedUrls.length === 1 ? '' : 's'} · ${ingestResult.totalChunks} chunks.`
        : 'Selected evidence is in the collection.';
    case 'import-failed': return 'Import failed — open the checklist to retry.';
  }
}
