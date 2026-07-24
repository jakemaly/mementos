'use client';

import { useCallback, useEffect, useState } from 'react';
import { CollectionsDrawer } from './components/collections/CollectionsDrawer';
import { DeepResearch } from './components/deep-research/DeepResearch';
import { KnowledgeBase } from './components/knowledge-base/KnowledgeBase';

type View = 'research' | 'knowledge-base';

export default function Dashboard() {
  const [view, setView] = useState<View>('research');
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [collectionUnavailable, setCollectionUnavailable] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  const refreshCollections = useCallback(async () => {
    try {
      const response = await fetch('/api/collections');
      const data = await response.json() as { collections?: unknown; unavailable?: boolean };
      const next = Array.isArray(data.collections) ? data.collections.filter((value): value is string => typeof value === 'string') : [];
      setCollections(next);
      setSelectedCollection((current) => next.includes(current) ? current : (next[0] || ''));
      setCollectionUnavailable(!response.ok || Boolean(data.unavailable));
    } catch {
      setCollections([]);
      setSelectedCollection('');
      setCollectionUnavailable(true);
    }
  }, []);

  useEffect(() => { void refreshCollections(); }, [refreshCollections]);

  const shared = {
    collections,
    selectedCollection,
    collectionUnavailable,
    onCollectionChange: setSelectedCollection,
    onOpenCollections: () => setCollectionsOpen(true),
  };

  return <>
    {view === 'research' ? <DeepResearch {...shared} onOpenKnowledgeBase={() => setView('knowledge-base')} /> : <KnowledgeBase
      collections={collections}
      selectedCollection={selectedCollection}
      unavailable={collectionUnavailable}
      onCollectionChange={setSelectedCollection}
      onOpenResearch={() => setView('research')}
      onOpenCollections={() => setCollectionsOpen(true)}
    />}
    <CollectionsDrawer
      open={collectionsOpen}
      collections={collections}
      selectedCollection={selectedCollection}
      unavailable={collectionUnavailable}
      onClose={() => setCollectionsOpen(false)}
      onCollectionChange={setSelectedCollection}
      onRefresh={refreshCollections}
    />
  </>;
}
