import { NextResponse } from 'next/server';
import { qdrant } from '@/lib/qdrant';
import { getEmbedding } from '@/lib/embeddings';

export async function POST(request: Request) {
  try {
    const { query, collection, limit = 5 } = await request.json();

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return NextResponse.json(
        { error: 'Query text is required and must be a string' },
        { status: 400 }
      );
    }

    if (!collection || typeof collection !== 'string') {
      return NextResponse.json(
        { error: 'Collection name is required' },
        { status: 400 }
      );
    }

    const cleanQuery = query.trim();
    const searchLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 5));

    // Verify collection exists first
    const collectionsResult = await qdrant.getCollections();
    const collectionExists = collectionsResult.collections.some(
      (c) => c.name === collection
    );

    if (!collectionExists) {
      return NextResponse.json(
        { error: `Collection '${collection}' does not exist` },
        { status: 404 }
      );
    }

    // Generate query embedding vector using the local model
    const queryVector = await getEmbedding(cleanQuery);

    // Query Qdrant for similar vectors
    const searchResult = await qdrant.search(collection, {
      vector: queryVector,
      limit: searchLimit,
      with_payload: true,
    });

    // Map and format results
    const results = searchResult.map((match) => ({
      id: match.id,
      score: match.score,
      text: (match.payload?.text as string) || '',
      filename: (match.payload?.filename as string) || 'unknown',
      chunkIndex: (match.payload?.chunk_index as number) ?? 0,
      charStart: (match.payload?.char_start as number) ?? 0,
      charEnd: (match.payload?.char_end as number) ?? 0,
    }));

    return NextResponse.json({
      query: cleanQuery,
      collection: collection,
      results: results,
    });
  } catch (error: unknown) {
    console.error('Error executing query search:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search collection' },
      { status: 500 }
    );
  }
}
