import { NextResponse } from 'next/server';
import { parseCollectionName } from '@/lib/collections';
import { qdrant } from '@/lib/qdrant';

const SIDECAR_STATS_URL = 'http://localhost:8000/stats';
const TIMEOUT_MS = 5_000;

type LightRagStats = { documents: number; nodes: number; links: number };

function parseLightRagStats(value: unknown): LightRagStats | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const stats = value as Record<string, unknown>;
  const values = [stats.documents, stats.nodes, stats.links];
  if (!values.every((count) => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0)) return null;
  return { documents: stats.documents as number, nodes: stats.nodes as number, links: stats.links as number };
}

export async function GET(_: Request, { params }: { params: Promise<{ collection: string }> }) {
  const collection = parseCollectionName((await params).collection);
  if (!collection) return NextResponse.json({ error: 'Invalid collection' }, { status: 400 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const [qdrantInfo, lightRagResponse] = await Promise.all([
      qdrant.getCollection(collection),
      fetch(`${SIDECAR_STATS_URL}?collection=${encodeURIComponent(collection)}`, { signal: controller.signal }),
    ]);
    if (!lightRagResponse.ok) throw new Error('LightRAG stats unavailable');
    const lightRag = parseLightRagStats(await lightRagResponse.json());
    if (!lightRag) throw new Error('Invalid LightRAG stats');
    return NextResponse.json({
      qdrant: { points: qdrantInfo.points_count ?? 0 },
      lightrag: lightRag,
    });
  } catch {
    return NextResponse.json({ error: 'Collection statistics are unavailable' }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
