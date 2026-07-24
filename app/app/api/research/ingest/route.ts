import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { qdrant } from '@/lib/qdrant';
import { getEmbedding } from '@/lib/embeddings';
import { splitTextIntoChunks } from '@/lib/text';

interface ResearchSourceInput {
  url: string;
  title?: string;
}

interface CollectionsResponse {
  collections?: Array<{ name: string }>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

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
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Mementos/1.0)' },
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
    const body = await request.json() as {
      sources?: ResearchSourceInput[];
      collection?: string;
      chunkSize?: number;
      chunkOverlap?: number;
    };
    const {
      sources,
      collection,
      chunkSize = 500,
      chunkOverlap = 50,
    } = body;

    if (!sources?.length || !collection || sources.some((source) => !source?.url)) {
      return NextResponse.json(
        { error: 'Sources array and collection name are required' },
        { status: 400 }
      );
    }

    // Ensure collection exists (auto-create 384-d cosine if missing)
    try {
      const collections = await qdrant.getCollections() as unknown as CollectionsResponse;
      const collectionExists = collections.collections?.some(
        (c) => c.name === collection
      );
      if (!collectionExists) {
        console.log(`Auto-creating collection '${collection}' in Qdrant...`);
        await qdrant.createCollection(collection, {
          vectors: { size: 384, distance: 'Cosine' },
        });
      }
    } catch (e: unknown) {
      console.warn(`Collection check/create warning: ${errorMessage(e)}`);
    }

    const startTime = Date.now();
    const ingestedUrls: string[] = [];
    const failedUrls: string[] = [];
    let totalChunks = 0;

    // Process each source sequentially (embeddings are synchronous local model)
    for (const source of sources) {
      const { url, title } = source;
      console.log(`Fetching content from: ${url}`);

      let content: string;
      try {
        content = await fetchPageContent(url);
      } catch (err: unknown) {
        console.error(`Failed to fetch ${url}: ${errorMessage(err)}`);
        failedUrls.push(url);
        continue;
      }

      if (!content.trim()) {
        console.warn(`Empty content from ${url}, skipping`);
        failedUrls.push(url);
        continue;
      }

      try {
        // Chunk the text
        const chunks = splitTextIntoChunks(content, chunkSize, chunkOverlap);
        if (chunks.length === 0) {
          failedUrls.push(url);
          continue;
        }

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
      } catch (err: unknown) {
        console.error(`Failed to ingest ${url}: ${errorMessage(err)}`);
        failedUrls.push(url);
      }
    }

    const elapsed = Date.now() - startTime;
    const partial = ingestedUrls.length > 0 && failedUrls.length > 0;
    const complete = failedUrls.length === 0;

    return NextResponse.json({
      success: complete,
      partial,
      totalChunks,
      ingestedUrls,
      failedUrls,
      elapsedMs: elapsed,
      message: complete
        ? `Ingested ${totalChunks} chunks from ${ingestedUrls.length} sources into '${collection}'`
        : partial
          ? `Partially imported ${ingestedUrls.length} of ${sources.length} sources into '${collection}'`
          : `Could not import any of the ${sources.length} selected sources into '${collection}'`,
    });
  } catch (error: unknown) {
    console.error('Research ingest error:', error);
    return NextResponse.json(
      { error: errorMessage(error) || 'Ingestion failed' },
      { status: 500 }
    );
  }
}
