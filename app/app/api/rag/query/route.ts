import { NextResponse } from 'next/server';
import { parseChatRequest } from '@/app/lib/knowledge-base-contracts';

const SIDECAR_URL = 'http://localhost:8000/chat';
const CONNECT_TIMEOUT_MS = 120_000;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const chatRequest = parseChatRequest(body);
  if (!chatRequest) {
    return NextResponse.json({ error: 'Invalid chat request' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
  const abortForClient = () => controller.abort(request.signal.reason);
  if (request.signal.aborted) abortForClient();
  else request.signal.addEventListener('abort', abortForClient, { once: true });

  try {
    const upstream = await fetch(SIDECAR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatRequest),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!upstream.ok || !upstream.body) {
      request.signal.removeEventListener('abort', abortForClient);
      await upstream.body?.cancel();
      return NextResponse.json(
        { error: upstream.status >= 400 && upstream.status < 500 ? 'Invalid chat request' : 'Knowledge base is unavailable' },
        { status: upstream.status >= 400 && upstream.status < 500 ? 400 : 502 },
      );
    }

    const reader = upstream.body.getReader();
    const cleanup = () => {
      request.signal.removeEventListener('abort', abortForClient);
      clearTimeout(timeout);
    };
    const stream = new ReadableStream<Uint8Array>({
      async pull(streamController) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            cleanup();
            streamController.close();
          } else if (value) {
            streamController.enqueue(value);
          }
        } catch (error) {
          cleanup();
          streamController.error(error);
        }
      },
      async cancel() {
        controller.abort();
        cleanup();
        await reader.cancel();
      },
    });

    return new Response(stream, {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': upstream.headers.get('content-type') ?? 'text/event-stream; charset=utf-8',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: unknown) {
    clearTimeout(timeout);
    request.signal.removeEventListener('abort', abortForClient);
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ error: request.signal.aborted ? 'Request cancelled' : 'Knowledge base request timed out' }, { status: request.signal.aborted ? 499 : 504 });
    }
    console.error('RAG chat proxy error:', error);
    return NextResponse.json({ error: 'Knowledge base is unavailable' }, { status: 503 });
  }
}
