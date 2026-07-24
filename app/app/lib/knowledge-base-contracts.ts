export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  query: string;
  collection: string;
  turn_id: string;
  history: ChatMessage[];
}

export type ChatEvent =
  | { event: 'status'; data: { turn_id: string; status: 'retrieving' } }
  | { event: 'delta'; data: { turn_id: string; text: string } }
  | { event: 'sources'; data: { turn_id: string; sources: Array<{ id: string; path: string; snippet: string }> } }
  | { event: 'insufficient_evidence'; data: { turn_id: string } }
  | { event: 'error'; data: { turn_id: string; error: string } }
  | { event: 'done'; data: { turn_id: string } };

const COLLECTION_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const TURN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const MAX_QUERY_CHARS = 4_000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_MESSAGE_CHARS = 4_000;

export function parseChatRequest(value: unknown): ChatRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !['query', 'collection', 'turn_id', 'history'].includes(key))) return null;

  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const collection = body.collection;
  const turnId = body.turn_id;
  if (!query || query.length > MAX_QUERY_CHARS || typeof collection !== 'string' || !COLLECTION_NAME.test(collection) || typeof turnId !== 'string' || !TURN_ID.test(turnId) || !Array.isArray(body.history) || body.history.length > MAX_HISTORY_MESSAGES) return null;

  const history: ChatMessage[] = [];
  for (const message of body.history) {
    if (typeof message !== 'object' || message === null || Array.isArray(message)) return null;
    const { role, content, ...extra } = message as Record<string, unknown>;
    if (Object.keys(extra).length || (role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null;
    const trimmedContent = content.trim();
    if (!trimmedContent || trimmedContent.length > MAX_HISTORY_MESSAGE_CHARS) return null;
    history.push({ role, content: trimmedContent });
  }

  return { query, collection, turn_id: turnId, history };
}
