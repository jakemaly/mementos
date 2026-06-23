import { NextResponse } from 'next/server';
import { qdrant } from '@/lib/qdrant';

// GET /api/collections - List all collections
export async function GET() {
  try {
    const result = await qdrant.getCollections();
    const collectionNames = result.collections.map((c) => c.name);
    return NextResponse.json({ collections: collectionNames });
  } catch (error: any) {
    console.error('Error fetching Qdrant collections:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch collections' },
      { status: 500 }
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

    // Check if collection already exists
    const result = await qdrant.getCollections();
    const exists = result.collections.some((c) => c.name === cleanName);

    if (exists) {
      return NextResponse.json(
        { error: 'Collection already exists' },
        { status: 400 }
      );
    }

    // Create the collection in Qdrant with 384 dimensions (matching all-MiniLM-L6-v2)
    // using Cosine distance metric
    await qdrant.createCollection(cleanName, {
      vectors: {
        size: 384,
        distance: 'Cosine',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Collection '${cleanName}' created successfully`,
    });
  } catch (error: any) {
    console.error('Error creating Qdrant collection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create collection' },
      { status: 500 }
    );
  }
}
