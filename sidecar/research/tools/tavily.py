"""Tavily search tool — normalized to Source schema."""

import asyncio
import logging
import os
import time
from collections.abc import Callable
from urllib.parse import urlsplit, urlunsplit

import httpx

from research.state import Source

logger = logging.getLogger("sidecar")

_TAVILY_URL = "https://api.tavily.com/search"
_MAX_CONCURRENCY = 10


def canonical_url(url: str) -> str:
    parts = urlsplit(url)
    hostname = (parts.hostname or '').lower()
    netloc = hostname
    if parts.port:
        netloc = f'{hostname}:{parts.port}'
    path = parts.path.rstrip('/') or '/'
    return urlunsplit((parts.scheme.lower(), netloc, path, parts.query, '')).lower()


async def tavily_search(
    queries: list[str],
    _api_key: str | None = None,
    on_query_results: Callable[[str, list[Source]], None] | None = None,
) -> list[Source]:
    """Execute Tavily searches with bounded concurrency and return normalized sources."""
    api_key = _api_key or os.getenv("TAVILY_API_KEY")
    if not api_key:
        raise ValueError("TAVILY_API_KEY not configured")

    sem = asyncio.Semaphore(_MAX_CONCURRENCY)
    results: list[Source] = []
    seen_urls: set[str] = set()

    async def _search(query: str) -> list[Source]:
        async with sem:
            start = time.monotonic()
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(_TAVILY_URL, json={
                        "api_key": api_key,
                        "query": query,
                        "max_results": 10,
                        "search_depth": "basic",
                    })
                    resp.raise_for_status()
                    data = resp.json()

                sources = []
                for r in data.get("results") or []:
                    url = r["url"]
                    key = canonical_url(url)
                    if key not in seen_urls:
                        seen_urls.add(key)
                        sources.append(Source(
                            url=url,
                            title=r.get("title") or url,
                            snippet=r.get("content") or "",
                            score=0,
                            source="tavily",
                        ))
                if on_query_results:
                    on_query_results(query, sources)

                elapsed = time.monotonic() - start
                logger.info("Tavily '%s' → %d results in %.1fs", query, len(sources), elapsed)
                return sources
            except Exception as e:
                elapsed = time.monotonic() - start
                logger.error("Tavily '%s' failed after %.1fs: %s", query, elapsed, e)
                return []

    tasks = [_search(q) for q in queries]
    settled = await asyncio.gather(*tasks, return_exceptions=True)

    for result in settled:
        if isinstance(result, list):
            results.extend(result)

    logger.info("Tavily total: %d unique sources from %d queries", len(results), len(queries))
    return results
