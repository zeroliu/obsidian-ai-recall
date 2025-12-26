import { describe, it, expect } from 'vitest';
import {
	processConceptNaming,
	applyMergeSuggestions,
	createConceptFromResult,
	filterQuizzableConcepts,
	filterNonQuizzableConcepts,
} from '../processConceptNaming';
import type { Cluster } from '@/domain/clustering/types';
import type { ConceptNamingResult, Concept } from '../types';

describe('processConceptNaming', () => {
	const createCluster = (id: string, noteIds: string[]): Cluster => ({
		id,
		candidateNames: [`Candidate for ${id}`],
		noteIds,
		dominantTags: [],
		folderPath: '',
		internalLinkDensity: 0,
		createdAt: Date.now(),
		reasons: [],
	});

	const createResult = (
		clusterId: string,
		canonicalName: string,
		overrides: Partial<ConceptNamingResult> = {},
	): ConceptNamingResult => ({
		clusterId,
		canonicalName,
		quizzabilityScore: 0.8,
		isQuizzable: true,
		suggestedMerges: [],
		...overrides,
	});

	describe('processConceptNaming', () => {
		it('should create concepts from clusters and results', () => {
			const clusters = [
				createCluster('cluster-1', ['note-1.md', 'note-2.md']),
				createCluster('cluster-2', ['note-3.md']),
			];

			const results = [
				createResult('cluster-1', 'React Development'),
				createResult('cluster-2', 'TypeScript', { quizzabilityScore: 0.9 }),
			];

			const concepts = processConceptNaming(clusters, results);

			expect(concepts).toHaveLength(2);
			expect(concepts[0].name).toBe('React Development');
			expect(concepts[0].noteIds).toEqual(['note-1.md', 'note-2.md']);
			expect(concepts[0].originalClusterIds).toContain('cluster-1');

			expect(concepts[1].name).toBe('TypeScript');
			expect(concepts[1].quizzabilityScore).toBe(0.9);
		});

		it('should handle non-quizzable concepts', () => {
			const clusters = [createCluster('cluster-1', ['note-1.md'])];

			const results = [
				createResult('cluster-1', 'Meeting Notes', {
					quizzabilityScore: 0.1,
					isQuizzable: false,
					nonQuizzableReason: 'Ephemeral content',
				}),
			];

			const concepts = processConceptNaming(clusters, results);

			expect(concepts[0].isQuizzable).toBe(false);
			expect(concepts[0].quizzabilityScore).toBe(0.1);
		});

		it('should merge clusters based on suggestedMerges', () => {
			const clusters = [
				createCluster('cluster-1', ['note-1.md', 'note-2.md']),
				createCluster('cluster-2', ['note-3.md', 'note-4.md']),
			];

			const results = [
				createResult('cluster-1', 'React Development', {
					suggestedMerges: ['cluster-2'],
				}),
				createResult('cluster-2', 'React Hooks'),
			];

			const concepts = processConceptNaming(clusters, results);

			expect(concepts).toHaveLength(1);
			expect(concepts[0].name).toBe('React Development');
			expect(concepts[0].noteIds).toHaveLength(4);
			expect(concepts[0].noteIds).toContain('note-1.md');
			expect(concepts[0].noteIds).toContain('note-3.md');
			expect(concepts[0].originalClusterIds).toContain('cluster-1');
			expect(concepts[0].originalClusterIds).toContain('cluster-2');
		});

		it('should handle multiple merge targets', () => {
			const clusters = [
				createCluster('cluster-1', ['note-1.md']),
				createCluster('cluster-2', ['note-2.md']),
				createCluster('cluster-3', ['note-3.md']),
			];

			const results = [
				createResult('cluster-1', 'JavaScript', {
					suggestedMerges: ['cluster-2', 'cluster-3'],
				}),
				createResult('cluster-2', 'JS'),
				createResult('cluster-3', 'ES6'),
			];

			const concepts = processConceptNaming(clusters, results);

			expect(concepts).toHaveLength(1);
			expect(concepts[0].noteIds).toHaveLength(3);
			expect(concepts[0].originalClusterIds).toHaveLength(3);
		});

		it('should handle missing results with defaults', () => {
			const clusters = [
				createCluster('cluster-1', ['note-1.md']),
				createCluster('cluster-2', ['note-2.md']),
			];

			const results = [createResult('cluster-1', 'React Development')];

			const concepts = processConceptNaming(clusters, results);

			expect(concepts).toHaveLength(2);
			expect(concepts[0].name).toBe('React Development');
			expect(concepts[1].name).toBe('Candidate for cluster-2'); // Falls back to candidate name
		});

		it('should handle empty clusters', () => {
			const concepts = processConceptNaming([], []);
			expect(concepts).toEqual([]);
		});
	});

	describe('applyMergeSuggestions', () => {
		const createConcept = (
			id: string,
			name: string,
			noteIds: string[],
			originalClusterIds: string[],
		): Concept => ({
			id,
			name,
			noteIds,
			quizzabilityScore: 0.8,
			isQuizzable: true,
			originalClusterIds,
			createdAt: Date.now(),
		});

		it('should merge concepts based on cluster merge suggestions', () => {
			const concepts = [
				createConcept('concept-1', 'JavaScript', ['note-1.md'], ['cluster-1']),
				createConcept('concept-2', 'JS Tutorials', ['note-2.md'], ['cluster-2']),
			];

			const results: ConceptNamingResult[] = [
				{
					clusterId: 'cluster-1',
					canonicalName: 'JavaScript',
					quizzabilityScore: 0.9,
					isQuizzable: true,
					suggestedMerges: ['cluster-2'],
				},
			];

			const merged = applyMergeSuggestions(concepts, results);

			expect(merged).toHaveLength(1);
			expect(merged[0].noteIds).toContain('note-1.md');
			expect(merged[0].noteIds).toContain('note-2.md');
		});

		it('should return original concepts if no merges', () => {
			const concepts = [
				createConcept('concept-1', 'React', ['note-1.md'], ['cluster-1']),
				createConcept('concept-2', 'Python', ['note-2.md'], ['cluster-2']),
			];

			const results: ConceptNamingResult[] = [];

			const merged = applyMergeSuggestions(concepts, results);

			expect(merged).toHaveLength(2);
			expect(merged).toEqual(concepts);
		});

		it('should deduplicate note IDs after merge', () => {
			const concepts = [
				createConcept('concept-1', 'React', ['note-1.md', 'note-2.md'], ['cluster-1']),
				createConcept('concept-2', 'React Hooks', ['note-2.md', 'note-3.md'], ['cluster-2']),
			];

			const results: ConceptNamingResult[] = [
				{
					clusterId: 'cluster-1',
					canonicalName: 'React',
					quizzabilityScore: 0.9,
					isQuizzable: true,
					suggestedMerges: ['cluster-2'],
				},
			];

			const merged = applyMergeSuggestions(concepts, results);

			expect(merged).toHaveLength(1);
			// note-2.md should appear only once
			const uniqueNotes = [...new Set(merged[0].noteIds)];
			expect(uniqueNotes).toHaveLength(merged[0].noteIds.length);
			expect(merged[0].noteIds).toHaveLength(3);
		});
	});

	describe('createConceptFromResult', () => {
		it('should create a concept from result and cluster', () => {
			const cluster = createCluster('cluster-1', ['note-1.md', 'note-2.md']);
			const result = createResult('cluster-1', 'React Development', {
				quizzabilityScore: 0.85,
				isQuizzable: true,
			});

			const concept = createConceptFromResult(result, cluster);

			expect(concept.name).toBe('React Development');
			expect(concept.noteIds).toEqual(['note-1.md', 'note-2.md']);
			expect(concept.quizzabilityScore).toBe(0.85);
			expect(concept.isQuizzable).toBe(true);
			expect(concept.originalClusterIds).toContain('cluster-1');
		});
	});

	describe('filterQuizzableConcepts', () => {
		it('should filter to only quizzable concepts', () => {
			const concepts: Concept[] = [
				{
					id: '1',
					name: 'React',
					noteIds: [],
					quizzabilityScore: 0.9,
					isQuizzable: true,
					originalClusterIds: [],
					createdAt: Date.now(),
				},
				{
					id: '2',
					name: 'Meetings',
					noteIds: [],
					quizzabilityScore: 0.1,
					isQuizzable: false,
					originalClusterIds: [],
					createdAt: Date.now(),
				},
			];

			const quizzable = filterQuizzableConcepts(concepts);

			expect(quizzable).toHaveLength(1);
			expect(quizzable[0].name).toBe('React');
		});
	});

	describe('filterNonQuizzableConcepts', () => {
		it('should filter to only non-quizzable concepts', () => {
			const concepts: Concept[] = [
				{
					id: '1',
					name: 'React',
					noteIds: [],
					quizzabilityScore: 0.9,
					isQuizzable: true,
					originalClusterIds: [],
					createdAt: Date.now(),
				},
				{
					id: '2',
					name: 'Meetings',
					noteIds: [],
					quizzabilityScore: 0.1,
					isQuizzable: false,
					originalClusterIds: [],
					createdAt: Date.now(),
				},
			];

			const nonQuizzable = filterNonQuizzableConcepts(concepts);

			expect(nonQuizzable).toHaveLength(1);
			expect(nonQuizzable[0].name).toBe('Meetings');
		});
	});
});
