import { NextRequest } from 'next/server';

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8000';

function hasQuery(value: unknown): value is { query: unknown } {
  return typeof value === 'object' && value !== null && 'query' in value;
}

export async function POST(request: NextRequest) {
  const abortController = new AbortController();

  // Forward abort signal from client disconnect
  if (request.signal) {
    request.signal.addEventListener('abort', () => abortController.abort());
  }

  try {
    const body: unknown = await request.json();

    if (!hasQuery(body) || typeof body.query !== 'string' || !body.query.trim()) {
      return new Response(
        JSON.stringify({ error: 'query is required and must be non-empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Proxy to sidecar SSE stream — forward only validated query
    const sidecarResponse = await fetch(`${SIDECAR_URL}/research/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: body.query.trim() }),
      signal: abortController.signal,
    });

    if (!sidecarResponse.ok) {
      const err = await sidecarResponse.text();
      return new Response(
        JSON.stringify({ error: `Sidecar error: ${err}` }),
        { status: sidecarResponse.status, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Stream SSE directly to client without buffering
    const reader = sidecarResponse.body?.getReader();
    if (!reader) {
      return new Response(
        JSON.stringify({ error: 'Sidecar returned no stream' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    let cancelled = false;
    const stream = new ReadableStream({
      start(controller) {
        const pump = () => {
          if (cancelled) return;
          reader.read().then(({ done, value }) => {
            if (done || cancelled) {
              if (!cancelled) controller.close();
              return;
            }
            controller.enqueue(value);
            pump();
          }).catch((err) => {
            if (!cancelled) controller.error(err);
          });
        };
        pump();
      },
      async cancel() {
        cancelled = true;
        abortController.abort();
        try {
          await reader.cancel();
        } finally {
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response(null, { status: 499 });
    }
    const message = error instanceof Error ? error.message : 'Research proxy failed';
    console.error('Research proxy error:', error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
