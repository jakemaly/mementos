import crypto from 'crypto';
import { getEmbedding } from '@/lib/embeddings';
import { qdrant } from '@/lib/qdrant';
import { splitTextIntoChunks } from '@/lib/text';

const SIDECAR_INSERT_URL = 'http://localhost:8000/insert';
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

type BranchResult =
  | { status: 'complete'; chunks?: number; trackId?: string }
  | { status: 'failed'; error: string };

export interface CollectionIndexResult {
  status: 'complete' | 'partial' | 'failed';
  vector: BranchResult;
  graph: BranchResult;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Indexing failed';
}

export interface IndexDependencies {
  embed: typeof getEmbedding;
  upsert: typeof qdrant.upsert;
  graphInsert: (collection: string, text: string, source: string) => Promise<BranchResult>;
}

async function indexVector(collection: string, text: string, source: string, dependencies: Pick<IndexDependencies, 'embed' | 'upsert'>): Promise<BranchResult> {
  try {
    const chunks = splitTextIntoChunks(text, CHUNK_SIZE, CHUNK_OVERLAP);
    if (!chunks.length) return { status: 'failed', error: 'No chunks generated' };

    const points = await Promise.all(chunks.map(async (chunk, index) => ({
      id: crypto.randomUUID(),
      vector: await dependencies.embed(chunk.text),
      payload: {
        text: chunk.text,
        filename: source,
        chunk_index: index,
        char_start: chunk.charStart,
        char_end: chunk.charEnd,
        total_chunks: chunks.length,
      },
    })));
    await dependencies.upsert(collection, { wait: true, points });
    return { status: 'complete', chunks: chunks.length };
  } catch (error) {
    return { status: 'failed', error: message(error) };
  }
}

async function indexGraph(collection: string, text: string, source: string): Promise<BranchResult> {
  try {
    const response = await fetch(SIDECAR_INSERT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection, text, filename: source }),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || typeof body !== 'object' || body === null) {
      return { status: 'failed', error: 'Graph indexing failed' };
    }
    const trackId = (body as Record<string, unknown>).track_id;
    return { status: 'complete', trackId: typeof trackId === 'string' ? trackId : undefined };
  } catch (error) {
    return { status: 'failed', error: message(error) };
  }
}

/** Index content independently for Vector Search and collection-scoped LightRAG. */
export function createCollectionIndexer(dependencies: IndexDependencies) {
  return async (collection: string, text: string, source: string): Promise<CollectionIndexResult> => {
    const [vector, graph] = await Promise.all([
      indexVector(collection, text, source, dependencies),
      dependencies.graphInsert(collection, text, source),
    ]);
  const complete = vector.status === 'complete' && graph.status === 'complete';
  const failed = vector.status === 'failed' && graph.status === 'failed';
    return { status: complete ? 'complete' : failed ? 'failed' : 'partial', vector, graph };
  };
}

export const indexCollectionDocument = createCollectionIndexer({
  embed: getEmbedding,
  upsert: qdrant.upsert.bind(qdrant),
  graphInsert: indexGraph,
});
