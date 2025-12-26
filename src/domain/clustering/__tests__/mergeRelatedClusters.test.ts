import type { ResolvedLinks } from '@/ports/IMetadataProvider';
import { describe, expect, it } from 'vitest';
import {
	areSimilarSize,
	findCommonFolderPath,
	mergeRelatedClusters,
	mergeTwoClusters,
} from '../mergeRelatedClusters';
import { type ClusteringConfig, DEFAULT_CLUSTERING_CONFIG, createCluster } from '../types';

describe('mergeRelatedClusters', () => {
	const config: ClusteringConfig = {
		...DEFAULT_CLUSTERING_CONFIG,
		mergeOverlapThreshold: 0.3,
	};

	it('should merge clusters with high link overlap', () => {
		const clusters = [
			createCluster({ noteIds: ['a1.md', 'a2.md'], folderPath: 'a' }),
			createCluster({ noteIds: ['b1.md', 'b2.md'], folderPath: 'b' }),
		];

		// 50% overlap (2 notes linking / 4 total)
		const resolvedLinks: ResolvedLinks = {
			'a1.md': { 'b1.md': 1 },
			'b1.md': { 'a1.md': 1 },
		};

		const result = mergeRelatedClusters(clusters, resolvedLinks, config);

		expect(result).toHaveLength(1);
		expect(result[0].noteIds).toHaveLength(4);
	});

	it('should not merge clusters with low link overlap', () => {
		const clusters = [
			createCluster({ noteIds: ['a1.md', 'a2.md', 'a3.md', 'a4.md'] }),
			createCluster({ noteIds: ['b1.md', 'b2.md', 'b3.md', 'b4.md'] }),
		];

		// Only 1/8 = 12.5% overlap
		const resolvedLinks: ResolvedLinks = {
			'a1.md': { 'b1.md': 1 },
		};

		const result = mergeRelatedClusters(clusters, resolvedLinks, config);

		expect(result).toHaveLength(2);
	});

	it('should not merge clusters with very different sizes', () => {
		const clusters = [
			createCluster({ noteIds: ['a.md'] }),
			createCluster({ noteIds: ['b1.md', 'b2.md', 'b3.md', 'b4.md'] }),
		];

		// Even with high overlap, size difference is too large
		const resolvedLinks: ResolvedLinks = {
			'a.md': { 'b1.md': 1, 'b2.md': 1 },
			'b1.md': { 'a.md': 1 },
		};

		const result = mergeRelatedClusters(clusters, resolvedLinks, config);

		expect(result).toHaveLength(2);
	});

	it('should handle single cluster', () => {
		const clusters = [createCluster({ noteIds: ['a.md', 'b.md'] })];
		const result = mergeRelatedClusters(clusters, {}, config);
		expect(result).toHaveLength(1);
	});

	it('should handle empty clusters array', () => {
		const result = mergeRelatedClusters([], {}, config);
		expect(result).toHaveLength(0);
	});

	it('should respect maxClusterSize', () => {
		const configSmallMax: ClusteringConfig = { ...config, maxClusterSize: 3 };

		const clusters = [
			createCluster({ noteIds: ['a1.md', 'a2.md'] }),
			createCluster({ noteIds: ['b1.md', 'b2.md'] }),
		];

		const resolvedLinks: ResolvedLinks = {
			'a1.md': { 'b1.md': 1 },
			'b1.md': { 'a1.md': 1 },
		};

		const result = mergeRelatedClusters(clusters, resolvedLinks, configSmallMax);

		// Merged would have 4 notes > maxClusterSize of 3
		expect(result).toHaveLength(2);
	});

	it('should merge greedily by highest overlap first', () => {
		const clusters = [
			createCluster({ noteIds: ['a1.md', 'a2.md'] }),
			createCluster({ noteIds: ['b1.md', 'b2.md'] }),
			createCluster({ noteIds: ['c1.md', 'c2.md'] }),
		];

		// A and B have higher overlap than A and C
		const resolvedLinks: ResolvedLinks = {
			'a1.md': { 'b1.md': 1, 'c1.md': 1 },
			'a2.md': { 'b2.md': 1 },
			'b1.md': { 'a1.md': 1 },
			'b2.md': { 'a2.md': 1 },
		};

		const result = mergeRelatedClusters(clusters, resolvedLinks, config);

		// Should merge A and B (higher overlap), leave C separate
		expect(result).toHaveLength(2);
		expect(result.some((c) => c.noteIds.length === 4)).toBe(true);
		expect(result.some((c) => c.noteIds.length === 2)).toBe(true);
	});
});

describe('areSimilarSize', () => {
	it('should return true for same size clusters', () => {
		const a = createCluster({ noteIds: ['1.md', '2.md'] });
		const b = createCluster({ noteIds: ['3.md', '4.md'] });
		expect(areSimilarSize(a, b)).toBe(true);
	});

	it('should return true for 2x size difference', () => {
		const a = createCluster({ noteIds: ['1.md', '2.md'] });
		const b = createCluster({ noteIds: ['3.md', '4.md', '5.md', '6.md'] });
		expect(areSimilarSize(a, b)).toBe(true);
	});

	it('should return true for exactly 3x difference', () => {
		const a = createCluster({ noteIds: ['1.md'] });
		const b = createCluster({ noteIds: ['2.md', '3.md', '4.md'] });
		expect(areSimilarSize(a, b)).toBe(true);
	});

	it('should return false for more than 3x difference', () => {
		const a = createCluster({ noteIds: ['1.md'] });
		const b = createCluster({ noteIds: ['2.md', '3.md', '4.md', '5.md'] });
		expect(areSimilarSize(a, b)).toBe(false);
	});
});

describe('mergeTwoClusters', () => {
	it('should combine note IDs', () => {
		const a = createCluster({ noteIds: ['a.md', 'b.md'] });
		const b = createCluster({ noteIds: ['c.md', 'd.md'] });

		const result = mergeTwoClusters(a, b);

		expect(result.noteIds).toHaveLength(4);
		expect(result.noteIds).toContain('a.md');
		expect(result.noteIds).toContain('c.md');
	});

	it('should deduplicate note IDs', () => {
		const a = createCluster({ noteIds: ['a.md', 'shared.md'] });
		const b = createCluster({ noteIds: ['shared.md', 'b.md'] });

		const result = mergeTwoClusters(a, b);

		expect(result.noteIds).toHaveLength(3);
	});

	it('should combine dominant tags', () => {
		const a = createCluster({ noteIds: ['a.md'], dominantTags: ['#react'] });
		const b = createCluster({ noteIds: ['b.md'], dominantTags: ['#hooks'] });

		const result = mergeTwoClusters(a, b);

		expect(result.dominantTags).toContain('#react');
		expect(result.dominantTags).toContain('#hooks');
	});

	it('should combine candidate names', () => {
		const a = createCluster({ noteIds: ['a.md'], candidateNames: ['React'] });
		const b = createCluster({ noteIds: ['b.md'], candidateNames: ['Hooks'] });

		const result = mergeTwoClusters(a, b);

		expect(result.candidateNames).toContain('React');
		expect(result.candidateNames).toContain('Hooks');
	});

	it('should find common folder path', () => {
		const a = createCluster({ noteIds: ['a.md'], folderPath: 'code/react' });
		const b = createCluster({ noteIds: ['b.md'], folderPath: 'code/hooks' });

		const result = mergeTwoClusters(a, b);

		expect(result.folderPath).toBe('code');
	});

	it('should average link density weighted by size', () => {
		const a = createCluster({ noteIds: ['a1.md', 'a2.md'], internalLinkDensity: 0.8 });
		const b = createCluster({ noteIds: ['b1.md', 'b2.md'], internalLinkDensity: 0.4 });

		const result = mergeTwoClusters(a, b);

		// (0.8 * 2 + 0.4 * 2) / 4 = 0.6
		expect(result.internalLinkDensity).toBeCloseTo(0.6, 2);
	});
});

describe('findCommonFolderPath', () => {
	it('should return same path if identical', () => {
		expect(findCommonFolderPath('a/b/c', 'a/b/c')).toBe('a/b/c');
	});

	it('should return common prefix', () => {
		expect(findCommonFolderPath('a/b/c', 'a/b/d')).toBe('a/b');
		expect(findCommonFolderPath('a/b/c', 'a/x/y')).toBe('a');
	});

	it('should return empty string for no common path', () => {
		expect(findCommonFolderPath('a/b', 'x/y')).toBe('');
	});

	it('should handle empty paths', () => {
		expect(findCommonFolderPath('', 'a/b')).toBe('');
		expect(findCommonFolderPath('a/b', '')).toBe('');
		expect(findCommonFolderPath('', '')).toBe('');
	});
});
