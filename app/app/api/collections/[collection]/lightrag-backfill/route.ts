import { NextResponse } from 'next/server';
import { parseCollectionName } from '@/lib/collections';
import { qdrant } from '@/lib/qdrant';
import { groupQdrantPointsForLightRag, type QdrantTextPoint } from '@/lib/qdrant-to-lightrag';

const SIDECAR_BACKFILL_URL = 'http://localhost:8000/backfill';
const QDRANT_PAGE_SIZE = 256;
const JOB_ID = /^[a-f0-9]{32}$/;

type BackfillJob = { id: string; status: 'running' | 'complete' | 'partial' | 'failed'; documents: number; indexed_documents: number; error?: string };

async function loadQdrantDocuments(collection: string): Promise<QdrantTextPoint[]> {
  const points: QdrantTextPoint[] = [];
  let offset: string | number | undefined;
  do {
    const page = await qdrant.scroll(collection, { limit: QDRANT_PAGE_SIZE, offset, with_payload: true, with_vector: false });
    points.push(...page.points.map((point) => ({
      id: String(point.id),
      payload: point.payload as Record<string, unknown> | null | undefined,
    })));
    offset = page.next_page_offset === null ? undefined : page.next_page_offset as string | number;
  } while (offset !== undefined);
  return points;
}

async function sidecarJob(response: Response): Promise<BackfillJob | null> {
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const job = data as Record<string, unknown>;
  if (typeof job.id !== 'string' || !JOB_ID.test(job.id) || !['running', 'complete', 'partial', 'failed'].includes(String(job.status)) || typeof job.documents !== 'number' || typeof job.indexed_documents !== 'number') return null;
  return job as BackfillJob;
}

export async function POST(_: Request, { params }: { params: Promise<{ collection: string }> }) {
  const collection = parseCollectionName((await params).collection);
  if (!collection) return NextResponse.json({ error: 'Invalid collection' }, { status: 400 });

  let points: QdrantTextPoint[];
  try {
    await qdrant.getCollection(collection);
    points = await loadQdrantDocuments(collection);
  } catch {
    return NextResponse.json({ error: 'Could not read this Qdrant collection' }, { status: 502 });
  }
  const documents = groupQdrantPointsForLightRag(points);
  if (!documents.length) return NextResponse.json({ status: 'complete', qdrantPoints: points.length, documents: 0, indexedDocuments: 0 });

  let job: BackfillJob | null;
  try {
    job = await sidecarJob(await fetch(SIDECAR_BACKFILL_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collection, documents }),
    }));
  } catch {
    job = null;
  }
  if (!job) return NextResponse.json({ error: 'Could not start LightRAG indexing' }, { status: 502 });
  return NextResponse.json({ id: job.id, status: job.status, qdrantPoints: points.length, documents: job.documents, indexedDocuments: job.indexed_documents }, { status: 202 });
}

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get('job');
  if (!jobId || !JOB_ID.test(jobId)) return NextResponse.json({ error: 'Invalid backfill job' }, { status: 400 });
  let job: BackfillJob | null;
  try {
    job = await sidecarJob(await fetch(`${SIDECAR_BACKFILL_URL}/${jobId}`));
  } catch {
    job = null;
  }
  if (!job) return NextResponse.json({ error: 'Could not read LightRAG indexing status' }, { status: 502 });
  return NextResponse.json({ id: job.id, status: job.status, documents: job.documents, indexedDocuments: job.indexed_documents, error: job.error });
}
