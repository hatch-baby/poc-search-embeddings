/**
 * VoyageAI embedding service client
 *
 * Uses VoyageAI's voyage-3 model for generating 1024-dimensional embeddings.
 * Supports both document and query input types for optimal search performance.
 *
 * API Documentation: https://docs.voyageai.com/
 */

import type { VoyageAIResponse, VoyageAIError, EmbeddingInputType } from '../types/index.js';

const VOYAGEAI_API_URL = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-3';
const DIMENSIONS = 1024;

/**
 * Generate an embedding vector for the given text using VoyageAI
 *
 * @param text - Text to generate embedding for (title, description, query, etc.)
 * @param inputType - Type of input: 'document' for storing, 'query' for searching
 * @returns Embedding vector (1024 dimensions)
 *
 * @throws {Error} If API key is missing or API request fails
 *
 * @example
 * ```typescript
 * // Generate document embedding for storage
 * const docEmbedding = await generateEmbedding(
 *   'Pacific Ocean Waves - Calming nature sounds',
 *   'document'
 * );
 *
 * // Generate query embedding for search
 * const queryEmbedding = await generateEmbedding(
 *   'ocean sounds',
 *   'query'
 * );
 * ```
 */
export async function generateEmbedding(
  text: string,
  inputType: EmbeddingInputType = 'document'
): Promise<number[]> {
  const apiKey = process.env.VOYAGEAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'VOYAGEAI_API_KEY environment variable is not set. ' +
      'Please add it to your .env file.'
    );
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Cannot generate embedding for empty text');
  }

  try {
    const response = await fetch(VOYAGEAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        input: [text],
        input_type: inputType
      })
    });

    if (!response.ok) {
      const errorData = await response.json() as VoyageAIError;
      throw new Error(
        `VoyageAI API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json() as VoyageAIResponse;

    if (!data.data || data.data.length === 0) {
      throw new Error('VoyageAI API returned no embedding data');
    }

    const embedding = data.data[0]!.embedding;

    // Validate embedding dimensions
    if (embedding.length !== DIMENSIONS) {
      console.warn(
        `Warning: Expected ${DIMENSIONS} dimensions but got ${embedding.length}`
      );
    }

    return embedding;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to generate embedding: ${String(error)}`);
  }
}

/**
 * Generate embeddings for multiple texts in a single API call (batch processing)
 *
 * @param texts - Array of texts to generate embeddings for
 * @param inputType - Type of input: 'document' or 'query'
 * @returns Array of embedding vectors
 *
 * @throws {Error} If API key is missing or API request fails
 *
 * @example
 * ```typescript
 * const texts = [
 *   'Ocean waves crashing',
 *   'Forest birds chirping',
 *   'Rain on window'
 * ];
 * const embeddings = await generateEmbeddings(texts, 'document');
 * // Returns: [[0.1, 0.2, ...], [0.15, 0.25, ...], [0.05, 0.1, ...]]
 * ```
 */
export async function generateEmbeddings(
  texts: string[],
  inputType: EmbeddingInputType = 'document'
): Promise<number[][]> {
  const apiKey = process.env.VOYAGEAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'VOYAGEAI_API_KEY environment variable is not set. ' +
      'Please add it to your .env file.'
    );
  }

  if (texts.length === 0) {
    return [];
  }

  // Filter out empty texts
  const validTexts = texts.filter(t => t && t.trim().length > 0);

  if (validTexts.length === 0) {
    throw new Error('Cannot generate embeddings for empty texts');
  }

  try {
    const response = await fetch(VOYAGEAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        input: validTexts,
        input_type: inputType
      })
    });

    if (!response.ok) {
      const errorData = await response.json() as VoyageAIError;
      throw new Error(
        `VoyageAI API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json() as VoyageAIResponse;

    if (!data.data || data.data.length !== validTexts.length) {
      throw new Error(
        `VoyageAI API returned ${data.data?.length || 0} embeddings for ${validTexts.length} texts`
      );
    }

    // Sort by index to ensure order matches input
    const sortedData = data.data.sort((a, b) => a.index - b.index);
    const embeddings = sortedData.map(item => item.embedding);

    // Validate dimensions
    for (const embedding of embeddings) {
      if (embedding.length !== DIMENSIONS) {
        console.warn(
          `Warning: Expected ${DIMENSIONS} dimensions but got ${embedding.length}`
        );
      }
    }

    return embeddings;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to generate embeddings: ${String(error)}`);
  }
}

/**
 * Estimate the cost of generating embeddings for given texts
 *
 * @param texts - Array of texts to estimate cost for
 * @returns Estimated cost in USD
 *
 * @example
 * ```typescript
 * const texts = ['Ocean waves', 'Forest sounds'];
 * const cost = estimateCost(texts);
 * console.log(`Estimated cost: $${cost.toFixed(4)}`);
 * ```
 */
export function estimateCost(texts: string[]): number {
  // VoyageAI pricing: ~$0.12 per 1M tokens
  // Rough estimate: 1 token ≈ 4 characters
  const COST_PER_MILLION_TOKENS = 0.12;
  const CHARS_PER_TOKEN = 4;

  const totalChars = texts.reduce((sum, text) => sum + text.length, 0);
  const estimatedTokens = totalChars / CHARS_PER_TOKEN;
  const cost = (estimatedTokens / 1_000_000) * COST_PER_MILLION_TOKENS;

  return cost;
}

/**
 * Get VoyageAI model information
 */
export function getModelInfo() {
  return {
    model: MODEL,
    dimensions: DIMENSIONS,
    costPerMillionTokens: 0.12,
    provider: 'VoyageAI'
  };
}
