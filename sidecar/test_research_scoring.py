"""Parity tests for SIRA source scoring against the TypeScript reference."""

from research.scoring import score_sources
from research.state import Sketch, Source

# ── Fixtures ─────────────────────────────────────────────────────────────

SKETCH_TERMS_ONLY: Sketch = {
    "expected_concepts": ["transformer"],
    "discriminative_terms": ["attention"],
    "expected_patterns": [],
    "preferred_domains": [],
}

SKETCH_WITH_PATTERNS: Sketch = {
    "expected_concepts": ["transformer"],
    "discriminative_terms": ["attention"],
    "expected_patterns": ["is defined as"],
    "preferred_domains": [],
}

SKETCH_FULL: Sketch = {
    "expected_concepts": ["transformer"],
    "discriminative_terms": ["attention"],
    "expected_patterns": ["is defined as"],
    "preferred_domains": ["wikipedia.org"],
}

SOURCE_HIT_ALL = Source(
    url="https://en.wikipedia.org/wiki/Transformer",
    title="Transformer attention",
    snippet="Attention is defined as a mechanism",
    score=0,
)

SOURCE_HIT_TERMS = Source(
    url="https://example.com/transformers",
    title="Transformer attention",
    snippet="Some generic text",
    score=0,
)

SOURCE_MISS = Source(
    url="https://example.com/other",
    title="Unrelated topic",
    snippet="Nothing relevant here",
    score=0,
)


# ── Tests ────────────────────────────────────────────────────────────────

def test_terms_only_weights():
    """When no patterns/domains, w_term=1.0, w_pattern=0, w_domain=0."""
    result = score_sources([SOURCE_HIT_ALL], SKETCH_TERMS_ONLY)
    assert len(result) == 1
    # Both terms match → 2/2 = 1.0
    assert result[0]["score"] == 1.0


def test_with_patterns_weights():
    """When patterns present but no domains, w_term=0.6, w_pattern=0.4."""
    result = score_sources([SOURCE_HIT_ALL], SKETCH_WITH_PATTERNS)
    assert len(result) == 1
    # term: 2/2=1.0, pattern: 1/1=1.0 → 0.6*1 + 0.4*1 = 1.0
    assert result[0]["score"] == 1.0

    # Partial hit: only terms, no pattern
    result2 = score_sources([SOURCE_HIT_TERMS], SKETCH_WITH_PATTERNS)
    assert len(result2) == 1
    # term: 2/2=1.0, pattern: 0/1=0 → 0.6*1 + 0.4*0 = 0.6
    assert result2[0]["score"] == 0.6


def test_full_weights():
    """When all present, w_term=0.5, w_pattern=0.3, w_domain=0.2."""
    result = score_sources([SOURCE_HIT_ALL], SKETCH_FULL)
    assert len(result) == 1
    # term: 1.0, pattern: 1.0, domain: 1.0 → 0.5+0.3+0.2 = 1.0
    assert result[0]["score"] == 1.0


def test_zero_score_filtered():
    """Sources with score 0 are excluded."""
    result = score_sources([SOURCE_MISS], SKETCH_TERMS_ONLY)
    assert len(result) == 0


def test_url_deduplication():
    """Duplicate URLs (case-insensitive) are kept only once."""
    dup = Source(
        url="https://Example.com/transformers",
        title="Transformer attention",
        snippet="Some generic text",
        score=0,
    )
    result = score_sources([SOURCE_HIT_TERMS, dup], SKETCH_TERMS_ONLY)
    assert len(result) == 1


def test_stable_descending_sort():
    """Higher scores come first."""
    result = score_sources(
        [SOURCE_HIT_TERMS, SOURCE_HIT_ALL],
        SKETCH_WITH_PATTERNS,
    )
    assert len(result) == 2
    assert result[0]["score"] >= result[1]["score"]


def test_partial_term_match():
    """One of two terms matched → 0.5 term score."""
    partial = Source(
        url="https://example.com/only-attention",
        title="Attention mechanism",
        snippet="",
        score=0,
    )
    result = score_sources([partial], SKETCH_TERMS_ONLY)
    assert len(result) == 1
    # 1/2 = 0.5, w_term=1.0 → 0.5
    assert result[0]["score"] == 0.5


def test_empty_sources():
    """Empty input returns empty output."""
    assert score_sources([], SKETCH_FULL) == []


def test_empty_sketch_fields():
    """Sketch with no terms filters everything (no matches possible)."""
    empty_sketch: Sketch = {
        "expected_concepts": [],
        "discriminative_terms": [],
        "expected_patterns": [],
        "preferred_domains": [],
    }
    result = score_sources([SOURCE_HIT_ALL], empty_sketch)
    assert len(result) == 0
