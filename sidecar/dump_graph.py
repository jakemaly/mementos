"""Dump LightRAG Qdrant entities/relationships + 3D coords for TD."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import networkx as nx
import numpy as np
from qdrant_client import QdrantClient
from sklearn.decomposition import PCA

QDRANT_URL = "http://localhost:6333"
DATA_DIR = Path(__file__).parent / "data"
OUT_PATH = Path(__file__).parent / "graph_dump.json"

# ponytail: names from this workspace's LightRAG init; change if working_dir/model changes
ENTITIES_COL = "lightrag_vdb_entities_all_minilm_l6_v2_384d"
RELATIONSHIPS_COL = "lightrag_vdb_relationships_all_minilm_l6_v2_384d"
GRAPHML = DATA_DIR / "graph_chunk_entity_relation.graphml"


def scroll_all(client: QdrantClient, name: str) -> list[dict]:
    out, offset = [], None
    while True:
        points, offset = client.scroll(
            collection_name=name,
            limit=256,
            offset=offset,
            with_vectors=True,
        )
        for p in points:
            vec = p.vector
            # ponytail: named vectors unused here; flatten if Qdrant ever returns a dict
            if isinstance(vec, dict):
                vec = next(iter(vec.values()))
            out.append({"id": str(p.id), "vector": list(vec), "payload": p.payload or {}})
        if offset is None:
            break
    return out


def entity_name(e: dict) -> str | None:
    p = e["payload"]
    return p.get("entity_name") or p.get("name")


def rebuild_graphml(entities: list[dict], relationships: list[dict]) -> nx.Graph:
    """Rewrite NetworkX GraphML from Qdrant so KG query modes work."""
    # ponytail: graph file was empty while Qdrant still had entities; heal here before TD/bridge use
    G = nx.Graph()
    for e in entities:
        p = e["payload"]
        name = entity_name(e)
        if not name:
            continue
        content = p.get("content") or ""
        desc = content.split("\n", 1)[1] if "\n" in content else content
        G.add_node(
            name,
            entity_id=name,
            entity_type="UNKNOWN",
            description=str(desc),
            source_id=str(p.get("source_id") or ""),
            file_path=str(p.get("file_path") or "unknown_source"),
        )
    for r in relationships:
        p = r["payload"]
        src, tgt = p.get("src_id"), p.get("tgt_id")
        if not src or not tgt:
            continue
        content = p.get("content") or ""
        parts = content.split("\n")
        keywords = parts[0].split("\t")[0] if parts else ""
        desc = parts[-1] if parts else content
        G.add_edge(
            src,
            tgt,
            weight=1.0,
            description=str(desc),
            keywords=str(keywords),
            source_id=str(p.get("source_id") or ""),
            file_path=str(p.get("file_path") or "unknown_source"),
        )
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    nx.write_graphml(G, GRAPHML)
    return G


def edges_from_relationships(relationships: list[dict], name_to_id: dict[str, str]) -> list[dict]:
    edges = []
    for r in relationships:
        p = r["payload"]
        src, tgt = p.get("src_id"), p.get("tgt_id")
        if src in name_to_id and tgt in name_to_id:
            edges.append(
                {
                    "source": name_to_id[src],
                    "target": name_to_id[tgt],
                    "relation_id": r["id"],
                    "content": p.get("content"),
                }
            )
    return edges


def add_xyz(entities: list[dict]) -> None:
    if not entities:
        return
    vecs = np.array([e["vector"] for e in entities], dtype=np.float64)
    n = len(entities)
    if n == 1:
        coords = np.zeros((1, 3))
    else:
        # ponytail: PCA already in venv via sklearn; umap-learn if layout quality matters
        k = min(3, n, vecs.shape[1])
        coords = PCA(n_components=k, random_state=42).fit_transform(vecs)
        if k < 3:
            pad = np.zeros((n, 3 - k))
            coords = np.hstack([coords, pad])
    for e, c in zip(entities, coords):
        e["xyz"] = [float(x) for x in c]


def dump() -> dict:
    client = QdrantClient(url=QDRANT_URL)
    entities = scroll_all(client, ENTITIES_COL)
    relationships = scroll_all(client, RELATIONSHIPS_COL)

    name_to_id = {}
    for e in entities:
        n = entity_name(e)
        if n:
            name_to_id[n] = e["id"]

    add_xyz(entities)
    G = rebuild_graphml(entities, relationships)
    edges = edges_from_relationships(relationships, name_to_id)
    if not edges and G.number_of_edges():
        # fallback if name lookup missed — use graph node names via name_to_id
        for u, v, data in G.edges(data=True):
            if u in name_to_id and v in name_to_id:
                edges.append({"source": name_to_id[u], "target": name_to_id[v], **data})

    id_set = {e["id"] for e in entities}
    kept, dropped = [], 0
    for edge in edges:
        if edge["source"] in id_set and edge["target"] in id_set:
            kept.append(edge)
        else:
            dropped += 1

    # strip raw vectors from output? TD doesn't need them for static cloud — keep for now so dump is self-contained
    return {
        "entities": entities,
        "relationships": relationships,
        "edges": kept,
        "name_to_id": name_to_id,
        "meta": {
            "entities_col": ENTITIES_COL,
            "relationships_col": RELATIONSHIPS_COL,
            "dropped_edges": dropped,
        },
    }


def self_check(data: dict) -> None:
    assert data["entities"], "no entities"
    assert data["name_to_id"], "empty name_to_id"
    for e in data["entities"]:
        xyz = e.get("xyz")
        assert xyz is not None and len(xyz) == 3
        assert all(np.isfinite(xyz))
    ids = {e["id"] for e in data["entities"]}
    for edge in data["edges"]:
        assert edge["source"] in ids and edge["target"] in ids
    # vectors are large; spot-check one entity still has a vector
    assert len(data["entities"][0]["vector"]) == 384


if __name__ == "__main__":
    data = dump()
    # drop vectors from on-disk dump — TD only needs xyz; reconnect via id if needed
    slim_entities = []
    for e in data["entities"]:
        slim_entities.append(
            {
                "id": e["id"],
                "xyz": e["xyz"],
                "payload": e["payload"],
            }
        )
    out = {
        "entities": slim_entities,
        "relationships": [
            {"id": r["id"], "payload": r["payload"]} for r in data["relationships"]
        ],
        "edges": data["edges"],
        "name_to_id": data["name_to_id"],
        "meta": data["meta"],
    }
    # self-check on full data (with vectors), then write slim
    self_check(data)
    OUT_PATH.write_text(json.dumps(out))
    print(
        f"Wrote {OUT_PATH}: {len(out['entities'])} entities, "
        f"{len(out['edges'])} edges, dropped={out['meta']['dropped_edges']}"
    )
    if "--check-only" in sys.argv:
        print("ok")
