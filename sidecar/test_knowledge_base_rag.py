"""Executable contract tests for the Knowledge Base LightRAG adapter."""

from collections.abc import AsyncIterator
import inspect

import pytest
from lightrag import LightRAG
from lightrag.base import QueryParam, QueryResult
import lightrag.lightrag as lightrag_module

from knowledge_base import (
    LightRAGRegistry,
    collection_workspace,
    insert_with_provenance,
    query_with_sources,
)


async def _answer_chunks() -> AsyncIterator[str]:
    yield "Grounded "
    yield "answer"


@pytest.mark.asyncio
async def test_capabilities_return_stream_and_structured_sources_from_one_retrieval(monkeypatch):
    """The installed public API returns its answer and references together."""
    retrieval_calls = []
    chunks = _answer_chunks()
    raw_data = {
        "status": "success",
        "data": {
            "chunks": [
                {
                    "content": "Source passage",
                    "file_path": "notes/source.md",
                    "chunk_id": "chunk-1",
                    "reference_id": "1",
                }
            ],
            "references": [
                {"reference_id": "1", "file_path": "notes/source.md"}
            ],
        },
        "metadata": {"query_mode": "hybrid"},
    }

    async def fake_kg_query(
        query,
        graph,
        entities,
        relationships,
        text_chunks,
        param,
        global_config,
        **kwargs,
    ):
        retrieval_calls.append((query, param))
        return QueryResult(
            response_iterator=chunks,
            raw_data=raw_data,
            is_streaming=True,
        )

    monkeypatch.setattr(lightrag_module, "kg_query", fake_kg_query)

    class FakeLightRAG:
        chunk_entity_relation_graph = None
        entities_vdb = None
        relationships_vdb = None
        text_chunks = None
        llm_response_cache = None
        chunks_vdb = None

        def _build_global_config(self):
            return {}

        async def _query_done(self):
            return None

    result = await LightRAG.aquery_llm(
        FakeLightRAG(),
        "What is grounded?",
        QueryParam(mode="hybrid", stream=True, include_references=True),
    )

    assert len(retrieval_calls) == 1
    assert result["data"]["chunks"][0]["reference_id"] == "1"
    assert result["data"]["references"] == [
        {"reference_id": "1", "file_path": "notes/source.md"}
    ]
    assert result["llm_response"]["response_iterator"] is chunks
    assert result["llm_response"]["is_streaming"] is True


@pytest.mark.asyncio
async def test_capabilities_adapter_passes_history_to_the_single_public_query_call():
    history = [
        {"role": "user", "content": "Earlier question"},
        {"role": "assistant", "content": "Earlier answer"},
    ]
    calls = []
    expected = {"data": {"chunks": [], "references": []}, "llm_response": {}}

    class FakeRAG:
        async def aquery_llm(self, query, param):
            calls.append((query, param))
            return expected

    result = await query_with_sources(FakeRAG(), "Follow-up", history)

    assert result is expected
    assert len(calls) == 1
    query, param = calls[0]
    assert query == "Follow-up"
    assert param.mode == "hybrid"
    assert param.stream is True
    assert param.include_references is True
    assert param.conversation_history == history


@pytest.mark.asyncio
async def test_capabilities_adapter_passes_file_provenance_to_public_insert_call():
    calls = []

    class FakeRAG:
        async def ainsert(self, text, *, file_paths):
            calls.append((text, file_paths))
            return "track-1"

    track_id = await insert_with_provenance(
        FakeRAG(), "Document text", "notes/source.md"
    )

    assert track_id == "track-1"
    assert calls == [("Document text", "notes/source.md")]


def test_capabilities_are_present_in_the_installed_lightrag_public_signatures():
    constructor = inspect.signature(LightRAG)
    query = inspect.signature(LightRAG.aquery_llm)
    insert = inspect.signature(LightRAG.ainsert)

    assert "workspace" in constructor.parameters
    assert "param" in query.parameters
    assert "file_paths" in insert.parameters
    assert {
        "conversation_history",
        "include_references",
        "stream",
    }.issubset(QueryParam.__dataclass_fields__)


@pytest.mark.asyncio
async def test_registry_reuses_one_initialized_instance_for_concurrent_requests():
    created = []

    class FakeRAG:
        def __init__(self, workspace):
            self.workspace = workspace
            self.initializations = 0

        async def initialize_storages(self):
            self.initializations += 1
            await __import__("asyncio").sleep(0)

    def factory(workspace):
        rag = FakeRAG(workspace)
        created.append(rag)
        return rag

    registry = LightRAGRegistry(factory)
    instances = await __import__("asyncio").gather(
        *(registry.get("notes") for _ in range(10))
    )

    assert len(created) == 1
    assert all(instance is created[0] for instance in instances)
    assert created[0].initializations == 1


@pytest.mark.asyncio
async def test_registry_isolates_collection_workspaces_and_preserves_default():
    class FakeRAG:
        def __init__(self, workspace):
            self.workspace = workspace

        async def initialize_storages(self):
            return None

    registry = LightRAGRegistry(FakeRAG)

    default_rag = await registry.get("default")
    research_rag = await registry.get("research")

    assert collection_workspace("default") == ""
    assert default_rag.workspace == ""
    assert research_rag.workspace == "research"
    assert default_rag is not research_rag


@pytest.mark.parametrize("name", ["", "with space", "../data", "x" * 65])
def test_registry_rejects_invalid_collection_names(name):
    with pytest.raises(ValueError, match="collection"):
        collection_workspace(name)


def test_registry_main_factory_shares_expensive_model_functions(monkeypatch):
    import sys

    sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
    import main as main_module

    constructor_calls = []
    embedding = object()
    llm = object()

    class FakeLightRAG:
        def __init__(self, **kwargs):
            constructor_calls.append(kwargs)

    monkeypatch.setattr(main_module, "LightRAG", FakeLightRAG)
    monkeypatch.setattr(main_module, "_embedding_func", None)
    monkeypatch.setattr(main_module, "_llm_func", None)
    monkeypatch.setattr(main_module, "_create_embedding_func", lambda: embedding)
    monkeypatch.setattr(main_module, "_create_llm_func", lambda: llm)

    main_module._create_rag("")
    main_module._create_rag("research")

    assert [call["workspace"] for call in constructor_calls] == ["", "research"]
    assert all(call["embedding_func"] is embedding for call in constructor_calls)
    assert all(call["llm_model_func"] is llm for call in constructor_calls)
