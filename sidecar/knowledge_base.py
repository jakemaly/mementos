"""Small compatibility boundary around the installed LightRAG public API."""

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable, Sequence
from contextlib import suppress
from dataclasses import dataclass
import inspect
import re
from typing import Any

from lightrag import LightRAG
from lightrag.base import QueryParam


class ChatRequestError(ValueError):
    """A chat request cannot safely be sent to LightRAG."""


@dataclass(frozen=True)
class ChatRequest:
    query: str
    collection: str
    turn_id: str
    history: list[dict[str, str]]


_COLLECTION_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}\Z")
_TURN_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}\Z")
_MAX_QUERY_CHARS = 4_000
_MAX_HISTORY_MESSAGES = 20
_MAX_HISTORY_MESSAGE_CHARS = 4_000


def collection_workspace(name: str) -> str:
    """Validate a collection name and map it to its LightRAG workspace.

    The ``default`` collection keeps the existing graph corpus by using
    the empty-string workspace that the original single-instance code
    relied on. Every other collection gets a dedicated workspace.
    """
    if not isinstance(name, str) or not _COLLECTION_NAME.fullmatch(name):
        raise ValueError("collection must use 1-64 letters, numbers, hyphens, or underscores")
    return "" if name == "default" else name


def parse_chat_request(data: Any) -> ChatRequest:
    """Validate the narrow, client-controlled chat contract."""
    if not isinstance(data, dict):
        raise ChatRequestError("JSON body must be an object")

    allowed = {"query", "collection", "turn_id", "history"}
    if set(data) - allowed:
        raise ChatRequestError("unsupported chat request field")

    query = data.get("query")
    collection = data.get("collection")
    turn_id = data.get("turn_id")
    history = data.get("history")
    if not isinstance(query, str) or not (query := query.strip()) or len(query) > _MAX_QUERY_CHARS:
        raise ChatRequestError("query must contain 1-4000 characters")
    try:
        collection_workspace(collection)
    except ValueError as error:
        raise ChatRequestError(str(error)) from error
    if not isinstance(turn_id, str) or not _TURN_ID.fullmatch(turn_id):
        raise ChatRequestError("turn_id must use 1-128 letters, numbers, hyphens, or underscores")
    if not isinstance(history, list) or len(history) > _MAX_HISTORY_MESSAGES:
        raise ChatRequestError("history must contain at most 20 messages")

    validated_history = []
    for message in history:
        if not isinstance(message, dict) or set(message) != {"role", "content"}:
            raise ChatRequestError("each history message must contain role and content")
        role, content = message["role"], message["content"]
        if role not in {"user", "assistant"} or not isinstance(content, str) or not (content := content.strip()) or len(content) > _MAX_HISTORY_MESSAGE_CHARS:
            raise ChatRequestError("history messages must have a user or assistant role and 1-4000 characters")
        validated_history.append({"role": role, "content": content})

    return ChatRequest(query, collection, turn_id, validated_history)


async def query_with_sources(rag: LightRAG, query: str, conversation_history: Sequence[dict[str, str]] = ()) -> dict[str, Any]:
    """Run one retrieval/generation call that returns both stream and sources."""
    return await rag.aquery_llm(query, QueryParam(mode="hybrid", stream=True, include_references=True, conversation_history=list(conversation_history)))


async def insert_with_provenance(rag: LightRAG, text: str, file_path: str) -> str:
    """Insert a document while retaining its user-visible source path."""
    return await rag.ainsert(text, file_paths=file_path)


def _sources(result: dict[str, Any]) -> list[dict[str, str]]:
    source_by_id: dict[str, dict[str, str]] = {}
    data = result.get("data") if isinstance(result, dict) else None
    chunks = data.get("chunks", []) if isinstance(data, dict) else []
    for chunk in chunks:
        if not isinstance(chunk, dict):
            continue
        reference_id, path = chunk.get("reference_id"), chunk.get("file_path")
        if isinstance(reference_id, str) and reference_id and isinstance(path, str) and path:
            source_by_id.setdefault(reference_id, {"id": reference_id, "path": path, "snippet": str(chunk.get("content", ""))[:500]})
    return list(source_by_id.values())


async def _disconnected(check: Callable[[], bool | Awaitable[bool]]) -> bool:
    value = check()
    return await value if inspect.isawaitable(value) else value


async def _cancel(task: asyncio.Task[Any]) -> None:
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


async def stream_chat_events(
    rag: LightRAG,
    request: ChatRequest,
    is_disconnected: Callable[[], bool | Awaitable[bool]],
) -> AsyncIterator[dict[str, Any]]:
    """Produce ordered, grounded chat events and cancel work on disconnect."""
    yield {"event": "status", "data": {"turn_id": request.turn_id, "status": "retrieving"}}
    query_task = asyncio.create_task(query_with_sources(rag, request.query, request.history))
    while not query_task.done():
        if await _disconnected(is_disconnected):
            await _cancel(query_task)
            return
        await asyncio.sleep(0.01)
    if await _disconnected(is_disconnected):
        await _cancel(query_task)
        return
    result = await query_task
    sources = _sources(result)
    if not sources:
        yield {"event": "insufficient_evidence", "data": {"turn_id": request.turn_id}}
        yield {"event": "done", "data": {"turn_id": request.turn_id}}
        return

    response = result.get("llm_response", {})
    is_streaming = isinstance(response, dict) and response.get("is_streaming")
    iterator = response.get("response_iterator") if isinstance(response, dict) else None
    if not is_streaming or iterator is None:
        content = response.get("content", "") if isinstance(response, dict) else ""
        if content:
            yield {"event": "delta", "data": {"turn_id": request.turn_id, "text": str(content)}}
    else:
        while True:
            next_task = asyncio.create_task(anext(iterator))
            while not next_task.done():
                if await _disconnected(is_disconnected):
                    await _cancel(next_task)
                    aclose = getattr(iterator, "aclose", None)
                    if aclose:
                        await aclose()
                    return
                await asyncio.sleep(0.01)
            try:
                text = await next_task
            except StopAsyncIteration:
                break
            yield {"event": "delta", "data": {"turn_id": request.turn_id, "text": str(text)}}

    yield {"event": "sources", "data": {"turn_id": request.turn_id, "sources": sources}}
    yield {"event": "done", "data": {"turn_id": request.turn_id}}


# ── Lazy per-collection registry ─────────────────────────────────────────

class LightRAGRegistry:
    """Concurrent-safe lazy registry of LightRAG instances."""

    def __init__(self, factory: Callable[[str], Any]):
        self._factory = factory
        self._instances: dict[str, Any] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    async def get(self, collection: str) -> Any:
        workspace = collection_workspace(collection)
        if workspace not in self._instances:
            lock = self._locks.setdefault(workspace, asyncio.Lock())
            async with lock:
                if workspace not in self._instances:
                    rag = self._factory(workspace)
                    await rag.initialize_storages()
                    self._instances[workspace] = rag
        return self._instances[workspace]
