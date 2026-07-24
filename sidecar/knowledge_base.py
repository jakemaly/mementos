"""Small compatibility boundary around the installed LightRAG public API."""

from collections.abc import Sequence
from typing import Any

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
