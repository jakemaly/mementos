import { FeatureExtractionPipeline, pipeline } from '@huggingface/transformers';

let extractorInstance: FeatureExtractionPipeline | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorInstance) {
    extractorInstance = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
    ) as FeatureExtractionPipeline;
  }
  return extractorInstance;
}

/**
 * Generates a 384-dimensional normalized vector embedding for the given text.
 * Uses the Xenova/all-MiniLM-L6-v2 model running locally.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const extractor = await getExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data) as number[];
  } catch (error) {
    console.error('Error generating local embedding:', error);
    throw error;
  }
}
