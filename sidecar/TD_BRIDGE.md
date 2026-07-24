# TouchDesigner bridge contract

The sidecar owns the graph snapshot used by TouchDesigner. Do not combine IDs from
one `graph_dump.json` version with retrieval results from another.

## Graph snapshot

- `GET /td/graph` returns the complete `graph_dump.json` payload plus a
  content-addressed `snapshot_id`.
- `POST /insert` rebuilds and atomically publishes the dump after LightRAG
  finishes indexing. Its success response includes `graph_snapshot_id`.
- `POST /td/refresh` retries the dump rebuild without indexing another document.
- A missing or unbuildable snapshot returns HTTP 503. TD should retain its last
  complete scene and retry; it must not render a partial replacement.

## Retrieval WebSocket

Connect to `ws://<sidecar-host>:8000/ws/retrieval` and send one query string.
For every request, the sidecar loads one complete graph snapshot, resolves all
returned IDs against it, and replies:

```json
{
  "snapshot_id": "sha256-of-the-current-graph-payload",
  "modes": {
    "naive": {"entity_ids": [], "relation_ids": []},
    "local": {"entity_ids": [], "relation_ids": []},
    "global": {"entity_ids": [], "relation_ids": []},
    "hybrid": {"entity_ids": [], "relation_ids": []}
  }
}
```

TD must only apply a retrieval response when its `snapshot_id` matches the
currently rendered `/td/graph` snapshot. On mismatch, reload `/td/graph` first.

The bridge uses LightRAG's structured `aquery_data()` output, pinned by
`requirements.txt`, rather than parsing `only_need_context` display text.
