import { NextResponse } from 'next/server';
import { parseCollectionName } from '@/lib/collections';
import { indexCollectionDocument } from '@/lib/index-collection-document';

const SUPPORTED_TYPES = new Set(['text/plain', 'text/markdown']);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const collection = parseCollectionName(formData.get('collection'));
    if (!(file instanceof File) || !collection) {
      return NextResponse.json({ error: 'One file and a valid collection name are required' }, { status: 400 });
    }
    if (!SUPPORTED_TYPES.has(file.type) && !/\.(txt|md|markdown)$/i.test(file.name)) {
      return NextResponse.json({ error: 'Only TXT and Markdown files are supported' }, { status: 400 });
    }

    const text = await file.text();
    if (!text.trim()) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    const result = await indexCollectionDocument(collection, text, file.name);
    return NextResponse.json({
      ...result,
      filename: file.name,
      collection,
    }, { status: result.status === 'failed' ? 502 : 200 });
  } catch (error) {
    console.error('File ingestion failed:', error);
    return NextResponse.json({ error: 'File ingestion failed' }, { status: 500 });
  }
}
