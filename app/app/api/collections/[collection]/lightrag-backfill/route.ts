import { NextResponse } from 'next/server';
import { parseCollectionName } from '@/lib/collections';
import { qdrant } from '@/lib/qdrant';
import { groupQdrantPointsForLightRag, type LightRagDocument, type QdrantTextPoint } from '@/lib/qdrant-to-lightrag';

const SIDECAR_BATCH_INSERT_URL = 'http://localhost:8000/insert/batch';
const QDRANT_PAGE_SIZE = 256;
const LIGHTRAG_BATCH_SIZE = 100;

type BatchResponse = { documents?: unknown };

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

async function insertBatch(collection: string, documents: LightRagDocument[]): Promise<number> {
  const response = await fetch(SIDECAR_BATCH_INSERT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection, documents }),
  });
  const data: BatchResponse | null = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data.documents !== 'number') throw new Error('LightRAG indexing failed');
  return data.documents;
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

  let indexedDocuments = 0;
  try {
    for (let start = 0; start < documents.length; start += LIGHTRAG_BATCH_SIZE) {
      indexedDocuments += await insertBatch(collection, documents.slice(start, start + LIGHTRAG_BATCH_SIZE));
    }
  } catch {
    const status = indexedDocuments ? 'partial' : 'failed';
    return NextResponse.json({ status, qdrantPoints: points.length, documents: documents.length, indexedDocuments, error: 'LightRAG indexing stopped before completion' }, { status: indexedDocuments ? 200 : 502 });
  }
  return NextResponse.json({ status: 'complete', qdrantPoints: points.length, documents: documents.length, indexedDocuments });
}
