import { NextResponse } from 'next/server';
import { parseCollectionName } from '@/lib/collections';
import { indexCollectionDocument, type CollectionIndexResult } from '@/lib/index-collection-document';

interface ResearchSourceInput {
  url: string;
  title?: string;
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
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const response = await fetch('https://api.tavily.com/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: tavilyKey, urls: [url], include_raw_content: true }),
      });
      if (response.ok) {
        const data = await response.json() as { results?: Array<{ raw_content?: string; content?: string }> };
        const result = data.results?.[0];
        if (result?.raw_content || result?.content) return result.raw_content || result.content || '';
      }
    } catch {
      // Fall through to direct extraction.
    }
  }

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Mementos/1.0)' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return stripHtml(await response.text());
}

type SourceOutcome = { url: string; result?: CollectionIndexResult; error?: string };

export async function POST(request: Request) {
  let body: { sources?: ResearchSourceInput[]; collection?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const collection = parseCollectionName(body.collection);
  if (!Array.isArray(body.sources) || !body.sources.length || !collection || body.sources.some((source) => !source || typeof source.url !== 'string' || !source.url)) {
    return NextResponse.json({ error: 'Sources array and a valid collection name are required' }, { status: 400 });
  }

  const startTime = Date.now();
  const outcomes: SourceOutcome[] = [];
  let totalChunks = 0;

  for (const source of body.sources) {
    try {
      const content = await fetchPageContent(source.url);
      if (!content.trim()) throw new Error('Source content is empty');
      const result = await indexCollectionDocument(collection, content, source.title || source.url);
      if (result.vector.status === 'complete') totalChunks += result.vector.chunks ?? 0;
      outcomes.push({ url: source.url, result });
    } catch (error) {
      console.error(`Failed to import ${source.url}:`, error);
      outcomes.push({ url: source.url, error: errorMessage(error) });
    }
  }

  const ingestedUrls = outcomes.filter((outcome) => outcome.result?.status !== 'failed').map((outcome) => outcome.url);
  const failedUrls = outcomes.filter((outcome) => !outcome.result || outcome.result.status === 'failed').map((outcome) => outcome.url);
  const partial = outcomes.some((outcome) => outcome.result?.status === 'partial') || (ingestedUrls.length > 0 && failedUrls.length > 0);
  const complete = !partial && failedUrls.length === 0;

  return NextResponse.json({
    success: complete,
    partial,
    totalChunks,
    ingestedUrls,
    failedUrls,
    outcomes,
    elapsedMs: Date.now() - startTime,
    message: complete
      ? `Imported ${ingestedUrls.length} sources into '${collection}'`
      : partial
        ? `Partially imported ${ingestedUrls.length} of ${body.sources.length} sources into '${collection}'`
        : `Could not import any of the ${body.sources.length} selected sources into '${collection}'`,
  }, { status: ingestedUrls.length ? 200 : 502 });
}
