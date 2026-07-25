export type QdrantTextPoint = { id: string | number; payload?: Record<string, unknown> | null };
export type LightRagDocument = { source: string; text: string };

type Chunk = { text: string; start?: number; end?: number; index?: number };

function sourceFor(point: QdrantTextPoint): string {
  const payload = point.payload || {};
  for (const key of ['url', 'filename', 'doc_id', 'case_id']) {
    if (typeof payload[key] === 'string' && payload[key].trim()) return payload[key].trim();
  }
  return `Qdrant point ${point.id}`;
}

/** Reconstruct source documents from direct-Qdrant chunk payloads for LightRAG ingestion. */
export function groupQdrantPointsForLightRag(points: QdrantTextPoint[]): LightRagDocument[] {
  const groups = new Map<string, Chunk[]>();
  for (const point of points) {
    const payload = point.payload || {};
    if (typeof payload.text !== 'string' || !payload.text.trim()) continue;
    const source = sourceFor(point);
    const chunks = groups.get(source) || [];
    chunks.push({
      text: payload.text,
      start: typeof payload.char_start === 'number' ? payload.char_start : undefined,
      end: typeof payload.char_end === 'number' ? payload.char_end : undefined,
      index: typeof payload.chunk_index === 'number' ? payload.chunk_index : undefined,
    });
    groups.set(source, chunks);
  }

  return Array.from(groups, ([source, chunks]) => {
    chunks.sort((left, right) => (left.start ?? Number.MAX_SAFE_INTEGER) - (right.start ?? Number.MAX_SAFE_INTEGER) || (left.index ?? Number.MAX_SAFE_INTEGER) - (right.index ?? Number.MAX_SAFE_INTEGER));
    let cursor = 0;
    const text = chunks.map((chunk) => {
      const overlap = chunk.start === undefined ? 0 : Math.max(0, cursor - chunk.start);
      cursor = Math.max(cursor, chunk.end ?? (chunk.start ?? cursor) + chunk.text.length);
      return overlap ? chunk.text.slice(overlap) : chunk.text;
    }).join(chunks.some((chunk) => chunk.start === undefined) ? '\n\n' : '');
    return { source, text };
  });
}
