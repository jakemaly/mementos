"""Tests for brief/sketch generation — parsing, validation, edge cases."""

import pytest
from research.sketch import _parse, _validate, _build_prompt

GOOD_JSON = {
    "reasoning_trace": ["analyzed query"],
    "brief": "Research scope",
    "tools": ["tavily", "arxiv"],
    "queries": {"overview": ["What is X?"], "specific": ["History of X?"]},
    "expected_concepts": ["concept1"],
    "discriminative_terms": ["term1"],
    "expected_patterns": ["is defined as"],
    "preferred_domains": ["wikipedia.org"],
}

JSON_WITH_MARKDOWN = '```json\n' + __import__('json').dumps(GOOD_JSON) + '\n```'


def test_parse_plain_json():
    data = _parse(__import__('json').dumps(GOOD_JSON))
    assert data["brief"] == "Research scope"


def test_parse_markdown_fenced():
    data = _parse(JSON_WITH_MARKDOWN)
    assert data["brief"] == "Research scope"


def test_validate_returns_brief_and_sketch():
    brief, sketch = _validate(GOOD_JSON)
    assert brief["brief"] == "Research scope"
    assert "tavily" in brief["tools"]
    assert sketch["expected_concepts"] == ["concept1"]
    assert sketch["discriminative_terms"] == ["term1"]


def test_validate_adds_tavily_if_missing():
    data = dict(GOOD_JSON, tools=[])
    brief, _ = _validate(data)
    assert "tavily" in brief["tools"]


def test_validate_rejects_empty_queries():
    bad = dict(GOOD_JSON, queries={"overview": [], "specific": []})
    with pytest.raises(ValueError, match="no queries"):
        _validate(bad)


def test_validate_rejects_empty_terms():
    bad = dict(GOOD_JSON, expected_concepts=[], discriminative_terms=[])
    with pytest.raises(ValueError, match="no terms"):
        _validate(bad)


def test_validate_empty_patterns_defaults():
    data = dict(GOOD_JSON, expected_patterns=None, preferred_domains=None)
    _, sketch = _validate(data)
    assert sketch["expected_patterns"] == []
    assert sketch["preferred_domains"] == []


def test_build_prompt_omits_user_filters():
    prompt = _build_prompt("test query")
    assert "Restrict searches" not in prompt
    assert "Prefer these filetypes" not in prompt
    assert "Research query: test query" in prompt
