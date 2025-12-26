import type { FileMetadata } from '@/ports/IMetadataProvider';
import { createFileMetadata } from '@/test/fixtures/types';
import { describe, expect, it } from 'vitest';
import {
	findDominantTags,
	getTagCounts,
	groupNotesByDominantTag,
	normalizeTag,
	refineByTags,
} from '../refineByTags';
import { type ClusteringConfig, DEFAULT_CLUSTERING_CONFIG, createCluster } from '../types';

describe('refineByTags', () => {
	const config: ClusteringConfig = {
		...DEFAULT_CLUSTERING_CONFIG,
		minClusterSize: 2,
		dominantTagThreshold: 0.3,
	};

	function createMetadataMap(entries: FileMetadata[]): Map<string, FileMetadata> {
		return new Map(entries.map((m) => [m.path, m]));
	}

	describe('basic refinement', () => {
		it('should add dominant tags to clusters', () => {
			const clusters = [createCluster({ noteIds: ['a.md', 'b.md', 'c.md'], folderPath: 'react' })];

			const metadata = createMetadataMap([
				createFileMetadata('a.md', { tags: ['#react', '#frontend'] }),
				createFileMetadata('b.md', { tags: ['#react', '#hooks'] }),
				createFileMetadata('c.md', { tags: ['#react'] }),
			]);

			const result = refineByTags(clusters, metadata, config);

			expect(result).toHaveLength(1);
			expect(result[0].dominantTags).toContain('#react');
		});

		it('should handle clusters with no tags', () => {
			const clusters = [createCluster({ noteIds: ['a.md', 'b.md'], folderPath: 'misc' })];

			const metadata = createMetadataMap([
				createFileMetadata('a.md', { tags: [] }),
				createFileMetadata('b.md', { tags: [] }),
			]);

			const result = refineByTags(clusters, metadata, config);

			expect(result).toHaveLength(1);
			expect(result[0].dominantTags).toHaveLength(0);
		});

		it('should handle empty clusters array', () => {
			const result = refineByTags([], new Map(), config);
			expect(result).toHaveLength(0);
		});
	});

	describe('cluster splitting', () => {
		it('should split cluster when distinct tag groups exist', () => {
			const clusters = [
				createCluster({
					noteIds: ['r1.md', 'r2.md', 'g1.md', 'g2.md'],
					folderPath: 'sports',
				}),
			];

			const metadata = createMetadataMap([
				createFileMetadata('r1.md', { tags: ['#react'] }),
				createFileMetadata('r2.md', { tags: ['#react'] }),
				createFileMetadata('g1.md', { tags: ['#golf'] }),
				createFileMetadata('g2.md', { tags: ['#golf'] }),
			]);

			const result = refineByTags(clusters, metadata, config);

			expect(result.length).toBeGreaterThan(1);

			const reactCluster = result.find((c) => c.dominantTags.includes('#react'));
			const golfCluster = result.find((c) => c.dominantTags.includes('#golf'));

			expect(reactCluster?.noteIds).toHaveLength(2);
			expect(golfCluster?.noteIds).toHaveLength(2);
		});

		it('should not split if groups are too small', () => {
			const configLargeMin = { ...config, minClusterSize: 10 };

			const clusters = [createCluster({ noteIds: ['a.md', 'b.md', 'c.md'], folderPath: 'folder' })];

			const metadata = createMetadataMap([
				createFileMetadata('a.md', { tags: ['#tagA'] }),
				createFileMetadata('b.md', { tags: ['#tagB'] }),
				createFileMetadata('c.md', { tags: ['#tagC'] }),
			]);

			const result = refineByTags(clusters, metadata, configLargeMin);

			expect(result).toHaveLength(1);
		});

		it('should preserve folder path when splitting', () => {
			const clusters = [
				createCluster({
					noteIds: ['r1.md', 'r2.md', 'g1.md', 'g2.md'],
					folderPath: 'topics',
				}),
			];

			const metadata = createMetadataMap([
				createFileMetadata('r1.md', { tags: ['#react'] }),
				createFileMetadata('r2.md', { tags: ['#react'] }),
				createFileMetadata('g1.md', { tags: ['#golf'] }),
				createFileMetadata('g2.md', { tags: ['#golf'] }),
			]);

			const result = refineByTags(clusters, metadata, config);

			result.forEach((cluster) => {
				expect(cluster.folderPath).toBe('topics');
			});
		});
	});

	describe('orphan handling', () => {
		it('should create orphan cluster for notes without dominant tags when splitting', () => {
			const clusters = [
				createCluster({
					noteIds: ['r1.md', 'r2.md', 'g1.md', 'g2.md', 'other.md'],
					folderPath: 'folder',
				}),
			];

			// Two dominant groups + one orphan
			const metadata = createMetadataMap([
				createFileMetadata('r1.md', { tags: ['#react'] }),
				createFileMetadata('r2.md', { tags: ['#react'] }),
				createFileMetadata('g1.md', { tags: ['#golf'] }),
				createFileMetadata('g2.md', { tags: ['#golf'] }),
				createFileMetadata('other.md', { tags: ['#misc'] }),
			]);

			const result = refineByTags(clusters, metadata, config);

			// Should have split into 3 clusters: react, golf, and orphan
			expect(result.length).toBeGreaterThanOrEqual(3);

			const orphanCluster = result.find((c) => c.dominantTags.length === 0);
			expect(orphanCluster).toBeDefined();
			expect(orphanCluster?.noteIds).toContain('other.md');
		});

		it('should not create orphan cluster when there is only one significant group', () => {
			const clusters = [
				createCluster({
					noteIds: ['r1.md', 'r2.md', 'other.md'],
					folderPath: 'folder',
				}),
			];

			// Only one significant group (#react), other.md has #misc which isn't significant
			const metadata = createMetadataMap([
				createFileMetadata('r1.md', { tags: ['#react'] }),
				createFileMetadata('r2.md', { tags: ['#react'] }),
				createFileMetadata('other.md', { tags: ['#misc'] }),
			]);

			const result = refineByTags(clusters, metadata, config);

			// Should keep as single cluster with dominant tag #react
			expect(result).toHaveLength(1);
			expect(result[0].dominantTags).toContain('#react');
			expect(result[0].noteIds).toHaveLength(3);
		});
	});
});

describe('getTagCounts', () => {
	function createMetadataMap(entries: FileMetadata[]): Map<string, FileMetadata> {
		return new Map(entries.map((m) => [m.path, m]));
	}

	it('should count tag occurrences', () => {
		const metadata = createMetadataMap([
			createFileMetadata('a.md', { tags: ['#react', '#frontend'] }),
			createFileMetadata('b.md', { tags: ['#react'] }),
			createFileMetadata('c.md', { tags: ['#golf'] }),
		]);

		const counts = getTagCounts(['a.md', 'b.md', 'c.md'], metadata);

		expect(counts.get('#react')).toBe(2);
		expect(counts.get('#frontend')).toBe(1);
		expect(counts.get('#golf')).toBe(1);
	});

	it('should normalize tags', () => {
		const metadata = createMetadataMap([
			createFileMetadata('a.md', { tags: ['#React'] }),
			createFileMetadata('b.md', { tags: ['react'] }),
		]);

		const counts = getTagCounts(['a.md', 'b.md'], metadata);

		expect(counts.get('#react')).toBe(2);
	});

	it('should handle missing metadata', () => {
		const metadata = new Map<string, FileMetadata>();

		const counts = getTagCounts(['a.md', 'b.md'], metadata);

		expect(counts.size).toBe(0);
	});
});

describe('findDominantTags', () => {
	const config = { ...DEFAULT_CLUSTERING_CONFIG, dominantTagThreshold: 0.5 };

	it('should find tags above threshold', () => {
		const counts = new Map([
			['#react', 8],
			['#hooks', 3],
			['#misc', 1],
		]);

		const dominant = findDominantTags(counts, 10, config);

		expect(dominant).toContain('#react');
		expect(dominant).not.toContain('#hooks');
		expect(dominant).not.toContain('#misc');
	});

	it('should sort by frequency', () => {
		const counts = new Map([
			['#react', 8],
			['#frontend', 6],
		]);

		const dominant = findDominantTags(counts, 10, config);

		expect(dominant[0]).toBe('#react');
	});

	it('should handle zero notes', () => {
		const counts = new Map<string, number>();
		const dominant = findDominantTags(counts, 0, config);
		expect(dominant).toHaveLength(0);
	});
});

describe('groupNotesByDominantTag', () => {
	function createMetadataMap(entries: FileMetadata[]): Map<string, FileMetadata> {
		return new Map(entries.map((m) => [m.path, m]));
	}

	it('should group notes by their dominant tag', () => {
		const metadata = createMetadataMap([
			createFileMetadata('a.md', { tags: ['#react', '#frontend'] }),
			createFileMetadata('b.md', { tags: ['#react'] }),
			createFileMetadata('c.md', { tags: ['#golf'] }),
		]);

		const groups = groupNotesByDominantTag(['a.md', 'b.md', 'c.md'], ['#react', '#golf'], metadata);

		expect(groups.get('#react')).toEqual(['a.md', 'b.md']);
		expect(groups.get('#golf')).toEqual(['c.md']);
	});

	it('should assign note to first matching dominant tag', () => {
		const metadata = createMetadataMap([createFileMetadata('a.md', { tags: ['#react', '#golf'] })]);

		// #react is first in dominantTags, so it should win
		const groups = groupNotesByDominantTag(['a.md'], ['#react', '#golf'], metadata);

		expect(groups.get('#react')).toEqual(['a.md']);
		expect(groups.get('#golf')).toEqual([]);
	});
});

describe('normalizeTag', () => {
	it('should add # prefix if missing', () => {
		expect(normalizeTag('react')).toBe('#react');
	});

	it('should keep # prefix if present', () => {
		expect(normalizeTag('#react')).toBe('#react');
	});

	it('should lowercase tags', () => {
		expect(normalizeTag('#React')).toBe('#react');
		expect(normalizeTag('REACT')).toBe('#react');
	});

	it('should trim whitespace', () => {
		expect(normalizeTag('  #react  ')).toBe('#react');
	});
});
