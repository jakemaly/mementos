import { NextResponse } from 'next/server';

interface Sketch {
  expectedConcepts: string[];
  discriminativeTerms: string[];
  searchQueries: string[];
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

  return `You are a research assistant. For the following research query, generate a JSON object with:
1. "expectedConcepts": array of 5-10 key concepts, theories, or topics a high-quality answer would cover
2. "discriminativeTerms": array of 10-20 specific keywords, jargon, names, and technical terms expected in authoritative sources
3. "searchQueries": array of 3-5 optimized search query strings${domainHint}${filetypeHint}

Research query: ${query}

Return ONLY valid JSON. No markdown, no explanation.`;
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

  return sources
    .map((source) => {
      const text = `${source.title} ${source.snippet}`.toLowerCase();
      const matches = terms.filter((term) => text.includes(term)).length;
      return { ...source, score: terms.length > 0 ? matches / terms.length : 0 };
    })
    .filter((s) => s.score > 0) // minimum 1 matching term
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
