/**
 * Cosine similarity calculation for embedding vectors
 *
 * Cosine similarity measures the cosine of the angle between two vectors,
 * producing a value between -1 and 1, where 1 indicates identical direction.
 *
 * Formula: cos(θ) = (A · B) / (||A|| * ||B||)
 * where:
 * - A · B is the dot product
 * - ||A|| and ||B|| are the magnitudes (L2 norms)
 */

/**
 * Calculate cosine similarity between two embedding vectors
 *
 * @param a - First embedding vector (1024 dimensions for voyage-3)
 * @param b - Second embedding vector (1024 dimensions for voyage-3)
 * @returns Similarity score between -1 and 1 (1 = most similar)
 *
 * @throws {Error} If vectors have different lengths or are empty
 *
 * @example
 * ```typescript
 * const embedding1 = [0.1, 0.2, 0.3, ...]; // 1024 dimensions
 * const embedding2 = [0.15, 0.25, 0.28, ...]; // 1024 dimensions
 * const similarity = cosineSimilarity(embedding1, embedding2);
 * console.log(similarity); // 0.95 (highly similar)
 * ```
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  // Validate inputs
  if (a.length === 0 || b.length === 0) {
    throw new Error('Cannot calculate similarity for empty vectors');
  }

  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: a has ${a.length} dimensions, b has ${b.length} dimensions`
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Compute dot product and norms in a single pass for efficiency
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i]!;
    const bVal = b[i]!;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }

  // Compute magnitudes
  const magnitudeA = Math.sqrt(normA);
  const magnitudeB = Math.sqrt(normB);

  // Avoid division by zero
  if (magnitudeA === 0 || magnitudeB === 0) {
    throw new Error('Cannot calculate similarity for zero vectors');
  }

  // Return cosine similarity
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Calculate cosine similarities between a query vector and multiple document vectors
 * Returns results sorted by similarity (descending)
 *
 * @param query - Query embedding vector
 * @param documents - Array of document embedding vectors with metadata
 * @returns Array of results sorted by similarity score (highest first)
 *
 * @example
 * ```typescript
 * const queryEmbedding = [0.1, 0.2, ...];
 * const documents = [
 *   { id: '1', embedding: [0.15, 0.25, ...], title: 'Ocean Waves' },
 *   { id: '2', embedding: [0.05, 0.1, ...], title: 'Forest Sounds' }
 * ];
 * const results = batchCosineSimilarity(queryEmbedding, documents);
 * // [{ id: '1', title: 'Ocean Waves', score: 0.95 }, ...]
 * ```
 */
export function batchCosineSimilarity<T extends { embedding: number[] }>(
  query: number[],
  documents: T[]
): Array<T & { score: number }> {
  return documents
    .map(doc => ({
      ...doc,
      score: cosineSimilarity(query, doc.embedding)
    }))
    .sort((a, b) => b.score - a.score);
}
