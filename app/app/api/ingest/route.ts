import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { qdrant } from '@/lib/qdrant';
import { getEmbedding } from '@/lib/embeddings';

// Helper to split text into overlapping chunks with word boundary alignment
function splitTextIntoChunks(
  text: string,
  chunkSize: number,
  chunkOverlap: number
): { text: string; charStart: number; charEnd: number }[] {
  const chunks: { text: string; charStart: number; charEnd: number }[] = [];
  if (!text) return chunks;

  let start = 0;
  const textLength = text.length;

  while (start < textLength) {
    let end = start + chunkSize;

    if (end < textLength) {
      // Look back up to 25% of chunk size to find a natural split point (newline or space)
      const lookbackLimit = Math.floor(chunkSize * 0.25);
      const sub = text.substring(end - lookbackLimit, end);

      const lastNewline = sub.lastIndexOf('\n');
      if (lastNewline !== -1) {
        end = end - lookbackLimit + lastNewline;
      } else {
        const lastSpace = sub.lastIndexOf(' ');
        if (lastSpace !== -1) {
          end = end - lookbackLimit + lastSpace;
        }
      }
    }

    const chunkText = text.substring(start, end).trim();
    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        charStart: start,
        charEnd: end,
      });
    }

    // Move next start pointer by subtracting overlap
    const nextStart = end - chunkOverlap;
    
    // Safety check to prevent infinite loops or non-progress
    if (nextStart >= end) {
      start = end;
    } else if (nextStart <= start) {
      // Ensure we always move forward by at least some characters
      start = start + Math.max(1, Math.floor(chunkSize * 0.5));
    } else {
      start = nextStart;
    }
  }

  return chunks;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const collectionName = formData.get('collection') as string | null;
    const chunkSizeStr = formData.get('chunkSize') as string | null;
    const chunkOverlapStr = formData.get('chunkOverlap') as string | null;

    if (!file || !collectionName) {
      return NextResponse.json(
        { error: 'File and collection name are required' },
        { status: 400 }
      );
    }

    const chunkSize = parseInt(chunkSizeStr || '500', 10);
    const chunkOverlap = parseInt(chunkOverlapStr || '50', 10);

    if (isNaN(chunkSize) || chunkSize <= 0) {
      return NextResponse.json({ error: 'Invalid chunk size' }, { status: 400 });
    }
    if (isNaN(chunkOverlap) || chunkOverlap < 0 || chunkOverlap >= chunkSize) {
      return NextResponse.json({ error: 'Invalid overlap size' }, { status: 400 });
    }

    // Read file contents as text
    const text = await file.text();
    if (!text.trim()) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    // Split text into chunks
    const chunks = splitTextIntoChunks(text, chunkSize, chunkOverlap);
    if (chunks.length === 0) {
      return NextResponse.json({ error: 'No chunks generated' }, { status: 400 });
    }

    console.log(`Processing file: ${file.name}, generated ${chunks.length} chunks.`);

    // Generate embeddings for all chunks (in-process local model)
    const points = [];
    const startTime = Date.now();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = await getEmbedding(chunk.text);
      
      points.push({
        id: crypto.randomUUID(),
        vector: vector,
        payload: {
          text: chunk.text,
          filename: file.name,
          chunk_index: i,
          char_start: chunk.charStart,
          char_end: chunk.charEnd,
          total_chunks: chunks.length,
        },
      });
    }

    const embeddingTime = Date.now() - startTime;
    console.log(`Embeddings generated in ${embeddingTime}ms. Upserting to Qdrant...`);

    // Upsert to Qdrant collection
    await qdrant.upsert(collectionName, {
      wait: true,
      points: points,
    });

    return NextResponse.json({
      success: true,
      filename: file.name,
      chunksCount: chunks.length,
      embeddingTimeMs: embeddingTime,
      message: `Successfully ingested ${chunks.length} chunks into '${collectionName}'`,
    });
  } catch (error: any) {
    console.error('Error during file ingestion:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to ingest file' },
      { status: 500 }
    );
  }
}
