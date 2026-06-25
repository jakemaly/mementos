import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { qdrant } from '@/lib/qdrant';
import { getEmbedding } from '@/lib/embeddings';
import { splitTextIntoChunks } from '@/lib/text';

/** Strip HTML tags and extract clean text. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPageContent(url: string): Promise<string> {
  // Try Tavily Extract API first if key is available
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const resp = await fetch('https://api.tavily.com/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          urls: [url],
          include_raw_content: true,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const result = data.results?.[0];
        if (result?.raw_content) return result.raw_content;
        if (result?.content) return result.content;
      }
    } catch {
      // Fall through to standard fetch
    }
  }

  // Fallback: standard HTTP fetch + HTML stripping
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SecondBrain/1.0)' },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  }

  const text = await resp.text();
  return stripHtml(text);
}

export async function POST(request: Request) {
  try {
    const {
      sources,
      collection,
      chunkSize = 500,
      chunkOverlap = 50,
    } = await request.json();

    if (!sources?.length || !collection) {
      return NextResponse.json(
        { error: 'Sources array and collection name are required' },
        { status: 400 }
      );
    }

    // Verify collection exists
    const collections = await qdrant.getCollections();
    const collectionExists = collections.some(
      (c: any) => c.name === collection
    );
    if (!collectionExists) {
      return NextResponse.json(
        { error: `Collection '${collection}' does not exist` },
        { status: 404 }
      );
    }

    const startTime = Date.now();
    const ingestedUrls: string[] = [];
    let totalChunks = 0;

    // Process each source sequentially (embeddings are synchronous local model)
    for (const source of sources) {
      const { url, title } = source;
      console.log(`Fetching content from: ${url}`);

      let content: string;
      try {
        content = await fetchPageContent(url);
      } catch (err: any) {
        console.error(`Failed to fetch ${url}: ${err.message}`);
        continue;
      }

      if (!content.trim()) {
        console.warn(`Empty content from ${url}, skipping`);
        continue;
      }

      // Chunk the text
      const chunks = splitTextIntoChunks(content, chunkSize, chunkOverlap);
      if (chunks.length === 0) continue;

      // Generate embeddings and build points
      const points = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const vector = await getEmbedding(chunk.text);

        points.push({
          id: crypto.randomUUID(),
          vector,
          payload: {
            text: chunk.text,
            filename: title || url,
            url,
            chunk_index: i,
            char_start: chunk.charStart,
            char_end: chunk.charEnd,
            total_chunks: chunks.length,
          },
        });
      }

      // Upsert to Qdrant
      await qdrant.upsert(collection, { wait: true, points });

      totalChunks += chunks.length;
      ingestedUrls.push(url);
      console.log(
        `Ingested ${chunks.length} chunks from ${url} into '${collection}'`
      );
    }

    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      totalChunks,
      ingestedUrls,
      elapsedMs: elapsed,
      message: `Ingested ${totalChunks} chunks from ${ingestedUrls.length} sources into '${collection}'`,
    });
  } catch (error: any) {
    console.error('Research ingest error:', error);
    return NextResponse.json(
      { error: error.message || 'Ingestion failed' },
      { status: 500 }
    );
  }
}
