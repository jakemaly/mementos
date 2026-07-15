"""Tests for search tools — arXiv XML parsing, GitHub responses, Tavily normalization."""

import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

import httpx
import pytest

from research.tools.arxiv import _parse_atom, arxiv_search
from research.tools.github import github_search
from research.tools.tavily import tavily_search

# ── arXiv XML fixtures ──────────────────────────────────────────────────

ARXIV_ATOM = """<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title type="html">Attention Is All You Need</title>
    <summary type="html"><p>The dominant sequence transduction models are based on
    complex recurrent or convolutional neural networks. We propose a new simple
    architecture.</p></summary>
    <id>http://arxiv.org/abs/1706.03762</id>
    <published>2017-06-12T00:00:00Z</published>
    <author><name>Vaswani A</name></author>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.CL" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
  <entry>
    <title type="html">Transformer XL</title>
    <summary type="html"><p>Memory is crucial for understanding long sequences.</p></summary>
    <id>http://arxiv.org/abs/1901.02860</id>
    <published>2019-01-09T00:00:00Z</published>
    <author><name>Dai Z</name></author>
    <category term="cs.CL" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
</feed>"""

ARXIV_EMPTY = """<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
</feed>"""


def test_parse_arxiv_atom():
    sources = _parse_atom(ARXIV_ATOM)
    assert len(sources) == 2
    assert sources[0]["title"] == "Attention Is All You Need"
    assert "dominant sequence" in sources[0]["snippet"].lower()
    assert sources[0]["url"] == "http://arxiv.org/abs/1706.03762"
    assert sources[0]["source"] == "arxiv"
    assert sources[0]["metadata"]["authors"] == ["Vaswani A"]
    assert "cs.LG" in sources[0]["metadata"]["categories"]


def test_parse_arxiv_strips_html():
    sources = _parse_atom(ARXIV_ATOM)
    assert "<p>" not in sources[0]["snippet"]


def test_parse_arxiv_empty():
    assert _parse_atom(ARXIV_EMPTY) == []


def test_parse_arxiv_snippet_truncated():
    """Snippet is capped at 500 chars."""
    long_summary = "x" * 1000
    xml = f"""<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>Test</title>
        <summary type="html"><p>{long_summary}</p></summary>
        <id>http://arxiv.org/abs/0000.0000</id>
        <published>2024-01-01T00:00:00Z</published>
      </entry>
    </feed>"""
    sources = _parse_atom(xml)
    assert len(sources[0]["snippet"]) <= 500


# ── arXiv search async tests ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_arxiv_search_dedup():
    """Duplicate URLs across queries are deduplicated."""
    with patch("research.tools.arxiv.httpx") as mock_httpx:
        mock_client = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.text = ARXIV_ATOM
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_httpx.AsyncClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_httpx.AsyncClient.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("research.tools.arxiv._RATE_DELAY", 0):
            sources = await arxiv_search(["test1", "test2"])
            # Both queries return same 2 entries → deduped to 2
            assert len(sources) == 2


# ── GitHub tests ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_github_search_basic():
    with patch("research.tools.github.httpx") as mock_httpx:
        mock_client = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "items": [
                {
                    "full_name": "owner/repo",
                    "html_url": "https://github.com/owner/repo",
                    "description": "A test repo",
                    "stargazers_count": 100,
                    "forks_count": 10,
                    "language": "Python",
                    "topics": ["test"],
                    "updated_at": "2024-01-01T00:00:00Z",
                }
            ]
        }
        # README fetch returns 404 (no README)
        mock_readme_resp = MagicMock()
        mock_readme_resp.status_code = 404
        mock_client.get = AsyncMock(side_effect=[mock_resp, mock_readme_resp])
        mock_httpx.AsyncClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_httpx.AsyncClient.return_value.__aexit__ = AsyncMock(return_value=False)

        sources = await github_search(["test query"])
        assert len(sources) == 1
        assert sources[0]["title"] == "owner/repo"
        assert sources[0]["source"] == "github"
        assert sources[0]["metadata"]["stars"] == 100


@pytest.mark.asyncio
async def test_github_rate_limit_handling():
    """403 on README fetch is handled gracefully."""
    with patch("research.tools.github.httpx") as mock_httpx:
        mock_client = AsyncMock()
        mock_search_resp = MagicMock()
        mock_search_resp.raise_for_status = MagicMock()
        mock_search_resp.json.return_value = {
            "items": [
                {
                    "full_name": "owner/repo",
                    "html_url": "https://github.com/owner/repo",
                    "description": "A test repo",
                    "stargazers_count": 50,
                    "forks_count": 0,
                    "language": None,
                    "topics": [],
                    "updated_at": "",
                }
            ]
        }
        mock_readme_resp = MagicMock()
        mock_readme_resp.status_code = 403
        mock_client.get = AsyncMock(side_effect=[mock_search_resp, mock_readme_resp])
        mock_httpx.AsyncClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_httpx.AsyncClient.return_value.__aexit__ = AsyncMock(return_value=False)

        sources = await github_search(["test"])
        assert len(sources) == 1
        # Falls back to description when README fails
        assert sources[0]["snippet"] == "A test repo"


@pytest.mark.asyncio
async def test_github_search_empty_response():
    with patch("research.tools.github.httpx") as mock_httpx:
        mock_client = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"items": []}
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_httpx.AsyncClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_httpx.AsyncClient.return_value.__aexit__ = AsyncMock(return_value=False)

        sources = await github_search(["nonexistent-repo-xyz"])
        assert sources == []


# ── Tavily tests ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_tavily_normalization():
    with patch("research.tools.tavily.httpx") as mock_httpx:
        mock_client = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "results": [
                {"url": "https://example.com/1", "title": "Result 1", "content": "Snippet 1"},
                {"url": "https://example.com/2", "title": "", "content": ""},
            ]
        }
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_httpx.AsyncClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_httpx.AsyncClient.return_value.__aexit__ = AsyncMock(return_value=False)

        sources = await tavily_search(["test"], _api_key="fake")
        assert len(sources) == 2
        assert sources[0]["source"] == "tavily"
        # Empty title falls back to URL
        assert sources[1]["title"] == "https://example.com/2"


@pytest.mark.asyncio
async def test_tavily_missing_api_key():
    with pytest.raises(ValueError, match="TAVILY_API_KEY"):
        with patch("research.tools.tavily.os.getenv", return_value=None):
            await tavily_search(["test"])


@pytest.mark.asyncio
async def test_tavily_failure_isolation():
    """One failed query doesn't abort the rest."""
    with patch("research.tools.tavily.httpx") as mock_httpx:
        mock_client = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"results": []}
        mock_client.post = AsyncMock(side_effect=[httpx.HTTPError("fail"), mock_resp])
        mock_httpx.AsyncClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_httpx.AsyncClient.return_value.__aexit__ = AsyncMock(return_value=False)

        sources = await tavily_search(["bad", "good"], _api_key="fake")
        # Second query succeeded (empty results), first failed → total 0
        assert sources == []
