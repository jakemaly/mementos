import { NextResponse } from 'next/server';
import { parseCollectionName } from '@/lib/collections';
import { indexCollectionDocument } from '@/lib/index-collection-document';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
  }

  const { text, filename, collection } = body as Record<string, unknown>;
  const collectionName = parseCollectionName(collection);
  if (typeof text !== 'string' || !text.trim() || !collectionName) {
    return NextResponse.json({ error: 'Text and a valid collection name are required' }, { status: 400 });
  }
  const source = typeof filename === 'string' && filename.trim() ? filename.trim() : 'Untitled document';

  const result = await indexCollectionDocument(collectionName, text.trim(), source);
  return NextResponse.json({ ...result, filename: source, collection: collectionName }, { status: result.status === 'failed' ? 502 : 200 });
}
