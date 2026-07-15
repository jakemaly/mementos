"""Research brief and sketch generation via LLM structured output."""

import json
import logging
import os

from langchain_openai import ChatOpenAI

from research.state import QueryPlan, ResearchBrief, Sketch

logger = logging.getLogger("sidecar")

_MAX_RETRIES = 2


def _build_prompt(query: str, domains: list[str] | None, filetypes: list[str] | None) -> str:
    domain_hint = ""
    if domains:
        domain_hint = f"\nRestrict searches to these domains: {', '.join(domains)}"
    filetype_hint = ""
    if filetypes:
        filetype_hint = f"\nPrefer these filetypes: {', '.join(filetypes)}"

    return (
        f"You are a research assistant. Analyze the research query and produce a research brief.\n"
        f"Determine if it is question-based, definitional, explanatory, technical, or software-related.\n"
        f"{domain_hint}{filetype_hint}\n\n"
        f"Return ONLY valid JSON with this exact schema:\n"
        f"{{\n"
        f'  "reasoning_trace": ["step 1", "step 2", ...],\n'
        f'  "brief": "one-paragraph research scope and assumptions",\n'
        f'  "tools": ["tavily", ...],\n'
        f'  "queries": {{"overview": ["..."], "specific": ["..."]}},\n'
        f'  "expected_concepts": ["concept1", ...],\n'
        f'  "discriminative_terms": ["term1", ...],\n'
        f'  "expected_patterns": ["pattern1", ...],\n'
        f'  "preferred_domains": ["domain1", ...]\n'
        f"}}\n\n"
        f"Rules:\n"
        f"- tools: always include 'tavily'. Add 'arxiv' for academic/technical. Add 'github' for software/tooling.\n"
        f"- queries.overview: exactly 1 broad question. queries.specific: 0-5 targeted sub-questions.\n"
        f"- expected_concepts: 5-10 key concepts.\n"
        f"- discriminative_terms: 10-20 specific keywords, jargon, names.\n"
        f"- expected_patterns: 3-6 phrase patterns for question/definition queries, empty array otherwise.\n"
        f"- preferred_domains: 2-5 authoritative domains for question/definition queries, empty array otherwise.\n\n"
        f"Research query: {query}"
    )


def _parse(raw: str) -> dict:
    """Extract and parse JSON from LLM output, handling markdown code blocks."""
    text = raw.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first and last fence lines
        lines = lines[1:-1]
        text = "\n".join(lines)
    return json.loads(text)


def _validate(data: dict) -> tuple[ResearchBrief, Sketch]:
    """Validate required fields and split into Brief + Sketch."""
    brief = ResearchBrief(
        reasoning_trace=data.get("reasoning_trace", []),
        brief=data.get("brief", ""),
        tools=data.get("tools", ["tavily"]),
        queries=QueryPlan(
            overview=data.get("queries", {}).get("overview", []),
            specific=data.get("queries", {}).get("specific", []),
        ),
    )

    # Ensure tavily is always present
    if "tavily" not in brief["tools"]:
        brief["tools"].insert(0, "tavily")

    sketch = Sketch(
        expected_concepts=data.get("expected_concepts", []),
        discriminative_terms=data.get("discriminative_terms", []),
        expected_patterns=data.get("expected_patterns") or [],
        preferred_domains=data.get("preferred_domains") or [],
    )

    # Sanity: must have at least some content
    if not brief["queries"]["overview"] and not brief["queries"]["specific"]:
        raise ValueError("Brief has no queries")
    if not sketch["discriminative_terms"] and not sketch["expected_concepts"]:
        raise ValueError("Sketch has no terms or concepts")

    return brief, sketch


async def generate_brief_and_sketch(
    query: str,
    domains: list[str] | None = None,
    filetypes: list[str] | None = None,
) -> tuple[ResearchBrief, Sketch]:
    """Generate research brief and sketch via LLM. Retries on malformed JSON."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not configured")

    llm = ChatOpenAI(
        model=os.getenv("OPENAI_MODEL_NAME", "gpt-4o-mini"),
        openai_api_base=os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1"),
        openai_api_key=api_key,
        temperature=0,
    )

    prompt = _build_prompt(query, domains, filetypes)
    last_error: Exception | None = None

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            response = await llm.ainvoke(prompt)
            raw = response.content if hasattr(response, "content") else str(response)
            data = _parse(raw)
            return _validate(data)
        except Exception as e:
            last_error = e
            logger.warning(
                "Brief generation attempt %d failed: %s",
                attempt,
                e,
            )

    raise RuntimeError(f"Brief generation failed after {_MAX_RETRIES} attempts: {last_error}")
