import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

export const qdrant = new QdrantClient({
  url: QDRANT_URL,
});
