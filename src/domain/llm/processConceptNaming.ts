import type { Cluster } from '@/domain/clustering/types';
import type { Concept, ConceptNamingResult } from './types';
import { createConcept } from './types';

/**
 * Process LLM naming results and create concepts from clusters
 *
 * @param clusters - Original clusters that were sent for naming
 * @param results - LLM naming results for each cluster
 * @returns Array of concepts created from the results
 */
export function processConceptNaming(
	clusters: Cluster[],
	results: ConceptNamingResult[],
): Concept[] {
	// Create a map of cluster ID to result for quick lookup
	const resultMap = new Map<string, ConceptNamingResult>();
	for (const result of results) {
		resultMap.set(result.clusterId, result);
	}

	// Create a map of cluster ID to cluster
	const clusterMap = new Map<string, Cluster>();
	for (const cluster of clusters) {
		clusterMap.set(cluster.id, cluster);
	}

	// Track which clusters have been merged into others
	const mergedInto = new Map<string, string>();

	// Process merge suggestions first
	for (const result of results) {
		for (const mergeTarget of result.suggestedMerges) {
			// Only merge if not already merged elsewhere
			if (!mergedInto.has(mergeTarget)) {
				mergedInto.set(mergeTarget, result.clusterId);
			}
		}
	}

	// Create concepts, handling merges
	const concepts: Concept[] = [];
	const processedClusterIds = new Set<string>();

	for (const cluster of clusters) {
		// Skip if this cluster was merged into another
		if (mergedInto.has(cluster.id)) {
			continue;
		}

		// Skip if already processed
		if (processedClusterIds.has(cluster.id)) {
			continue;
		}

		const result = resultMap.get(cluster.id);
		if (!result) {
			// No result for this cluster, create with defaults
			concepts.push(
				createConcept({
					name: cluster.candidateNames[0] || 'Unnamed Concept',
					noteIds: [...cluster.noteIds],
					originalClusterIds: [cluster.id],
				}),
			);
			processedClusterIds.add(cluster.id);
			continue;
		}

		// Collect all note IDs including from merged clusters
		const allNoteIds = [...cluster.noteIds];
		const originalClusterIds = [cluster.id];

		for (const [mergedId, targetId] of mergedInto.entries()) {
			if (targetId === cluster.id) {
				const mergedCluster = clusterMap.get(mergedId);
				if (mergedCluster) {
					allNoteIds.push(...mergedCluster.noteIds);
					originalClusterIds.push(mergedId);
					processedClusterIds.add(mergedId);
				}
			}
		}

		concepts.push(
			createConcept({
				name: result.canonicalName,
				noteIds: allNoteIds,
				quizzabilityScore: result.quizzabilityScore,
				isQuizzable: result.isQuizzable,
				originalClusterIds,
			}),
		);

		processedClusterIds.add(cluster.id);
	}

	return concepts;
}

/**
 * Apply additional merge suggestions after initial concept creation
 * This handles cases where LLM suggests merging concepts with the same name
 *
 * @param concepts - Initial concepts before merging
 * @param results - LLM naming results for merge suggestions
 * @returns Merged concepts
 */
export function applyMergeSuggestions(
	concepts: Concept[],
	results: ConceptNamingResult[],
): Concept[] {
	// Build merge map from results
	const mergeInstructions = new Map<string, string[]>();
	for (const result of results) {
		if (result.suggestedMerges.length > 0) {
			mergeInstructions.set(result.clusterId, result.suggestedMerges);
		}
	}

	// If no merges needed, return as-is
	if (mergeInstructions.size === 0) {
		return concepts;
	}

	// Create concept ID to cluster ID mapping
	const conceptByOriginalCluster = new Map<string, Concept>();
	for (const concept of concepts) {
		for (const clusterId of concept.originalClusterIds) {
			conceptByOriginalCluster.set(clusterId, concept);
		}
	}

	// Apply merges
	const mergedConcepts: Concept[] = [];
	const processedConceptIds = new Set<string>();

	for (const concept of concepts) {
		if (processedConceptIds.has(concept.id)) {
			continue;
		}

		// Find if this concept's original cluster should absorb others
		const primaryClusterId = concept.originalClusterIds[0];
		const toMerge = mergeInstructions.get(primaryClusterId);

		if (!toMerge || toMerge.length === 0) {
			mergedConcepts.push(concept);
			processedConceptIds.add(concept.id);
			continue;
		}

		// Merge all target concepts into this one
		const allNoteIds = [...concept.noteIds];
		const allOriginalClusterIds = [...concept.originalClusterIds];

		for (const targetClusterId of toMerge) {
			const targetConcept = conceptByOriginalCluster.get(targetClusterId);
			if (targetConcept && !processedConceptIds.has(targetConcept.id)) {
				allNoteIds.push(...targetConcept.noteIds);
				allOriginalClusterIds.push(...targetConcept.originalClusterIds);
				processedConceptIds.add(targetConcept.id);
			}
		}

		// Deduplicate note IDs
		const uniqueNoteIds = [...new Set(allNoteIds)];

		mergedConcepts.push(
			createConcept({
				id: concept.id, // Keep original ID
				name: concept.name,
				noteIds: uniqueNoteIds,
				quizzabilityScore: concept.quizzabilityScore,
				isQuizzable: concept.isQuizzable,
				originalClusterIds: [...new Set(allOriginalClusterIds)],
				createdAt: concept.createdAt,
			}),
		);

		processedConceptIds.add(concept.id);
	}

	return mergedConcepts;
}

/**
 * Create a concept from a naming result and cluster
 *
 * @param result - LLM naming result
 * @param cluster - Original cluster
 * @returns Created concept
 */
export function createConceptFromResult(result: ConceptNamingResult, cluster: Cluster): Concept {
	return createConcept({
		name: result.canonicalName,
		noteIds: [...cluster.noteIds],
		quizzabilityScore: result.quizzabilityScore,
		isQuizzable: result.isQuizzable,
		originalClusterIds: [cluster.id],
	});
}

/**
 * Filter concepts to only quizzable ones
 *
 * @param concepts - All concepts
 * @returns Only quizzable concepts
 */
export function filterQuizzableConcepts(concepts: Concept[]): Concept[] {
	return concepts.filter((c) => c.isQuizzable);
}

/**
 * Filter concepts to only non-quizzable ones
 *
 * @param concepts - All concepts
 * @returns Only non-quizzable concepts
 */
export function filterNonQuizzableConcepts(concepts: Concept[]): Concept[] {
	return concepts.filter((c) => !c.isQuizzable);
}
