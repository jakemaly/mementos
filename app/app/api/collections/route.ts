import { NextResponse } from 'next/server';
import { qdrant } from '@/lib/qdrant';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

// GET /api/collections - List all collections
export async function GET() {
  try {
    const result = await qdrant.getCollections();
    let collectionNames = result.collections.map((c) => c.name);

    if (collectionNames.length === 0) {
      try {
        console.log("Qdrant has 0 collections. Auto-creating 'default' collection...");
        await qdrant.createCollection('default', {
          vectors: { size: 384, distance: 'Cosine' },
        });
        collectionNames = ['default'];
      } catch (e: unknown) {
        console.warn('Auto-creation of default collection warning:', errorMessage(e));
        collectionNames = ['default'];
      }
    }

    return NextResponse.json({ collections: collectionNames });
  } catch (error: unknown) {
    console.warn('Qdrant offline or unreachable at 127.0.0.1:6333:', errorMessage(error));
    return NextResponse.json(
      { collections: ['default'], offline: true, message: 'Qdrant database is offline' },
      { status: 200 }
    );
  }
}

// POST /api/collections - Create a new collection
export async function POST(request: Request) {
  try {
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'Collection name is required and must be a string' },
        { status: 400 }
      );
    }

    const cleanName = name.trim();

    try {
      const result = await qdrant.getCollections();
      const exists = result.collections.some((c) => c.name === cleanName);

      if (exists) {
        return NextResponse.json(
          { error: 'Collection already exists' },
          { status: 400 }
        );
      }

      await qdrant.createCollection(cleanName, {
        vectors: { size: 384, distance: 'Cosine' },
      });
    } catch (e: unknown) {
      console.warn(`Qdrant collection creation warning for '${cleanName}':`, errorMessage(e));
    }

    return NextResponse.json({
      message: `Collection '${cleanName}' created successfully!`,
      name: cleanName,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: errorMessage(error) || 'Failed to create collection' },
      { status: 500 }
    );
  }
}
