import { describe, expect, it } from 'vitest';
import {
  cosineSimilarity,
  findTopKSimilar,
  relevanceScoreToSimilarity,
  similarityToRelevanceScore,
} from '../similarity';

describe('cosineSimilarity', () => {
  it('returns 1 for identical unit vectors', () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1);
  });

  it('computes correct similarity for normalized vectors', () => {
    // Unit normalized vectors
    const a = [0.6, 0.8, 0]; // magnitude = 1
    const b = [0.8, 0.6, 0]; // magnitude = 1
    // Dot product = 0.6*0.8 + 0.8*0.6 = 0.48 + 0.48 = 0.96
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.96);
  });

  it('throws error for vectors of different dimensions', () => {
    const a = [1, 0, 0];
    const b = [1, 0];
    expect(() => cosineSimilarity(a, b)).toThrow('Vector dimension mismatch: 3 vs 2');
  });

  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('handles high-dimensional vectors', () => {
    // 512-dimensional vectors (like Voyage embeddings)
    const a = new Array(512).fill(0);
    const b = new Array(512).fill(0);
    a[0] = 1;
    b[0] = 1;
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });
});

describe('findTopKSimilar', () => {
  it('returns empty array for empty embeddings', () => {
    const query = [1, 0, 0];
    const noteEmbeddings = new Map<string, number[]>();
    expect(findTopKSimilar(query, noteEmbeddings, 10)).toEqual([]);
  });

  it('returns empty array for k=0', () => {
    const query = [1, 0, 0];
    const noteEmbeddings = new Map([['note1.md', [1, 0, 0]]]);
    expect(findTopKSimilar(query, noteEmbeddings, 0)).toEqual([]);
  });

  it('returns all results when k is larger than available notes', () => {
    const query = [1, 0, 0];
    const noteEmbeddings = new Map([
      ['note1.md', [1, 0, 0]],
      ['note2.md', [0, 1, 0]],
    ]);
    const results = findTopKSimilar(query, noteEmbeddings, 10);
    expect(results).toHaveLength(2);
  });

  it('returns top-k results sorted by similarity', () => {
    const query = [1, 0, 0];
    const noteEmbeddings = new Map([
      ['similar.md', [0.9, 0.1, 0]], // most similar
      ['medium.md', [0.5, 0.5, 0]], // medium
      ['different.md', [0, 1, 0]], // orthogonal
      ['opposite.md', [-1, 0, 0]], // opposite
    ]);

    const results = findTopKSimilar(query, noteEmbeddings, 2);

    expect(results).toHaveLength(2);
    expect(results[0].notePath).toBe('similar.md');
    expect(results[1].notePath).toBe('medium.md');
    expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
  });

  it('includes similarity scores in results', () => {
    const query = [1, 0, 0];
    const noteEmbeddings = new Map([['note.md', [1, 0, 0]]]);

    const results = findTopKSimilar(query, noteEmbeddings, 1);

    expect(results[0]).toEqual({
      notePath: 'note.md',
      similarity: 1,
    });
  });

  it('handles negative similarities', () => {
    const query = [1, 0, 0];
    const noteEmbeddings = new Map([
      ['opposite1.md', [-0.9, 0.1, 0]],
      ['opposite2.md', [-0.8, 0.2, 0]],
    ]);

    const results = findTopKSimilar(query, noteEmbeddings, 2);

    // Less negative is more similar
    expect(results[0].notePath).toBe('opposite2.md');
    expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
  });
});

describe('similarityToRelevanceScore', () => {
  it('converts -1 to 0', () => {
    expect(similarityToRelevanceScore(-1)).toBe(0);
  });

  it('converts 0 to 50', () => {
    expect(similarityToRelevanceScore(0)).toBe(50);
  });

  it('converts 1 to 100', () => {
    expect(similarityToRelevanceScore(1)).toBe(100);
  });

  it('converts 0.5 to 75', () => {
    expect(similarityToRelevanceScore(0.5)).toBe(75);
  });

  it('converts -0.5 to 25', () => {
    expect(similarityToRelevanceScore(-0.5)).toBe(25);
  });

  it('clamps values below -1', () => {
    expect(similarityToRelevanceScore(-2)).toBe(0);
  });

  it('clamps values above 1', () => {
    expect(similarityToRelevanceScore(2)).toBe(100);
  });

  it('rounds to nearest integer', () => {
    // 0.33 -> ((0.33 + 1) / 2) * 100 = 66.5 -> 67
    expect(similarityToRelevanceScore(0.33)).toBe(67);
  });
});

describe('relevanceScoreToSimilarity', () => {
  it('converts 0 to -1', () => {
    expect(relevanceScoreToSimilarity(0)).toBeCloseTo(-1);
  });

  it('converts 50 to 0', () => {
    expect(relevanceScoreToSimilarity(50)).toBeCloseTo(0);
  });

  it('converts 100 to 1', () => {
    expect(relevanceScoreToSimilarity(100)).toBeCloseTo(1);
  });

  it('converts 75 to 0.5', () => {
    expect(relevanceScoreToSimilarity(75)).toBeCloseTo(0.5);
  });

  it('converts 25 to -0.5', () => {
    expect(relevanceScoreToSimilarity(25)).toBeCloseTo(-0.5);
  });

  it('clamps values below 0', () => {
    expect(relevanceScoreToSimilarity(-10)).toBeCloseTo(-1);
  });

  it('clamps values above 100', () => {
    expect(relevanceScoreToSimilarity(110)).toBeCloseTo(1);
  });
});

describe('round-trip conversion', () => {
  it('similarity -> score -> similarity preserves value', () => {
    // Note: some precision loss due to rounding
    const original = 0.75;
    const score = similarityToRelevanceScore(original);
    const roundTrip = relevanceScoreToSimilarity(score);
    // Rounding means we get 0.76 instead of 0.75
    expect(roundTrip).toBeCloseTo(original, 1);
  });

  it('score -> similarity -> score preserves value for integers', () => {
    const original = 80;
    const similarity = relevanceScoreToSimilarity(original);
    const roundTrip = similarityToRelevanceScore(similarity);
    expect(roundTrip).toBe(original);
  });
});
