"""Tests for search tools — Tavily normalization & search stubs."""

from unittest.mock import AsyncMock, patch, MagicMock
import pytest

from research.tools.arxiv import arxiv_search
from research.tools.github import github_search
from research.tools.tavily import canonical_url, tavily_search


@pytest.mark.asyncio
async def test_stubs_return_empty():
    assert await arxiv_search(["test"]) == []
    assert await github_search(["test"]) == []


def test_canonical_url_drops_fragment_and_trailing_slash():
    assert canonical_url("HTTPS://Example.com/path/#section") == "https://example.com/path"
    assert canonical_url("https://example.com/path") == "https://example.com/path"


@pytest.mark.asyncio
async def test_tavily_search_success():
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "results": [
            {
                "url": "https://example.com/doc1",
                "title": "Example Doc 1",
                "content": "Detailed overview of example topic.",
                "score": 0.95,
            }
        ]
    }
    mock_response.raise_for_status = MagicMock()

    async def mock_post(*_a, **_kw):
        return mock_response

    mock_client = AsyncMock()
    mock_client.post = mock_post
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    with patch("research.tools.tavily.httpx.AsyncClient", return_value=mock_client):
        observed: list[tuple[str, list[dict]]] = []
        sources = await tavily_search(
            ["example query"],
            on_query_results=lambda query, result: observed.append((query, result)),
        )
        assert len(sources) == 1
        assert sources[0]["url"] == "https://example.com/doc1"
        assert sources[0]["source"] == "tavily"
        assert observed[0][0] == "example query"
        assert observed[0][1][0]["url"] == "https://example.com/doc1"


@pytest.mark.asyncio
async def test_tavily_deduplicates_same_url_across_queries():
    mock_response = MagicMock()
    mock_response.json.return_value = {"results": [{"url": "https://example.com/doc/", "title": "Doc", "content": "content"}]}
    mock_response.raise_for_status = MagicMock()
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("research.tools.tavily.httpx.AsyncClient", return_value=mock_client):
        observed: list[tuple[str, list[dict]]] = []
        sources = await tavily_search(
            ["first", "second"],
            on_query_results=lambda query, result: observed.append((query, result)),
        )

    assert len(sources) == 1
    assert len(observed) == 2
    assert sum(len(result) for _, result in observed) == 1
