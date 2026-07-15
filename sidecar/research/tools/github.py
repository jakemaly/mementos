"""GitHub search tool — repo search with optional README fetch."""

import logging
import os
import time

import httpx

from research.state import Source

logger = logging.getLogger("sidecar")

_GITHUB_SEARCH_URL = "https://api.github.com/search/repositories"
_GITHUB_README_URL = "https://api.github.com/repos/{owner}/{repo}/readme"
_MAX_RESULTS = 5
_README_FETCH_LIMIT = 2  # Fetch README only for top 2 repos


async def github_search(
    queries: list[str],
    _token: str | None = None,
) -> list[Source]:
    """Execute GitHub repo searches and return normalized sources."""
    token = _token or os.getenv("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    all_sources: list[Source] = []
    seen_urls: set[str] = set()

    async with httpx.AsyncClient(timeout=15) as client:
        for query in queries:
            start = time.monotonic()
            try:
                resp = await client.get(_GITHUB_SEARCH_URL, headers=headers, params={
                    "q": query,
                    "sort": "stars",
                    "order": "desc",
                    "per_page": _MAX_RESULTS,
                })
                resp.raise_for_status()
                data = resp.json()

                items = data.get("items") or []
                for i, item in enumerate(items):
                    url = item.get("html_url", "")
                    if not url or url.lower() in seen_urls:
                        continue
                    seen_urls.add(url.lower())

                    title = item.get("full_name", "")
                    description = item.get("description") or ""

                    # Fetch README for top 2 results
                    snippet = description
                    if i < _README_FETCH_LIMIT:
                        readme = await _fetch_readme(client, headers, item, start)
                        if readme:
                            snippet = readme[:500]

                    all_sources.append(Source(
                        url=url,
                        title=title,
                        snippet=snippet,
                        score=0,
                        source="github",
                        metadata={
                            "stars": item.get("stargazers_count", 0),
                            "forks": item.get("forks_count", 0),
                            "language": item.get("language") or "",
                            "topics": item.get("topics") or [],
                            "updated_at": item.get("updated_at") or "",
                        },
                    ))

                elapsed = time.monotonic() - start
                logger.info("GitHub '%s' → %d results in %.1fs", query, len(items), elapsed)
            except Exception as e:
                elapsed = time.monotonic() - start
                logger.error("GitHub '%s' failed after %.1fs: %s", query, elapsed, e)

    logger.info("GitHub total: %d unique sources from %d queries", len(all_sources), len(queries))
    return all_sources


async def _fetch_readme(
    client: httpx.AsyncClient,
    headers: dict,
    item: dict,
    query_start: float,
) -> str | None:
    """Fetch README content for a single repo. Returns None on any failure."""
    full_name = item.get("full_name", "")
    if not full_name or "/" not in full_name:
        return None

    owner, repo = full_name.split("/", 1)
    try:
        resp = await client.get(
            _GITHUB_README_URL.format(owner=owner, repo=repo),
            headers=headers,
            params={"format": "raw"},
        )
        if resp.status_code == 403:
            # Rate limited — log and bail
            logger.warning("GitHub rate limited on README for %s/%s", owner, repo)
            return None
        resp.raise_for_status()
        text = resp.text
        # ponytail: strip markdown headers for cleaner snippet
        import re
        text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)
        return text.strip()[:500]
    except Exception as e:
        logger.warning("GitHub README fetch failed for %s/%s: %s", owner, repo, e)
        return None
