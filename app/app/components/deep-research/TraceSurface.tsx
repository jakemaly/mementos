'use client';

import { type CSSProperties, ReactNode, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

// ── Connector geometry (deterministic wires between node anchors) ──────

/**
 * Anchors are horizontal positions as fractions of the route width
 * (0–100 in the viewBox). Every node exposes an anchor set: milestone,
 * ranked and ingest sit centered (50); checkpoint cards sit at 25/75 on
 * wide screens and 50 on narrow; batch cards sit at (i + 0.5)/N across a
 * horizontal fan-out and 50 when stacked.
 *
 * A single connection is a deterministic, slightly irregular polyline.
 * Parallel connections share a short trunk before splitting into branch
 * ribbons, so they read as one continuous route rather than floating wires.
 */
function RouteConnector({ from, to, active, fan }: { from: readonly number[]; to: number; active?: boolean; fan?: boolean }) {
  const anchors = [...new Set(from)];
  const branching = anchors.length > 1;
  const seed = Math.abs(Math.round(to * 10) + anchors.reduce((sum, anchor) => sum + Math.round(anchor * 10), 0));
  const trunkX = to + ((seed % 3) - 1) * 1.5;
  const className = [
    styles.traceConnector,
    fan ? styles.traceConnectorFan : '',
    branching ? styles.traceConnectorBranching : '',
    active ? styles.traceConnectorActive : '',
  ].join(' ');

  const paths = branching
    ? [
        `M ${to} 0 L ${trunkX} 18`,
        ...anchors.map((anchor, index) => {
          const branchX = anchor + ((index % 3) - 1) * 1.8;
          const branchY = 26 + (index % 2) * 2;
          return `M ${trunkX} 18 L ${branchX} ${branchY} L ${anchor} 40`;
        }),
      ]
    : anchors.map((anchor) => {
        if (anchor === to) return `M ${to} 0 L ${to} 40`;
        const firstX = to + ((seed % 3) - 1) * 2;
        const secondX = anchor - (((seed + 1) % 3) - 1) * 1.5;
        return `M ${to} 0 L ${firstX} 11 L ${secondX} 29 L ${anchor} 40`;
      });

  return (
    <svg className={className} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      {paths.map((path, index) => <path key={`${path}-${index}`} d={path} />)}
    </svg>
  );
}

/** Batch centers: (i + 0.5)/N across a horizontal fan-out, 50 when stacked. */
function batchAnchors(count: number, narrow: boolean): number[] {
  return Array.from({ length: count }, (_, i) => (narrow ? 50 : ((i + 0.5) / count) * 100));
}

/** Mirrors the 720px CSS breakpoint so connector geometry matches the layout. */
function useNarrowSurface(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px)');
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return narrow;
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
  const briefTriggerRef = useRef<HTMLButtonElement | null>(null);
  const sketchTriggerRef = useRef<HTMLButtonElement | null>(null);
  const narrow = useNarrowSurface();

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

  // Anchor threading: every row's connector wires the previous row's
  // anchors to this row's card center, so lines visibly connect nodes.
  const checkpointEntries = checkpoints.map((cp, index) => {
    const side = index % 2 === 0 ? 'left' : 'right';
    const center = narrow ? 50 : side === 'left' ? 25 : 75;
    const anchors = cp.batches.length > 0 ? batchAnchors(cp.batches.length, narrow) : [center];
    return { cp, isActive: cp.id === activeCheckpointId, side, center, anchors };
  });
  const checkpointRows = checkpointEntries.map((entry, index) => {
    const { cp, isActive, side, center, anchors } = entry;
    const prevAnchors = index === 0 ? [50] : checkpointEntries[index - 1].anchors;
    return (
      <li key={cp.id} className={`${styles.traceRow} ${styles.traceRowCheckpoint} ${styles[`traceRow-${side}`]}`}>
        <RouteConnector from={prevAnchors} to={center} active={isActive} />
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
          <div className={styles.fanOutArea}>
            <RouteConnector from={anchors} to={center} active={isActive} fan />
            <ul
              className={styles.fanOut}
              style={{ ['--fan-count' as string]: String(cp.batches.length) } as CSSProperties}
            >
              {cp.batches.map((batch) => (
                <li key={batch.id} className={styles.batchRow}>
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
          </div>
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
            <RouteConnector from={checkpointEntries.length > 0 ? checkpointEntries[checkpointEntries.length - 1].anchors : [50]} to={50} active={ranked.status === 'running'} />
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
            <RouteConnector from={[50]} to={50} active={ingest.status === 'importing'} />
            <div className={styles.ingestCard}>
              <div className={styles.ingestNode} data-status={ingest.status}>
                <span className={styles.ingestMarker} aria-hidden="true">
                  {ingest.status === 'imported' ? '✓' : ingest.status === 'import-failed' ? '!' : ingest.status === 'importing' ? '•' : '○'}
                </span>
                <span className={styles.checkpointCopy}>
                  <strong>Ingest Sources</strong>
                  <small>{ingestCopy(ingest, sources.length, ingestResult)}</small>
                </span>
              </div>
            </div>
            {ingest.status !== 'locked' && (
              <section className={styles.sourceRegister} aria-label="Ranked sources register">
                <div className={styles.sourceRegisterHead}>
                  <span className={styles.panelKicker}>Final evidence / {selectedCollection || 'chosen collection'}</span>
                  <h2>Review ranked sources</h2>
                  <p>Ranked and deduplicated. Import the evidence worth keeping.</p>
                </div>
                <div className={styles.sourceRegisterBody}>
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
              </section>
            )}
          </li>
        </ol>
      </div>

      <p className={styles.traceSummary} aria-live="polite">{summary}</p>
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
    case 'import-failed': return 'Import failed — review the sources below to retry.';
  }
}
