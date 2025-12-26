import type { Concept, SynonymPattern, MisfitNote } from './types';
import { createConcept } from './types';

/**
 * Result of applying cluster refinements
 */
export interface RefinementResult {
	/** Refined concepts after synonym merges */
	concepts: Concept[];
	/** Misfit notes removed from concepts */
	misfitNotes: MisfitNote[];
	/** Statistics about the refinement */
	stats: RefinementStats;
}

/**
 * Statistics about the refinement process
 */
export interface RefinementStats {
	/** Number of synonym merges applied */
	synonymMergesApplied: number;
	/** Number of concepts reduced by merging */
	conceptsReduced: number;
	/** Number of misfit notes identified */
	misfitNotesIdentified: number;
	/** Number of notes removed from concepts */
	notesRemoved: number;
}

/**
 * Apply all cluster refinements (synonym merges and misfit removal)
 *
 * @param concepts - Concepts to refine
 * @param synonymPatterns - Synonym patterns to apply
 * @param misfitNotes - Misfit notes to remove
 * @returns Refined concepts and statistics
 */
export function applyClusterRefinements(
	concepts: Concept[],
	synonymPatterns: SynonymPattern[],
	misfitNotes: MisfitNote[],
): RefinementResult {
	// Apply synonym merges first
	const {
		concepts: mergedConcepts,
		mergesApplied,
		conceptsReduced,
	} = applySynonymMerges(concepts, synonymPatterns);

	// Then handle misfit notes
	const { concepts: refinedConcepts, notesRemoved } = handleMisfitNotes(
		mergedConcepts,
		misfitNotes,
	);

	return {
		concepts: refinedConcepts,
		misfitNotes,
		stats: {
			synonymMergesApplied: mergesApplied,
			conceptsReduced,
			misfitNotesIdentified: misfitNotes.length,
			notesRemoved,
		},
	};
}

/**
 * Apply synonym pattern merges to concepts
 * Merges alias concepts into primary concepts
 *
 * @param concepts - Concepts to merge
 * @param patterns - Synonym patterns defining merges
 * @returns Merged concepts and statistics
 */
export function applySynonymMerges(
	concepts: Concept[],
	patterns: SynonymPattern[],
): { concepts: Concept[]; mergesApplied: number; conceptsReduced: number } {
	if (patterns.length === 0) {
		return { concepts, mergesApplied: 0, conceptsReduced: 0 };
	}

	// Create concept map for quick lookup
	const conceptMap = new Map<string, Concept>();
	for (const concept of concepts) {
		conceptMap.set(concept.id, concept);
	}

	// Track which concepts to remove (merged into others)
	const toRemove = new Set<string>();
	const mergedConcepts = new Map<string, Concept>();

	// Apply each synonym pattern
	let mergesApplied = 0;

	for (const pattern of patterns) {
		const primary = conceptMap.get(pattern.primaryConceptId);
		if (!primary) continue;

		// Start with existing merged version or original
		const currentPrimary = mergedConcepts.get(pattern.primaryConceptId) || primary;

		// Collect all note IDs and original cluster IDs from aliases
		const allNoteIds = [...currentPrimary.noteIds];
		const allOriginalClusterIds = [...currentPrimary.originalClusterIds];

		for (const aliasId of pattern.aliasConceptIds) {
			// Skip if already removed
			if (toRemove.has(aliasId)) continue;

			const alias = conceptMap.get(aliasId);
			if (!alias) continue;

			// Get current version (may have been merged already)
			const currentAlias = mergedConcepts.get(aliasId) || alias;

			allNoteIds.push(...currentAlias.noteIds);
			allOriginalClusterIds.push(...currentAlias.originalClusterIds);
			toRemove.add(aliasId);
			mergesApplied++;
		}

		// Create merged concept
		mergedConcepts.set(
			pattern.primaryConceptId,
			createConcept({
				id: currentPrimary.id,
				name: currentPrimary.name,
				noteIds: [...new Set(allNoteIds)], // Deduplicate
				quizzabilityScore: currentPrimary.quizzabilityScore,
				isQuizzable: currentPrimary.isQuizzable,
				originalClusterIds: [...new Set(allOriginalClusterIds)],
				createdAt: currentPrimary.createdAt,
			}),
		);
	}

	// Build final concept list
	const result: Concept[] = [];
	for (const concept of concepts) {
		if (toRemove.has(concept.id)) {
			continue;
		}
		// Use merged version if available
		result.push(mergedConcepts.get(concept.id) || concept);
	}

	return {
		concepts: result,
		mergesApplied,
		conceptsReduced: toRemove.size,
	};
}

/**
 * Remove misfit notes from their current concepts
 *
 * @param concepts - Concepts to process
 * @param misfitNotes - Misfit notes to remove
 * @returns Updated concepts with misfit notes removed
 */
export function handleMisfitNotes(
	concepts: Concept[],
	misfitNotes: MisfitNote[],
): { concepts: Concept[]; notesRemoved: number } {
	if (misfitNotes.length === 0) {
		return { concepts, notesRemoved: 0 };
	}

	// Build map of concept ID to misfit note IDs
	const misfitsByConceptId = new Map<string, Set<string>>();
	for (const misfit of misfitNotes) {
		const existing = misfitsByConceptId.get(misfit.currentConceptId) || new Set();
		existing.add(misfit.noteId);
		misfitsByConceptId.set(misfit.currentConceptId, existing);
	}

	let notesRemoved = 0;

	const updatedConcepts = concepts.map((concept) => {
		const misfitsInConcept = misfitsByConceptId.get(concept.id);
		if (!misfitsInConcept || misfitsInConcept.size === 0) {
			return concept;
		}

		// Filter out misfit notes
		const filteredNoteIds = concept.noteIds.filter((noteId) => {
			if (misfitsInConcept.has(noteId)) {
				notesRemoved++;
				return false;
			}
			return true;
		});

		return createConcept({
			id: concept.id,
			name: concept.name,
			noteIds: filteredNoteIds,
			quizzabilityScore: concept.quizzabilityScore,
			isQuizzable: concept.isQuizzable,
			originalClusterIds: concept.originalClusterIds,
			createdAt: concept.createdAt,
		});
	});

	// Filter out concepts that have no notes left
	const nonEmptyConcepts = updatedConcepts.filter((c) => c.noteIds.length > 0);

	return {
		concepts: nonEmptyConcepts,
		notesRemoved,
	};
}

/**
 * Get suggested tags for a misfit note
 * Returns the tags suggested by the LLM for re-clustering
 *
 * @param misfitNote - The misfit note
 * @returns Suggested tags for re-clustering
 */
export function getMisfitNoteSuggestedTags(misfitNote: MisfitNote): string[] {
	return [...misfitNote.suggestedTags];
}

/**
 * Group misfit notes by their suggested primary tag
 * Useful for batch re-clustering
 *
 * @param misfitNotes - Misfit notes to group
 * @returns Map of primary tag to misfit notes
 */
export function groupMisfitsByPrimaryTag(misfitNotes: MisfitNote[]): Map<string, MisfitNote[]> {
	const groups = new Map<string, MisfitNote[]>();

	for (const misfit of misfitNotes) {
		const primaryTag = misfit.suggestedTags[0] || '#uncategorized';
		const existing = groups.get(primaryTag) || [];
		existing.push(misfit);
		groups.set(primaryTag, existing);
	}

	return groups;
}
