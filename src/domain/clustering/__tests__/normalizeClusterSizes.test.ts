import { describe, it, expect } from 'vitest';
import {
  normalizeClusterSizes,
  splitLargeCluster,
  mergeSmallClusters,
} from '../normalizeClusterSizes';
import { createCluster, DEFAULT_CLUSTERING_CONFIG, type ClusteringConfig } from '../types';
import type { ResolvedLinks } from '@/ports/IMetadataProvider';

describe('normalizeClusterSizes', () => {
  const config: ClusteringConfig = {
    ...DEFAULT_CLUSTERING_CONFIG,
    minClusterSize: 3,
    maxClusterSize: 10,
  };

  it('should split oversized clusters', () => {
    const clusters = [
      createCluster({
        noteIds: Array.from({ length: 15 }, (_, i) => `note${i}.md`),
        folderPath: 'large',
      }),
    ];

    const result = normalizeClusterSizes(clusters, {}, config);

    expect(result.length).toBeGreaterThan(1);
    result.forEach((c) => {
      expect(c.noteIds.length).toBeLessThanOrEqual(config.maxClusterSize);
    });
  });

  it('should merge undersized clusters', () => {
    const clusters = [
      createCluster({
        noteIds: ['a.md', 'b.md'],
        folderPath: 'folder',
      }),
      createCluster({
        noteIds: ['c.md', 'd.md'],
        folderPath: 'folder',
      }),
    ];

    const result = normalizeClusterSizes(clusters, {}, config);

    // Both are too small (< 3), should be merged
    expect(result).toHaveLength(1);
    expect(result[0].noteIds.length).toBe(4);
  });

  it('should keep properly sized clusters unchanged', () => {
    const clusters = [
      createCluster({
        noteIds: ['a.md', 'b.md', 'c.md', 'd.md', 'e.md'],
        folderPath: 'folder',
      }),
    ];

    const result = normalizeClusterSizes(clusters, {}, config);

    expect(result).toHaveLength(1);
    expect(result[0].noteIds).toHaveLength(5);
  });

  it('should handle empty input', () => {
    const result = normalizeClusterSizes([], {}, config);
    expect(result).toHaveLength(0);
  });
});

describe('splitLargeCluster', () => {
  const config: ClusteringConfig = {
    ...DEFAULT_CLUSTERING_CONFIG,
    minClusterSize: 3,
    maxClusterSize: 10,
  };

  it('should split cluster into smaller chunks', () => {
    const cluster = createCluster({
      noteIds: Array.from({ length: 20 }, (_, i) => `note${i}.md`),
      folderPath: 'test',
      dominantTags: ['#tag1'],
    });

    const result = splitLargeCluster(cluster, {}, config);

    expect(result.length).toBeGreaterThan(1);
    result.forEach((c) => {
      expect(c.noteIds.length).toBeLessThanOrEqual(config.maxClusterSize);
    });
  });

  it('should preserve folder path and tags', () => {
    const cluster = createCluster({
      noteIds: Array.from({ length: 15 }, (_, i) => `note${i}.md`),
      folderPath: 'original/path',
      dominantTags: ['#react', '#hooks'],
    });

    const result = splitLargeCluster(cluster, {}, config);

    result.forEach((c) => {
      expect(c.folderPath).toBe('original/path');
      expect(c.dominantTags).toContain('#react');
    });
  });

  it('should add part numbers to candidate names', () => {
    const cluster = createCluster({
      noteIds: Array.from({ length: 15 }, (_, i) => `note${i}.md`),
      folderPath: 'test',
      candidateNames: ['Original'],
    });

    const result = splitLargeCluster(cluster, {}, config);

    expect(result.some((c) => c.candidateNames.includes('Part 1'))).toBe(true);
    expect(result.some((c) => c.candidateNames.includes('Part 2'))).toBe(true);
  });

  it('should not split cluster at or below max size', () => {
    const cluster = createCluster({
      noteIds: Array.from({ length: 10 }, (_, i) => `note${i}.md`),
      folderPath: 'test',
    });

    const result = splitLargeCluster(cluster, {}, config);

    expect(result).toHaveLength(1);
  });

  it('should keep connected notes together when splitting', () => {
    const cluster = createCluster({
      noteIds: ['a.md', 'b.md', 'c.md', 'd.md', 'e.md', 'f.md', 'g.md', 'h.md', 'i.md', 'j.md', 'k.md', 'l.md'],
      folderPath: 'test',
    });

    // a links to b, b links to c (they should stay together)
    const resolvedLinks: ResolvedLinks = {
      'a.md': { 'b.md': 1, 'c.md': 1 },
      'b.md': { 'c.md': 1 },
    };

    const result = splitLargeCluster(cluster, resolvedLinks, config);

    // Notes a, b, c should be in the same cluster due to connectivity sorting
    const clusterWithA = result.find((c) => c.noteIds.includes('a.md'));
    expect(clusterWithA?.noteIds.includes('b.md')).toBe(true);
    expect(clusterWithA?.noteIds.includes('c.md')).toBe(true);
  });
});

describe('mergeSmallClusters', () => {
  const config: ClusteringConfig = {
    ...DEFAULT_CLUSTERING_CONFIG,
    minClusterSize: 5,
    maxClusterSize: 20,
  };

  it('should merge small clusters with same folder path', () => {
    const clusters = [
      createCluster({
        noteIds: ['a.md', 'b.md'],
        folderPath: 'folder',
      }),
      createCluster({
        noteIds: ['c.md', 'd.md'],
        folderPath: 'folder',
      }),
    ];

    const result = mergeSmallClusters(clusters, config);

    expect(result).toHaveLength(1);
    expect(result[0].noteIds).toHaveLength(4);
  });

  it('should merge small clusters with overlapping tags', () => {
    const clusters = [
      createCluster({
        noteIds: ['a.md', 'b.md'],
        folderPath: 'folder1',
        dominantTags: ['#react', '#frontend'],
      }),
      createCluster({
        noteIds: ['c.md', 'd.md'],
        folderPath: 'folder2',
        dominantTags: ['#react', '#hooks'],
      }),
    ];

    const result = mergeSmallClusters(clusters, config);

    expect(result).toHaveLength(1);
    expect(result[0].dominantTags).toContain('#react');
  });

  it('should not merge if result would exceed max size', () => {
    const configSmall = { ...config, maxClusterSize: 3 };

    const clusters = [
      createCluster({
        noteIds: ['a.md', 'b.md'],
        folderPath: 'folder',
      }),
      createCluster({
        noteIds: ['c.md', 'd.md'],
        folderPath: 'folder',
      }),
    ];

    const result = mergeSmallClusters(clusters, configSmall);

    // 2 + 2 = 4 > maxSize of 3, so should not merge
    expect(result).toHaveLength(2);
  });

  it('should not merge dissimilar clusters', () => {
    const clusters = [
      createCluster({
        noteIds: ['a.md', 'b.md'],
        folderPath: 'react',
        dominantTags: ['#react'],
      }),
      createCluster({
        noteIds: ['c.md', 'd.md'],
        folderPath: 'python',
        dominantTags: ['#python'],
      }),
    ];

    const result = mergeSmallClusters(clusters, config);

    // Different folders and no overlapping tags
    expect(result).toHaveLength(2);
  });

  it('should keep regular-sized clusters unchanged', () => {
    const clusters = [
      createCluster({
        noteIds: ['a.md', 'b.md', 'c.md', 'd.md', 'e.md', 'f.md'],
        folderPath: 'folder',
      }),
    ];

    const result = mergeSmallClusters(clusters, config);

    expect(result).toHaveLength(1);
    expect(result[0].noteIds).toHaveLength(6);
  });

  it('should handle empty input', () => {
    const result = mergeSmallClusters([], config);
    expect(result).toHaveLength(0);
  });

  it('should handle single small cluster', () => {
    const clusters = [
      createCluster({
        noteIds: ['a.md', 'b.md'],
        folderPath: 'folder',
      }),
    ];

    const result = mergeSmallClusters(clusters, config);

    expect(result).toHaveLength(1);
  });
});
