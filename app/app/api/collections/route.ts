import { NextResponse } from 'next/server';
import { collectionVectors, parseCollectionName } from '@/lib/collections';
import { qdrant } from '@/lib/qdrant';

const unavailable = () =>
  NextResponse.json(
    { collections: [], unavailable: true, error: 'Knowledge base storage is unavailable' },
    { status: 503 },
  );

// GET /api/collections - List collections confirmed by Qdrant.
export async function GET() {
  try {
    const result = await qdrant.getCollections();
    return NextResponse.json({
      collections: result.collections.map((collection) => collection.name),
      unavailable: false,
    });
  } catch {
    return unavailable();
  }
}

// POST /api/collections - Create a Qdrant collection and confirm it exists.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = parseCollectionName(
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).name
      : undefined,
  );
  if (!name) {
    return NextResponse.json(
      { error: 'Collection names must use 1-64 letters, numbers, hyphens, or underscores' },
      { status: 400 },
    );
  }

  try {
    const existing = await qdrant.getCollections();
    if (existing.collections.some((collection) => collection.name === name)) {
      return NextResponse.json({ error: 'Collection already exists' }, { status: 409 });
    }

    await qdrant.createCollection(name, { vectors: collectionVectors });
    const confirmed = await qdrant.getCollections();
    if (!confirmed.collections.some((collection) => collection.name === name)) {
      return NextResponse.json({ error: 'Collection creation could not be confirmed' }, { status: 502 });
    }

    return NextResponse.json({ name }, { status: 201 });
  } catch {
    return unavailable();
  }
}
