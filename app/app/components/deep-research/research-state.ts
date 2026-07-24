import { Source } from '@/app/lib/research-contracts';

export function canonicalSourceKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.trim().toLowerCase().replace(/\/$/, '');
  }
}

export function mergeSources(existing: Source[], incoming: Source[]): Source[] {
  const seen = new Set(existing.map((source) => canonicalSourceKey(source.url)));
  const merged = [...existing];
  for (const source of incoming) {
    const key = canonicalSourceKey(source.url);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(source);
    }
  }
  return merged;
}

export function selectDiscoveredSources(
  selectedUrls: Set<string>,
  incoming: Source[],
  deselectedKeys: Set<string>,
): Set<string> {
  const selected = new Set(selectedUrls);
  for (const source of incoming) {
    if (!deselectedKeys.has(canonicalSourceKey(source.url))) {
      selected.add(source.url);
    }
  }
  return selected;
}

export function reconcileFinalSources(
  finalSources: Source[],
  deselectedKeys: Set<string>,
): Set<string> {
  return new Set(
    finalSources
      .filter((source) => !deselectedKeys.has(canonicalSourceKey(source.url)))
      .map((source) => source.url),
  );
}
