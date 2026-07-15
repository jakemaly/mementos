"""arXiv search tool — Atom XML parsing with 1 req/sec rate serialization."""

import asyncio
import logging
import re
import time
import xml.etree.ElementTree as ET

import httpx

from research.state import Source

logger = logging.getLogger("sidecar")

_ARXIV_URL = "https://export.arxiv.org/api/query"
_RATE_DELAY = 1.0  # ponytail: 1s between requests per arXiv politeness policy

ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}


def _parse_atom(xml_text: str) -> list[Source]:
    """Parse arXiv Atom XML into normalized sources."""
    root = ET.fromstring(xml_text)
    sources = []

    for entry in root.findall("atom:entry", ATOM_NS):
        title_el = entry.find("atom:title", ATOM_NS)
        summary_el = entry.find("atom:summary", ATOM_NS)
        published_el = entry.find("atom:published", ATOM_NS)
        id_el = entry.find("atom:id", ATOM_NS)

        title = title_el.text.strip() if title_el is not None and title_el.text else "Untitled"
        # ponytail: arXiv wraps summary in <p> tags, so text is in child elements
        snippet = ""
        if summary_el is not None:
            # Try direct text first, then child elements (like <p>)
            if summary_el.text:
                snippet = summary_el.text.strip()
            else:
                # Collect text from all child elements
                snippet = "".join(t for t in summary_el.itertext() if t)
        snippet = snippet.strip()[:500]
        url = (id_el.text or "").strip() if id_el is not None else ""

        authors = []
        for author in entry.findall("atom:author/atom:name", ATOM_NS):
            if author.text:
                authors.append(author.text.strip())

        categories = []
        for cat in entry.findall("atom:category", ATOM_NS):
            term = cat.get("term")
            if term:
                categories.append(term)

        if url:
            sources.append(Source(
                url=url,
                title=title,
                snippet=snippet,
                score=0,
                source="arxiv",
                metadata={
                    "authors": authors,
                    "date": published_el.text.strip() if published_el is not None and published_el.text else "",
                    "categories": categories,
                },
            ))

    return sources


async def arxiv_search(
    queries: list[str],
    max_results: int = 5,
) -> list[Source]:
    """Execute arXiv searches with rate-limit serialization and return normalized sources."""
    all_sources: list[Source] = []
    seen_urls: set[str] = set()

    async with httpx.AsyncClient(timeout=15) as client:
        for query in queries:
            start = time.monotonic()
            try:
                resp = await client.get(_ARXIV_URL, params={
                    "search_query": query,
                    "max_results": max_results,
                    "sortBy": "submittedDate",
                    "sortOrder": "descending",
                })
                resp.raise_for_status()
                sources = _parse_atom(resp.text)

                for s in sources:
                    if s["url"].lower() not in seen_urls:
                        seen_urls.add(s["url"].lower())
                        all_sources.append(s)

                elapsed = time.monotonic() - start
                logger.info("arXiv '%s' → %d results in %.1fs", query, len(sources), elapsed)
            except Exception as e:
                elapsed = time.monotonic() - start
                logger.error("arXiv '%s' failed after %.1fs: %s", query, elapsed, e)

            # Rate limit: sleep between requests (not after the last one)
            if queries.index(query) < len(queries) - 1:
                await asyncio.sleep(_RATE_DELAY)

    logger.info("arXiv total: %d unique sources from %d queries", len(all_sources), len(queries))
    return all_sources
