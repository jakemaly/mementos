import { NextResponse } from 'next/server';

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${SIDECAR_URL}/research/graph/topology`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      throw new Error(`Sidecar topology returned status ${res.status}`);
    }
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!data) {
      throw new Error('Empty response from sidecar topology');
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Topology proxy error:', error);
    // Fallback static topology
    return NextResponse.json({
      nodes: [
        { id: 'brief', label: 'Brief Generator', type: 'brief' },
        { id: 'supervisor', label: 'ODR Supervisor', type: 'supervisor' },
        { id: 'tools', label: 'Tavily Web Search', type: 'tool' },
        { id: 'scoring', label: 'SIRA Sketch Scoring', type: 'scoring' },
        { id: 'ingest', label: 'LightRAG Ingest', type: 'ingest' },
      ],
      edges: [
        { source: 'brief', target: 'supervisor' },
        { source: 'supervisor', target: 'tools', label: 'continue' },
        { source: 'tools', target: 'supervisor' },
        { source: 'supervisor', target: 'scoring', label: 'done' },
        { source: 'scoring', target: 'ingest' },
      ],
    });
  }
}
