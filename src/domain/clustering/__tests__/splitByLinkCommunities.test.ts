import { describe, it, expect } from 'vitest';
import {
	splitByLinkCommunities,
	buildBidirectionalAdjacency,
	findConnectedComponents,
	findCoreNotes,
	assignNotesToCores,
} from '../splitByLinkCommunities';
import { createCluster, DEFAULT_CLUSTERING_CONFIG } from '../types';
import type { ResolvedLinks, FileMetadata } from '@/ports/IMetadataProvider';

describe('buildBidirectionalAdjacency', () => {
	it('should build empty adjacency for notes with no links', () => {
		const noteIds = ['a.md', 'b.md', 'c.md'];
		const resolvedLinks: ResolvedLinks = {};

		const adjacency = buildBidirectionalAdjacency(noteIds, resolvedLinks);

		expect(adjacency.get('a.md')?.size).toBe(0);
		expect(adjacency.get('b.md')?.size).toBe(0);
		expect(adjacency.get('c.md')?.size).toBe(0);
	});

	it('should build bidirectional adjacency for linked notes', () => {
		const noteIds = ['a.md', 'b.md', 'c.md'];
		const resolvedLinks: ResolvedLinks = {
			'a.md': { 'b.md': 1 },
			'b.md': { 'c.md': 1 },
		};

		const adjacency = buildBidirectionalAdjacency(noteIds, resolvedLinks);

		// a links to b, so both should have each other
		expect(adjacency.get('a.md')?.has('b.md')).toBe(true);
		expect(adjacency.get('b.md')?.has('a.md')).toBe(true);

		// b links to c, so both should have each other
		expect(adjacency.get('b.md')?.has('c.md')).toBe(true);
		expect(adjacency.get('c.md')?.has('b.md')).toBe(true);
	});

	it('should ignore links to notes outside the set', () => {
		const noteIds = ['a.md', 'b.md'];
		const resolvedLinks: ResolvedLinks = {
			'a.md': { 'b.md': 1, 'external.md': 1 },
		};

		const adjacency = buildBidirectionalAdjacency(noteIds, resolvedLinks);

		expect(adjacency.get('a.md')?.has('b.md')).toBe(true);
		expect(adjacency.get('a.md')?.has('external.md')).toBe(false);
	});
});

describe('findConnectedComponents', () => {
	it('should find single component for fully connected notes', () => {
		const noteIds = ['a.md', 'b.md', 'c.md'];
		const adjacency = new Map<string, Set<string>>([
			['a.md', new Set(['b.md'])],
			['b.md', new Set(['a.md', 'c.md'])],
			['c.md', new Set(['b.md'])],
		]);

		const components = findConnectedComponents(noteIds, adjacency);

		expect(components).toHaveLength(1);
		expect(components[0].sort()).toEqual(['a.md', 'b.md', 'c.md']);
	});

	it('should find multiple components for disconnected notes', () => {
		const noteIds = ['a.md', 'b.md', 'c.md', 'd.md'];
		const adjacency = new Map<string, Set<string>>([
			['a.md', new Set(['b.md'])],
			['b.md', new Set(['a.md'])],
			['c.md', new Set(['d.md'])],
			['d.md', new Set(['c.md'])],
		]);

		const components = findConnectedComponents(noteIds, adjacency);

		expect(components).toHaveLength(2);
		expect(components[0].sort()).toEqual(['a.md', 'b.md']);
		expect(components[1].sort()).toEqual(['c.md', 'd.md']);
	});

	it('should identify isolated notes as separate components', () => {
		const noteIds = ['a.md', 'b.md', 'c.md'];
		const adjacency = new Map<string, Set<string>>([
			['a.md', new Set()],
			['b.md', new Set()],
			['c.md', new Set()],
		]);

		const components = findConnectedComponents(noteIds, adjacency);

		expect(components).toHaveLength(3);
	});

	it('should sort components by size (largest first)', () => {
		const noteIds = ['a.md', 'b.md', 'c.md', 'd.md', 'e.md'];
		const adjacency = new Map<string, Set<string>>([
			['a.md', new Set(['b.md', 'c.md'])],
			['b.md', new Set(['a.md', 'c.md'])],
			['c.md', new Set(['a.md', 'b.md'])],
			['d.md', new Set(['e.md'])],
			['e.md', new Set(['d.md'])],
		]);

		const components = findConnectedComponents(noteIds, adjacency);

		expect(components).toHaveLength(2);
		expect(components[0]).toHaveLength(3); // Larger component first
		expect(components[1]).toHaveLength(2);
	});
});

describe('findCoreNotes', () => {
	it('should find notes with most connections', () => {
		const noteIds = ['a.md', 'b.md', 'c.md', 'd.md'];
		const adjacency = new Map<string, Set<string>>([
			['a.md', new Set(['b.md', 'c.md', 'd.md'])], // 3 connections
			['b.md', new Set(['a.md'])], // 1 connection
			['c.md', new Set(['a.md'])], // 1 connection
			['d.md', new Set(['a.md'])], // 1 connection
		]);

		const cores = findCoreNotes(noteIds, adjacency, 0.5);

		expect(cores[0]).toBe('a.md'); // Most connected
	});

	it('should return at least 2 cores when there are connected notes', () => {
		const noteIds = ['a.md', 'b.md', 'c.md'];
		const adjacency = new Map<string, Set<string>>([
			['a.md', new Set(['b.md'])],
			['b.md', new Set(['a.md', 'c.md'])],
			['c.md', new Set(['b.md'])],
		]);

		const cores = findCoreNotes(noteIds, adjacency, 0.1);

		expect(cores.length).toBeGreaterThanOrEqual(2);
	});

	it('should not include notes with no connections', () => {
		const noteIds = ['a.md', 'b.md', 'c.md'];
		const adjacency = new Map<string, Set<string>>([
			['a.md', new Set(['b.md'])],
			['b.md', new Set(['a.md'])],
			['c.md', new Set()], // No connections
		]);

		const cores = findCoreNotes(noteIds, adjacency, 0.5);

		expect(cores).not.toContain('c.md');
	});
});

describe('assignNotesToCores', () => {
	it('should assign cores to themselves', () => {
		const noteIds = ['core1.md', 'core2.md', 'note.md'];
		const cores = ['core1.md', 'core2.md'];
		const adjacency = new Map<string, Set<string>>([
			['core1.md', new Set(['note.md'])],
			['core2.md', new Set()],
			['note.md', new Set(['core1.md'])],
		]);
		const resolvedLinks: ResolvedLinks = {};
		const metadata = new Map<string, FileMetadata>();

		const assignments = assignNotesToCores(noteIds, cores, adjacency, resolvedLinks, metadata);

		expect(assignments.get(0)).toContain('core1.md');
		expect(assignments.get(1)).toContain('core2.md');
	});

	it('should assign notes to cores they link to', () => {
		const noteIds = ['core1.md', 'core2.md', 'note1.md', 'note2.md'];
		const cores = ['core1.md', 'core2.md'];
		const adjacency = new Map<string, Set<string>>([
			['core1.md', new Set(['note1.md'])],
			['core2.md', new Set(['note2.md'])],
			['note1.md', new Set(['core1.md'])],
			['note2.md', new Set(['core2.md'])],
		]);
		const resolvedLinks: ResolvedLinks = {};
		const metadata = new Map<string, FileMetadata>();

		const assignments = assignNotesToCores(noteIds, cores, adjacency, resolvedLinks, metadata);

		expect(assignments.get(0)).toContain('note1.md');
		expect(assignments.get(1)).toContain('note2.md');
	});

	it('should assign unlinked notes to uncategorized when no folder match', () => {
		// Use different folders so folder similarity doesn't apply
		const noteIds = ['folder1/core1.md', 'folder2/orphan.md'];
		const cores = ['folder1/core1.md'];
		const adjacency = new Map<string, Set<string>>([
			['folder1/core1.md', new Set()],
			['folder2/orphan.md', new Set()],
		]);
		const resolvedLinks: ResolvedLinks = {};
		const metadata = new Map<string, FileMetadata>();

		const assignments = assignNotesToCores(noteIds, cores, adjacency, resolvedLinks, metadata);

		expect(assignments.get(-1)).toContain('folder2/orphan.md');
	});

	it('should assign notes in same folder to nearest core', () => {
		const noteIds = ['folder/core1.md', 'folder/orphan.md'];
		const cores = ['folder/core1.md'];
		const adjacency = new Map<string, Set<string>>([
			['folder/core1.md', new Set()],
			['folder/orphan.md', new Set()],
		]);
		const resolvedLinks: ResolvedLinks = {};
		const metadata = new Map<string, FileMetadata>();

		const assignments = assignNotesToCores(noteIds, cores, adjacency, resolvedLinks, metadata);

		// Same folder should cause assignment to core
		expect(assignments.get(0)).toContain('folder/orphan.md');
	});
});

describe('splitByLinkCommunities', () => {
	const config = DEFAULT_CLUSTERING_CONFIG;

	it('should not split small clusters', () => {
		const cluster = createCluster({
			noteIds: ['a.md', 'b.md', 'c.md'],
			internalLinkDensity: 0,
			reasons: [],
		});
		const resolvedLinks: ResolvedLinks = {};
		const metadata = new Map<string, FileMetadata>();

		const result = splitByLinkCommunities([cluster], resolvedLinks, metadata, config);

		expect(result).toHaveLength(1);
		expect(result[0].noteIds).toEqual(cluster.noteIds);
	});

	it('should not split clusters with high link density', () => {
		const noteIds = Array.from({ length: 60 }, (_, i) => `note${i}.md`);
		const cluster = createCluster({
			noteIds,
			internalLinkDensity: 0.5, // High density
			reasons: [],
		});
		const resolvedLinks: ResolvedLinks = {};
		const metadata = new Map<string, FileMetadata>();

		const result = splitByLinkCommunities([cluster], resolvedLinks, metadata, config);

		expect(result).toHaveLength(1);
	});

	it('should split clusters with distinct connected components', () => {
		// Create 60 notes in 2 groups of 30
		const group1 = Array.from({ length: 30 }, (_, i) => `group1/note${i}.md`);
		const group2 = Array.from({ length: 30 }, (_, i) => `group2/note${i}.md`);
		const noteIds = [...group1, ...group2];

		const cluster = createCluster({
			noteIds,
			internalLinkDensity: 0.05, // Low density
			reasons: [],
		});

		// Create links within each group but not between groups
		const resolvedLinks: ResolvedLinks = {};
		for (let i = 0; i < 29; i++) {
			resolvedLinks[group1[i]] = { [group1[i + 1]]: 1 };
			resolvedLinks[group2[i]] = { [group2[i + 1]]: 1 };
		}

		const metadata = new Map<string, FileMetadata>();

		const result = splitByLinkCommunities([cluster], resolvedLinks, metadata, config);

		// Should have 2 clusters (one for each group)
		expect(result.length).toBeGreaterThanOrEqual(2);

		// Each significant cluster should have notes from only one group
		const significantClusters = result.filter((c) => c.noteIds.length >= 5);
		for (const c of significantClusters) {
			const hasGroup1 = c.noteIds.some((id) => id.startsWith('group1/'));
			const hasGroup2 = c.noteIds.some((id) => id.startsWith('group2/'));
			// Should not mix groups
			expect(hasGroup1 && hasGroup2).toBe(false);
		}
	});

	it('should handle clusters with no links (all orphans)', () => {
		const noteIds = Array.from({ length: 60 }, (_, i) => `note${i}.md`);
		const cluster = createCluster({
			noteIds,
			internalLinkDensity: 0,
			reasons: [],
		});
		const resolvedLinks: ResolvedLinks = {};
		const metadata = new Map<string, FileMetadata>();

		const result = splitByLinkCommunities([cluster], resolvedLinks, metadata, config);

		// All notes are orphans - should create uncategorized cluster
		expect(result).toHaveLength(1);
		expect(result[0].candidateNames).toContain('Uncategorized');
	});

	it('should preserve cluster metadata after splitting', () => {
		const group1 = Array.from({ length: 30 }, (_, i) => `folder/note${i}.md`);
		const group2 = Array.from({ length: 30 }, (_, i) => `folder/other${i}.md`);
		const noteIds = [...group1, ...group2];

		const cluster = createCluster({
			noteIds,
			folderPath: 'folder',
			dominantTags: ['#test'],
			internalLinkDensity: 0.05,
			reasons: ['Original reason'],
		});

		// Create links within each group
		const resolvedLinks: ResolvedLinks = {};
		for (let i = 0; i < 29; i++) {
			resolvedLinks[group1[i]] = { [group1[i + 1]]: 1 };
			resolvedLinks[group2[i]] = { [group2[i + 1]]: 1 };
		}

		const metadata = new Map<string, FileMetadata>();

		const result = splitByLinkCommunities([cluster], resolvedLinks, metadata, config);

		// Split clusters should preserve folder path
		for (const c of result) {
			expect(c.folderPath).toBe('folder');
			expect(c.reasons).toContain('Original reason');
		}
	});
});
