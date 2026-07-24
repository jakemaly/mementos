import { NextRequest } from 'next/server';

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  const abortController = new AbortController();

  // Forward abort signal from client disconnect
  if (request.signal) {
    request.signal.addEventListener('abort', () => abortController.abort());
  }

  try {
    const body = await request.json();

    if (!body?.query || typeof body.query !== 'string' || !body.query.trim()) {
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

    const stream = new ReadableStream({
      start(controller) {
        const pump = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }
            controller.enqueue(value);
            pump();
          }).catch((err) => {
            controller.error(err);
          });
        };
        pump();
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
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return new Response(null, { status: 499 });
    }
    console.error('Research proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Research proxy failed' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
