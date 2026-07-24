import { NextResponse } from 'next/server';
import { qdrant } from '@/lib/qdrant';
import { getEmbedding } from '@/lib/embeddings';
import { parseCollectionName } from '@/lib/collections';

export async function POST(request: Request) {
  try {
    const { query, collection, limit = 5 } = await request.json();

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return NextResponse.json(
        { error: 'Query text is required and must be a string' },
        { status: 400 }
      );
    }

    const collectionName = parseCollectionName(collection);
    if (!collectionName) {
      return NextResponse.json(
        { error: 'Collection names must use 1-64 letters, numbers, hyphens, or underscores' },
        { status: 400 }
      );
    }

    const cleanQuery = query.trim();
    const searchLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 5));

    // Verify collection exists first
    const collectionsResult = await qdrant.getCollections();
    const collectionExists = collectionsResult.collections.some(
      (c) => c.name === collectionName
    );

    if (!collectionExists) {
      return NextResponse.json(
        { error: `Collection '${collectionName}' does not exist` },
        { status: 404 }
      );
    }

    // Generate query embedding vector using the local model
    const queryVector = await getEmbedding(cleanQuery);

    // Query Qdrant for similar vectors
    const searchResult = await qdrant.search(collectionName, {
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
      collection: collectionName,
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
