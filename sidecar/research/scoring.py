"""SIRA source scoring — ported from TypeScript with exact parity."""

from research.state import Sketch, Source


def score_sources(sources: list[Source], sketch: Sketch) -> list[Source]:
    """Score and rank sources against the sketch using adaptive weights.

    Parity with app/app/api/research/route.ts::scoreSources:
    - Adaptive 50/30/20 weights (terms/patterns/domains)
    - Zero-score filtering
    - Stable descending sort
    - First-seen URL deduplication
    """
    terms = (
        [t.lower() for t in sketch.get("discriminative_terms", [])]
        + [t.lower() for t in sketch.get("expected_concepts", [])]
    )
    patterns = [p.lower() for p in sketch.get("expected_patterns") or []]
    domains = [d.lower() for d in sketch.get("preferred_domains") or []]

    # Adaptive weights
    if not patterns and not domains:
        w_term, w_pattern, w_domain = 1.0, 0.0, 0.0
    elif not patterns:
        w_term, w_pattern, w_domain = 0.7, 0.0, 0.3
    elif not domains:
        w_term, w_pattern, w_domain = 0.6, 0.4, 0.0
    else:
        w_term, w_pattern, w_domain = 0.5, 0.3, 0.2

    seen_urls: set[str] = set()
    scored: list[Source] = []

    for source in sources:
        url = source["url"].lower()
        if url in seen_urls:
            continue
        seen_urls.add(url)

        text = f"{source['title']} {source['snippet']}".lower()

        # Term score
        term_matches = sum(1 for t in terms if t in text)
        term_score = term_matches / len(terms) if terms else 0.0

        # Pattern score
        pattern_matches = sum(1 for p in patterns if p in text)
        pattern_score = pattern_matches / len(patterns) if patterns else 0.0

        # Domain match
        domain_match = 1.0 if any(d in url for d in domains) else 0.0

        score = w_term * term_score + w_pattern * pattern_score + w_domain * domain_match

        if score > 0:
            scored.append({**source, "score": score})

    scored.sort(key=lambda s: s["score"], reverse=True)
    return scored
