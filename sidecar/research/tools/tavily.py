"""Tavily search tool — normalized to Source schema."""

import asyncio
import logging
import os
import time

import httpx

from research.state import Source

logger = logging.getLogger("sidecar")

_TAVILY_URL = "https://api.tavily.com/search"
_MAX_CONCURRENCY = 10


async def tavily_search(
    queries: list[str],
    include_domains: list[str] | None = None,
    _api_key: str | None = None,
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
                        "include_domains": include_domains,
                        "max_results": 10,
                        "search_depth": "basic",
                    })
                    resp.raise_for_status()
                    data = resp.json()

                sources = []
                for r in data.get("results") or []:
                    url = r["url"]
                    if url.lower() not in seen_urls:
                        seen_urls.add(url.lower())
                        sources.append(Source(
                            url=url,
                            title=r.get("title") or url,
                            snippet=r.get("content") or "",
                            score=0,
                            source="tavily",
                        ))
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
