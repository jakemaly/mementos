import { NextResponse } from 'next/server';

const SIDECAR_URL = 'http://localhost:8000/insert';

export async function POST(request: Request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const body = await request.json();

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }

    const { text, filename } = body as { text?: unknown; filename?: unknown };

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json(
        { error: 'Text is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Strip non-string filename; sidecar expects string | undefined
    const safeFilename = typeof filename === 'string' && filename.trim() !== '' ? filename.trim() : undefined;

    const res = await fetch(SIDECAR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), filename: safeFilename }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Sidecar error' }));
      return NextResponse.json(err, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Sidecar request timed out' }, { status: 504 });
    }
    console.error('RAG ingest proxy error:', error);
    return NextResponse.json({ error: 'Sidecar unavailable' }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
