"""Small compatibility boundary around the installed LightRAG public API."""

import asyncio
import re
from collections.abc import Sequence
from typing import Any, Callable

from lightrag import LightRAG
from lightrag.base import QueryParam


async def query_with_sources(
    rag: LightRAG,
    query: str,
    conversation_history: Sequence[dict[str, str]] = (),
) -> dict[str, Any]:
    """Run one retrieval/generation call that returns both stream and sources."""
    return await rag.aquery_llm(
        query,
        QueryParam(
            mode="hybrid",
            stream=True,
            include_references=True,
            conversation_history=list(conversation_history),
        ),
    )


async def insert_with_provenance(rag: LightRAG, text: str, file_path: str) -> str:
    """Insert a document while retaining its user-visible source path."""
    return await rag.ainsert(text, file_paths=file_path)


_COLLECTION_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}\Z")


def collection_workspace(name: str) -> str:
    """Validate a collection name and map it to its LightRAG workspace.

    The ``default`` collection keeps the existing graph corpus by using
    the empty-string workspace that the original single-instance code
    relied on. Every other collection gets a dedicated workspace.
    """
    if not isinstance(name, str) or not _COLLECTION_NAME.fullmatch(name):
        raise ValueError("collection must use 1-64 letters, numbers, hyphens, or underscores")
    return "" if name == "default" else name


# ── Lazy per-collection registry ─────────────────────────────────────────

class LightRAGRegistry:
    """Concurrent-safe lazy registry of LightRAG instances."""

    def __init__(self, factory: Callable[[str], Any]):
        self._factory = factory
        self._instances: dict[str, Any] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    async def get(self, collection: str) -> Any:
        workspace = collection_workspace(collection)
        key = workspace
        if key not in self._instances:
            lock = self._locks.setdefault(key, asyncio.Lock())
            async with lock:
                if key not in self._instances:
                    rag = self._factory(workspace)
                    await rag.initialize_storages()
                    self._instances[key] = rag
        return self._instances[key]
