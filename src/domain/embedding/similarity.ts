/**
 * Cosine similarity utilities for embedding-based note relevance.
 */

/**
 * Compute cosine similarity between two vectors.
 * Voyage embeddings are unit-normalized, so this equals dot product.
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Similarity score between -1 and 1
 * @throws Error if vectors have different dimensions
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  if (a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }

  return dotProduct;
}

/**
 * Result of a similarity search.
 */
export interface SimilarityResult {
  /** Path to the note */
  notePath: string;
  /** Similarity score between -1 and 1 */
  similarity: number;
}

/**
 * Find top-k most similar notes to a query embedding.
 *
 * @param queryEmbedding - The query embedding vector
 * @param noteEmbeddings - Map of note paths to their embeddings
 * @param k - Number of top results to return
 * @returns Array of similarity results sorted by similarity (highest first)
 */
export function findTopKSimilar(
  queryEmbedding: number[],
  noteEmbeddings: Map<string, number[]>,
  k: number,
): SimilarityResult[] {
  if (noteEmbeddings.size === 0 || k <= 0) {
    return [];
  }

  const results: SimilarityResult[] = [];

  for (const [notePath, embedding] of noteEmbeddings) {
    results.push({
      notePath,
      similarity: cosineSimilarity(queryEmbedding, embedding),
    });
  }

  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, Math.min(k, results.length));
}

/**
 * Convert similarity score (-1 to 1) to relevance score (0 to 100).
 * Uses linear mapping: -1 -> 0, 1 -> 100
 *
 * @param similarity - Similarity score between -1 and 1
 * @returns Relevance score between 0 and 100
 */
export function similarityToRelevanceScore(similarity: number): number {
  // Clamp similarity to valid range
  const clampedSimilarity = Math.max(-1, Math.min(1, similarity));
  return Math.round(((clampedSimilarity + 1) / 2) * 100);
}

/**
 * Convert relevance score (0 to 100) to similarity (-1 to 1).
 * Inverse of similarityToRelevanceScore.
 *
 * @param score - Relevance score between 0 and 100
 * @returns Similarity score between -1 and 1
 */
export function relevanceScoreToSimilarity(score: number): number {
  // Clamp score to valid range
  const clampedScore = Math.max(0, Math.min(100, score));
  return (clampedScore / 100) * 2 - 1;
}
