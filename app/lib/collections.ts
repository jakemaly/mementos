export const COLLECTION_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function parseCollectionName(value: unknown): string | null {
  return typeof value === 'string' && COLLECTION_NAME_PATTERN.test(value) ? value : null;
}

export const collectionVectors = {
  size: 384,
  distance: 'Cosine' as const,
};
