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
    mock_tavily_response = {
        "results": [
            {
                "url": "https://example.com/doc1",
                "title": "Example Doc 1",
                "content": "Detailed overview of example topic.",
                "score": 0.95,
            }
        ]
    }
    with patch("research.tools.tavily.tcl") as mock_tcl:
        mock_tcl.search = MagicMock(return_value=mock_tavily_response)
        sources = await tavily_search(["example query"])
        assert len(sources) == 1
        assert sources[0]["url"] == "https://example.com/doc1"
        assert sources[0]["source"] == "tavily"
