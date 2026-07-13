import { NextResponse } from 'next/server';

interface Sketch {
  expectedConcepts: string[];
  discriminativeTerms: string[];
  searchQueries: string[];
  expectedPatterns?: string[];
  preferredDomains?: string[];
}

interface Source {
  url: string;
  title: string;
  snippet: string;
  score: number;
}

function buildSketchPrompt(
  query: string,
  domains?: string[],
  filetypes?: string[]
): string {
  const domainHint = domains?.length
    ? `\nRestrict searches to these domains: ${domains.join(', ')}`
    : '';
  const filetypeHint = filetypes?.length
    ? `\nPrefer these filetypes: ${filetypes.join(', ')}`
    : '';

  return `You are a research assistant. Analyze the research query. Determine if it is a question-based, definitional, or explanatory query (e.g., "What is...", "How does...", "Difference between...", "Explain...").
Generate a JSON object with:
1. "expectedConcepts": array of 5-10 key concepts, theories, or topics a high-quality answer would cover.
2. "discriminativeTerms": array of 10-20 specific keywords, jargon, names, and technical terms expected in authoritative sources.
3. "searchQueries": array of 3-5 optimized search query strings.${domainHint}${filetypeHint}
4. "expectedPatterns": If the query is question-based or asks for definitions/explanations, provide an array of 3-6 specific phrase patterns, structures, or transition markers typical of high-quality explanations, definitions, or comparative statements for this specific topic (e.g., "is defined as", "refers to", "refers specifically to", "specifically means", "in contrast to", "explains that"). Otherwise, return an empty array.
5. "preferredDomains": If the query is question-based or asks for definitions/explanations, provide an array of 2-5 high-quality, authoritative reference, educational, documentation, or encyclopedia domains most likely to contain robust explanations for this specific query (e.g., "wikipedia.org", "britannica.com", "developer.mozilla.org", "plato.stanford.edu", "w3schools.com"). Otherwise, return an empty array.

Research query: ${query}

Return ONLY valid JSON matching this schema. No markdown, no explanation.`;
}

async function generateSketch(query: string, domains?: string[], filetypes?: string[]): Promise<Sketch> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const baseUrl = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL_NAME || 'gpt-4o';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: buildSketchPrompt(query, domains, filetypes) }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM sketch generation failed: ${response.status} ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  // Extract JSON from possible markdown code blocks
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
  const parsed = JSON.parse(jsonMatch[1].trim());

  if (!parsed.expectedConcepts || !parsed.discriminativeTerms || !parsed.searchQueries) {
    throw new Error('Invalid sketch response from LLM');
  }

  // Ensure default arrays if missing
  parsed.expectedPatterns = parsed.expectedPatterns || [];
  parsed.preferredDomains = parsed.preferredDomains || [];

  return parsed as Sketch;
}

async function tavilySearch(
  query: string,
  includeDomains?: string[],
  excludeDomains?: string[]
): Promise<Source[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY not configured');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      include_domains: includeDomains,
      exclude_domains: excludeDomains,
      max_results: 10,
      search_depth: 'basic',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Tavily search failed: ${response.status} ${err}`);
  }

  const data = await response.json();
  return (data.results ?? []).map((r: any) => ({
    url: r.url,
    title: r.title ?? r.url,
    snippet: r.content ?? '',
    score: 0,
  }));
}

function scoreSources(sources: Source[], sketch: Sketch): Source[] {
  const terms = [...sketch.discriminativeTerms, ...sketch.expectedConcepts].map(
    (t) => t.toLowerCase()
  );
  const patterns = (sketch.expectedPatterns || []).map((p) => p.toLowerCase());
  const domains = (sketch.preferredDomains || []).map((d) => d.toLowerCase());

  // Determine weights based on availability
  let wTerm = 0.5;
  let wPattern = 0.3;
  let wDomain = 0.2;

  if (patterns.length === 0 && domains.length === 0) {
    wTerm = 1.0;
    wPattern = 0.0;
    wDomain = 0.0;
  } else if (patterns.length === 0) {
    wTerm = 0.7;
    wPattern = 0.0;
    wDomain = 0.3;
  } else if (domains.length === 0) {
    wTerm = 0.6;
    wPattern = 0.4;
    wDomain = 0.0;
  }

  return sources
    .map((source) => {
      const text = `${source.title} ${source.snippet}`.toLowerCase();
      const url = source.url.toLowerCase();

      // 1. Term Score
      const termMatches = terms.filter((term) => text.includes(term)).length;
      const termScore = terms.length > 0 ? termMatches / terms.length : 0;

      // 2. Pattern Score
      const patternMatches = patterns.filter((pat) => text.includes(pat)).length;
      const patternScore = patterns.length > 0 ? patternMatches / patterns.length : 0;

      // 3. Domain Match
      const domainMatch = domains.some((dom) => url.includes(dom)) ? 1.0 : 0.0;

      // Calculate final score
      const score = (wTerm * termScore) + (wPattern * patternScore) + (wDomain * domainMatch);

      return { ...source, score };
    })
    .filter((s) => s.score > 0) // Minimum threshold: at least one match of any kind
    .sort((a, b) => b.score - a.score);
}

export async function POST(request: Request) {
  try {
    const { query, domains, filetypes } = await request.json();

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Step 1: Generate SIRA Expected-Response Sketch
    const sketch = await generateSketch(query, domains, filetypes);

    // Step 2: Execute Tavily searches in parallel
    const allSources: Source[] = [];
    const seenUrls = new Set<string>();

    const searchResults = await Promise.allSettled(
      sketch.searchQueries.map((q) => tavilySearch(q, domains, undefined))
    );

    for (const result of searchResults) {
      if (result.status === 'fulfilled') {
        for (const source of result.value) {
          if (!seenUrls.has(source.url)) {
            seenUrls.add(source.url);
            allSources.push(source);
          }
        }
      }
    }

    // Step 3: Apply SIRA Sketch-Term Filtering
    const rankedSources = scoreSources(allSources, sketch);

    return NextResponse.json({ sketch, sources: rankedSources });
  } catch (error: any) {
    console.error('Deep research error:', error);
    return NextResponse.json(
      { error: error.message || 'Deep research failed' },
      { status: 500 }
    );
  }
}
