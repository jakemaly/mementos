"""Tests for search tools — Tavily normalization & search stubs."""

from unittest.mock import AsyncMock, patch, MagicMock
import pytest

from research.tools.arxiv import arxiv_search
from research.tools.github import github_search
from research.tools.tavily import tavily_search


@pytest.mark.asyncio
async def test_stubs_return_empty():
    assert await arxiv_search(["test"]) == []
    assert await github_search(["test"]) == []


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
        sources = await tavily_search(["example query"])
        assert len(sources) == 1
        assert sources[0]["url"] == "https://example.com/doc1"
        assert sources[0]["source"] == "tavily"
