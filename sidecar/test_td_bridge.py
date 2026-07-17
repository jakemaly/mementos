"""Self-check for TD retrieval bridge helpers (no live server required for parse path)."""
from __future__ import annotations

import json
from pathlib import Path

from main import _load_lookups, _MODES


def demo():
    name_to_id, pair_to_rel = _load_lookups()
    assert name_to_id, "empty name_to_id — run dump_graph.py"
    assert "Antigravity" in name_to_id
    # synthetic aquery_data-shaped payload
    section = {
        "entities": [{"entity_name": "Antigravity"}],
        "relationships": [{"src_id": "Antigravity", "tgt_id": "Google DeepMind"}],
    }
    entity_ids = [name_to_id[e["entity_name"]] for e in section["entities"] if e["entity_name"] in name_to_id]
    relation_ids = [
        pair_to_rel[(r["src_id"], r["tgt_id"])]
        for r in section["relationships"]
        if (r["src_id"], r["tgt_id"]) in pair_to_rel
    ]
    assert entity_ids and relation_ids
    assert set(_MODES) == {"naive", "local", "global", "hybrid"}
    dump = json.loads(Path("graph_dump.json").read_text())
    assert entity_ids[0] in {e["id"] for e in dump["entities"]}
    print("ok", entity_ids, relation_ids)


if __name__ == "__main__":
    demo()
