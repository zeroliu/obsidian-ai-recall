import { describe, it, expect } from 'vitest';
import {
	applyClusterRefinements,
	applySynonymMerges,
	handleMisfitNotes,
	getMisfitNoteSuggestedTags,
	groupMisfitsByPrimaryTag,
} from '../applyClusterRefinements';
import type { Concept, SynonymPattern, MisfitNote } from '../types';

describe('applyClusterRefinements', () => {
	const createConcept = (
		id: string,
		name: string,
		noteIds: string[],
		overrides: Partial<Concept> = {},
	): Concept => ({
		id,
		name,
		noteIds,
		quizzabilityScore: 0.8,
		isQuizzable: true,
		originalClusterIds: [id],
		createdAt: Date.now(),
		...overrides,
	});

	describe('applyClusterRefinements', () => {
		it('should apply both synonym merges and misfit removal', () => {
			const concepts = [
				createConcept('concept-1', 'JavaScript', ['note-1.md', 'note-2.md', 'grocery.md']),
				createConcept('concept-2', 'JS', ['note-3.md']),
			];

			const synonymPatterns: SynonymPattern[] = [
				{
					primaryConceptId: 'concept-1',
					aliasConceptIds: ['concept-2'],
					confidence: 0.95,
					reason: 'JS is JavaScript',
				},
			];

			const misfitNotes: MisfitNote[] = [
				{
					noteId: 'grocery.md',
					noteTitle: 'Grocery List',
					currentConceptId: 'concept-1',
					suggestedTags: ['#personal', '#shopping'],
					confidence: 0.9,
					reason: 'Not JavaScript content',
				},
			];

			const result = applyClusterRefinements(concepts, synonymPatterns, misfitNotes);

			expect(result.concepts).toHaveLength(1);
			expect(result.concepts[0].name).toBe('JavaScript');
			// Should have note-1, note-2, note-3 (grocery removed)
			expect(result.concepts[0].noteIds).toContain('note-1.md');
			expect(result.concepts[0].noteIds).toContain('note-3.md');
			expect(result.concepts[0].noteIds).not.toContain('grocery.md');

			expect(result.stats.synonymMergesApplied).toBe(1);
			expect(result.stats.conceptsReduced).toBe(1);
			expect(result.stats.misfitNotesIdentified).toBe(1);
			expect(result.stats.notesRemoved).toBe(1);
		});

		it('should handle no refinements needed', () => {
			const concepts = [
				createConcept('concept-1', 'React', ['note-1.md']),
				createConcept('concept-2', 'Python', ['note-2.md']),
			];

			const result = applyClusterRefinements(concepts, [], []);

			expect(result.concepts).toHaveLength(2);
			expect(result.stats.synonymMergesApplied).toBe(0);
			expect(result.stats.notesRemoved).toBe(0);
		});
	});

	describe('applySynonymMerges', () => {
		it('should merge alias concepts into primary', () => {
			const concepts = [
				createConcept('concept-1', 'JavaScript', ['note-1.md', 'note-2.md']),
				createConcept('concept-2', 'JS', ['note-3.md', 'note-4.md']),
			];

			const patterns: SynonymPattern[] = [
				{
					primaryConceptId: 'concept-1',
					aliasConceptIds: ['concept-2'],
					confidence: 0.98,
					reason: 'JS is JavaScript abbreviation',
				},
			];

			const result = applySynonymMerges(concepts, patterns);

			expect(result.concepts).toHaveLength(1);
			expect(result.concepts[0].name).toBe('JavaScript');
			expect(result.concepts[0].noteIds).toHaveLength(4);
			expect(result.mergesApplied).toBe(1);
			expect(result.conceptsReduced).toBe(1);
		});

		it('should handle multiple aliases for same primary', () => {
			const concepts = [
				createConcept('concept-1', 'JavaScript', ['note-1.md']),
				createConcept('concept-2', 'JS', ['note-2.md']),
				createConcept('concept-3', 'ECMAScript', ['note-3.md']),
			];

			const patterns: SynonymPattern[] = [
				{
					primaryConceptId: 'concept-1',
					aliasConceptIds: ['concept-2', 'concept-3'],
					confidence: 0.95,
					reason: 'All refer to JavaScript',
				},
			];

			const result = applySynonymMerges(concepts, patterns);

			expect(result.concepts).toHaveLength(1);
			expect(result.concepts[0].noteIds).toHaveLength(3);
			expect(result.mergesApplied).toBe(2);
			expect(result.conceptsReduced).toBe(2);
		});

		it('should handle empty patterns', () => {
			const concepts = [createConcept('concept-1', 'React', ['note-1.md'])];

			const result = applySynonymMerges(concepts, []);

			expect(result.concepts).toEqual(concepts);
			expect(result.mergesApplied).toBe(0);
		});

		it('should handle missing primary concept', () => {
			const concepts = [createConcept('concept-1', 'React', ['note-1.md'])];

			const patterns: SynonymPattern[] = [
				{
					primaryConceptId: 'missing-concept',
					aliasConceptIds: ['concept-1'],
					confidence: 0.9,
					reason: 'Test',
				},
			];

			const result = applySynonymMerges(concepts, patterns);

			expect(result.concepts).toHaveLength(1);
			expect(result.mergesApplied).toBe(0);
		});

		it('should deduplicate note IDs after merge', () => {
			const concepts = [
				createConcept('concept-1', 'React', ['note-1.md', 'note-2.md']),
				createConcept('concept-2', 'React Hooks', ['note-2.md', 'note-3.md']),
			];

			const patterns: SynonymPattern[] = [
				{
					primaryConceptId: 'concept-1',
					aliasConceptIds: ['concept-2'],
					confidence: 0.9,
					reason: 'Same topic',
				},
			];

			const result = applySynonymMerges(concepts, patterns);

			// note-2.md should only appear once
			expect(result.concepts[0].noteIds).toHaveLength(3);
			expect(new Set(result.concepts[0].noteIds).size).toBe(3);
		});
	});

	describe('handleMisfitNotes', () => {
		it('should remove misfit notes from concepts', () => {
			const concepts = [
				createConcept('concept-1', 'React', ['note-1.md', 'grocery.md', 'note-2.md']),
			];

			const misfits: MisfitNote[] = [
				{
					noteId: 'grocery.md',
					noteTitle: 'Grocery List',
					currentConceptId: 'concept-1',
					suggestedTags: ['#personal'],
					confidence: 0.9,
					reason: 'Not React content',
				},
			];

			const result = handleMisfitNotes(concepts, misfits);

			expect(result.concepts[0].noteIds).toHaveLength(2);
			expect(result.concepts[0].noteIds).not.toContain('grocery.md');
			expect(result.notesRemoved).toBe(1);
		});

		it('should remove multiple misfits from same concept', () => {
			const concepts = [
				createConcept('concept-1', 'React', ['note-1.md', 'grocery.md', 'recipe.md']),
			];

			const misfits: MisfitNote[] = [
				{
					noteId: 'grocery.md',
					noteTitle: 'Grocery List',
					currentConceptId: 'concept-1',
					suggestedTags: ['#personal'],
					confidence: 0.9,
					reason: 'Shopping list',
				},
				{
					noteId: 'recipe.md',
					noteTitle: 'Recipe',
					currentConceptId: 'concept-1',
					suggestedTags: ['#cooking'],
					confidence: 0.85,
					reason: 'Cooking content',
				},
			];

			const result = handleMisfitNotes(concepts, misfits);

			expect(result.concepts[0].noteIds).toHaveLength(1);
			expect(result.concepts[0].noteIds).toContain('note-1.md');
			expect(result.notesRemoved).toBe(2);
		});

		it('should remove concept if all notes are misfits', () => {
			const concepts = [
				createConcept('concept-1', 'Miscellaneous', ['grocery.md', 'recipe.md']),
				createConcept('concept-2', 'React', ['note-1.md']),
			];

			const misfits: MisfitNote[] = [
				{
					noteId: 'grocery.md',
					noteTitle: 'Grocery',
					currentConceptId: 'concept-1',
					suggestedTags: ['#personal'],
					confidence: 0.9,
					reason: 'Personal',
				},
				{
					noteId: 'recipe.md',
					noteTitle: 'Recipe',
					currentConceptId: 'concept-1',
					suggestedTags: ['#cooking'],
					confidence: 0.9,
					reason: 'Cooking',
				},
			];

			const result = handleMisfitNotes(concepts, misfits);

			expect(result.concepts).toHaveLength(1);
			expect(result.concepts[0].name).toBe('React');
		});

		it('should handle no misfits', () => {
			const concepts = [createConcept('concept-1', 'React', ['note-1.md'])];

			const result = handleMisfitNotes(concepts, []);

			expect(result.concepts).toEqual(concepts);
			expect(result.notesRemoved).toBe(0);
		});
	});

	describe('getMisfitNoteSuggestedTags', () => {
		it('should return suggested tags', () => {
			const misfit: MisfitNote = {
				noteId: 'test.md',
				noteTitle: 'Test',
				currentConceptId: 'concept-1',
				suggestedTags: ['#personal', '#shopping', '#lists'],
				confidence: 0.9,
				reason: 'Test',
			};

			const tags = getMisfitNoteSuggestedTags(misfit);

			expect(tags).toEqual(['#personal', '#shopping', '#lists']);
		});
	});

	describe('groupMisfitsByPrimaryTag', () => {
		it('should group misfits by primary tag', () => {
			const misfits: MisfitNote[] = [
				{
					noteId: 'grocery.md',
					noteTitle: 'Grocery',
					currentConceptId: 'concept-1',
					suggestedTags: ['#personal', '#shopping'],
					confidence: 0.9,
					reason: 'Shopping',
				},
				{
					noteId: 'todo.md',
					noteTitle: 'Todo',
					currentConceptId: 'concept-2',
					suggestedTags: ['#personal', '#tasks'],
					confidence: 0.85,
					reason: 'Tasks',
				},
				{
					noteId: 'recipe.md',
					noteTitle: 'Recipe',
					currentConceptId: 'concept-1',
					suggestedTags: ['#cooking'],
					confidence: 0.9,
					reason: 'Cooking',
				},
			];

			const groups = groupMisfitsByPrimaryTag(misfits);

			expect(groups.size).toBe(2);
			expect(groups.get('#personal')).toHaveLength(2);
			expect(groups.get('#cooking')).toHaveLength(1);
		});

		it('should use #uncategorized for misfits without tags', () => {
			const misfits: MisfitNote[] = [
				{
					noteId: 'unknown.md',
					noteTitle: 'Unknown',
					currentConceptId: 'concept-1',
					suggestedTags: [],
					confidence: 0.9,
					reason: 'Unknown content',
				},
			];

			const groups = groupMisfitsByPrimaryTag(misfits);

			expect(groups.get('#uncategorized')).toHaveLength(1);
		});
	});
});
