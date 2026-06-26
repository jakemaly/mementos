import { NextResponse } from 'next/server';

const SIDECAR_URL = 'http://localhost:8000/query';
const VALID_MODES = ['naive', 'local', 'global', 'hybrid'] as const;
type ValidMode = (typeof VALID_MODES)[number];

export async function POST(request: Request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const body = await request.json();

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }

    const { query, mode } = body as { query?: unknown; mode?: unknown };

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return NextResponse.json(
        { error: 'Query is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Validate mode upfront — reject invalid values instead of silently falling back
    let selectedMode: ValidMode = 'hybrid';
    if (typeof mode === 'string') {
      if (!VALID_MODES.includes(mode as ValidMode)) {
        return NextResponse.json(
          { error: `Invalid mode "${mode}". Must be one of: ${VALID_MODES.join(', ')}` },
          { status: 400 }
        );
      }
      selectedMode = mode as ValidMode;
    }

    const res = await fetch(SIDECAR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.trim(), mode: selectedMode }),
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
    console.error('RAG query proxy error:', error);
    return NextResponse.json({ error: 'Sidecar unavailable' }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
