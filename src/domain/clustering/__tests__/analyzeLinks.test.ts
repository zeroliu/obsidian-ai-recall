import { describe, it, expect } from 'vitest';
import {
  analyzeLinks,
  calculateLinkDensity,
  countInterClusterLinks,
  calculateLinkOverlap,
} from '../analyzeLinks';
import { createCluster, DEFAULT_CLUSTERING_CONFIG } from '../types';
import type { ResolvedLinks } from '@/ports/IMetadataProvider';

describe('analyzeLinks', () => {
  const config = DEFAULT_CLUSTERING_CONFIG;

  it('should update link density for each cluster', () => {
    const clusters = [
      createCluster({ noteIds: ['a.md', 'b.md'] }),
      createCluster({ noteIds: ['c.md', 'd.md'] }),
    ];

    const resolvedLinks: ResolvedLinks = {
      'a.md': { 'b.md': 1 },
      'b.md': { 'a.md': 1 },
      'c.md': {},
    };

    const result = analyzeLinks(clusters, resolvedLinks, config);

    expect(result[0].internalLinkDensity).toBeGreaterThan(0);
    expect(result[1].internalLinkDensity).toBe(0);
  });

  it('should handle empty clusters array', () => {
    const result = analyzeLinks([], {}, config);
    expect(result).toHaveLength(0);
  });
});

describe('calculateLinkDensity', () => {
  const config = { ...DEFAULT_CLUSTERING_CONFIG, sampleSize: 100 };

  it('should calculate density for fully connected cluster', () => {
    const noteIds = ['a.md', 'b.md', 'c.md'];
    const resolvedLinks: ResolvedLinks = {
      'a.md': { 'b.md': 1, 'c.md': 1 },
      'b.md': { 'a.md': 1, 'c.md': 1 },
      'c.md': { 'a.md': 1, 'b.md': 1 },
    };

    const density = calculateLinkDensity(noteIds, resolvedLinks, config);

    // 6 links / 6 possible = 1.0
    expect(density).toBe(1);
  });

  it('should calculate density for partially connected cluster', () => {
    const noteIds = ['a.md', 'b.md', 'c.md'];
    const resolvedLinks: ResolvedLinks = {
      'a.md': { 'b.md': 1 },
      'b.md': {},
      'c.md': {},
    };

    const density = calculateLinkDensity(noteIds, resolvedLinks, config);

    // 1 link / 6 possible ≈ 0.167
    expect(density).toBeCloseTo(1 / 6, 2);
  });

  it('should return 0 for cluster with no links', () => {
    const noteIds = ['a.md', 'b.md', 'c.md'];
    const resolvedLinks: ResolvedLinks = {};

    const density = calculateLinkDensity(noteIds, resolvedLinks, config);

    expect(density).toBe(0);
  });

  it('should return 0 for single-note cluster', () => {
    const noteIds = ['a.md'];
    const resolvedLinks: ResolvedLinks = { 'a.md': { 'b.md': 1 } };

    const density = calculateLinkDensity(noteIds, resolvedLinks, config);

    expect(density).toBe(0);
  });

  it('should return 0 for empty cluster', () => {
    const density = calculateLinkDensity([], {}, config);
    expect(density).toBe(0);
  });

  it('should ignore external links', () => {
    const noteIds = ['a.md', 'b.md'];
    const resolvedLinks: ResolvedLinks = {
      'a.md': { 'external.md': 5 }, // Link to file not in cluster
    };

    const density = calculateLinkDensity(noteIds, resolvedLinks, config);

    expect(density).toBe(0);
  });

  it('should handle links with multiple counts', () => {
    const noteIds = ['a.md', 'b.md'];
    const resolvedLinks: ResolvedLinks = {
      'a.md': { 'b.md': 3 }, // 3 links from a to b
    };

    const density = calculateLinkDensity(noteIds, resolvedLinks, config);

    // 3 links / 2 possible = 1.5, capped at 1
    expect(density).toBe(1);
  });
});

describe('countInterClusterLinks', () => {
  it('should count notes that link to other cluster', () => {
    const clusterA = createCluster({ noteIds: ['a1.md', 'a2.md', 'a3.md'] });
    const clusterB = createCluster({ noteIds: ['b1.md', 'b2.md'] });

    const resolvedLinks: ResolvedLinks = {
      'a1.md': { 'b1.md': 1 },
      'a2.md': { 'b2.md': 1 },
      'a3.md': {},
    };

    const count = countInterClusterLinks(clusterA, clusterB, resolvedLinks);

    expect(count).toBe(2); // a1 and a2 link to cluster B
  });

  it('should count each source only once', () => {
    const clusterA = createCluster({ noteIds: ['a1.md'] });
    const clusterB = createCluster({ noteIds: ['b1.md', 'b2.md'] });

    const resolvedLinks: ResolvedLinks = {
      'a1.md': { 'b1.md': 1, 'b2.md': 1 }, // Links to both b1 and b2
    };

    const count = countInterClusterLinks(clusterA, clusterB, resolvedLinks);

    expect(count).toBe(1); // a1 counts once even though it links to 2 notes
  });

  it('should return 0 for no inter-cluster links', () => {
    const clusterA = createCluster({ noteIds: ['a1.md', 'a2.md'] });
    const clusterB = createCluster({ noteIds: ['b1.md', 'b2.md'] });

    const resolvedLinks: ResolvedLinks = {
      'a1.md': { 'a2.md': 1 }, // Internal link only
    };

    const count = countInterClusterLinks(clusterA, clusterB, resolvedLinks);

    expect(count).toBe(0);
  });
});

describe('calculateLinkOverlap', () => {
  it('should calculate bidirectional overlap', () => {
    const clusterA = createCluster({ noteIds: ['a1.md', 'a2.md'] });
    const clusterB = createCluster({ noteIds: ['b1.md', 'b2.md'] });

    const resolvedLinks: ResolvedLinks = {
      'a1.md': { 'b1.md': 1 },
      'b1.md': { 'a1.md': 1 },
    };

    const overlap = calculateLinkOverlap(clusterA, clusterB, resolvedLinks);

    // 2 notes linking / 4 total notes = 0.5
    expect(overlap).toBe(0.5);
  });

  it('should return 0 for unrelated clusters', () => {
    const clusterA = createCluster({ noteIds: ['a1.md'] });
    const clusterB = createCluster({ noteIds: ['b1.md'] });

    const resolvedLinks: ResolvedLinks = {};

    const overlap = calculateLinkOverlap(clusterA, clusterB, resolvedLinks);

    expect(overlap).toBe(0);
  });

  it('should handle asymmetric links', () => {
    const clusterA = createCluster({ noteIds: ['a1.md', 'a2.md'] });
    const clusterB = createCluster({ noteIds: ['b1.md', 'b2.md'] });

    const resolvedLinks: ResolvedLinks = {
      'a1.md': { 'b1.md': 1 },
      'a2.md': { 'b2.md': 1 },
      // No links from B to A
    };

    const overlap = calculateLinkOverlap(clusterA, clusterB, resolvedLinks);

    // 2 notes linking / 4 total notes = 0.5
    expect(overlap).toBe(0.5);
  });
});
