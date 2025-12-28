/**
 * Tier 3: Domain-Specific Metrics
 * Use Obsidian metadata (tags, folders, links) as proxy ground truth
 */

import type {EmbeddingCluster} from '../../src/domain/clustering/types';
import type {DomainMetrics} from './types';

/**
 * Compute tag homogeneity across clusters
 *
 * For each cluster:
 *   1. Count tag frequency across all notes
 *   2. Find dominant tag (most frequent)
 *   3. Homogeneity = count(notes with dominant_tag) / total_notes
 *
 * Overall = weighted average by cluster size
 */
export function computeTagHomogeneity(
	clusters: EmbeddingCluster[],
	noteTags: Map<string, string[]>,
): {
	overall: number;
	perCluster: Array<{
		clusterId: string;
		dominantTag: string | null;
		homogeneityScore: number;
		noteCount: number;
	}>;
} {
	const perCluster: Array<{
		clusterId: string;
		dominantTag: string | null;
		homogeneityScore: number;
		noteCount: number;
	}> = [];

	let totalWeightedHomogeneity = 0;
	let totalNotes = 0;

	for (const cluster of clusters) {
		if (cluster.noteIds.length === 0) {
			perCluster.push({
				clusterId: cluster.id,
				dominantTag: null,
				homogeneityScore: 0,
				noteCount: 0,
			});
			continue;
		}

		// Count tag frequency in this cluster
		const tagCounts = new Map<string, number>();
		let notesWithTags = 0;

		for (const noteId of cluster.noteIds) {
			const tags = noteTags.get(noteId) ?? [];
			if (tags.length > 0) {
				notesWithTags++;
			}
			for (const tag of tags) {
				tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
			}
		}

		// Find dominant tag
		let dominantTag: string | null = null;
		let maxCount = 0;
		for (const [tag, count] of tagCounts) {
			if (count > maxCount) {
				maxCount = count;
				dominantTag = tag;
			}
		}

		// Homogeneity = notes with dominant tag / total notes
		const homogeneityScore =
			cluster.noteIds.length > 0 ? maxCount / cluster.noteIds.length : 0;

		perCluster.push({
			clusterId: cluster.id,
			dominantTag,
			homogeneityScore,
			noteCount: cluster.noteIds.length,
		});

		totalWeightedHomogeneity += homogeneityScore * cluster.noteIds.length;
		totalNotes += cluster.noteIds.length;
	}

	const overall = totalNotes > 0 ? totalWeightedHomogeneity / totalNotes : 0;

	return {overall, perCluster};
}

/**
 * Extract folder path from a note path
 */
function getFolderPath(notePath: string): string {
	const lastSlash = notePath.lastIndexOf('/');
	return lastSlash > 0 ? notePath.slice(0, lastSlash) : '';
}

/**
 * Compute folder coherence across clusters
 *
 * For each cluster:
 *   1. Count notes per folder
 *   2. Find dominant folder (most common)
 *   3. Coherence = notes in dominant folder / total notes
 *
 * Overall = weighted average by cluster size
 */
export function computeFolderCoherence(clusters: EmbeddingCluster[]): {
	overall: number;
	perCluster: Array<{
		clusterId: string;
		dominantFolder: string;
		coherenceScore: number;
		noteCount: number;
	}>;
} {
	const perCluster: Array<{
		clusterId: string;
		dominantFolder: string;
		coherenceScore: number;
		noteCount: number;
	}> = [];

	let totalWeightedCoherence = 0;
	let totalNotes = 0;

	for (const cluster of clusters) {
		if (cluster.noteIds.length === 0) {
			perCluster.push({
				clusterId: cluster.id,
				dominantFolder: '',
				coherenceScore: 0,
				noteCount: 0,
			});
			continue;
		}

		// Count notes per folder
		const folderCounts = new Map<string, number>();
		for (const noteId of cluster.noteIds) {
			const folder = getFolderPath(noteId);
			folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);
		}

		// Find dominant folder
		let dominantFolder = '';
		let maxCount = 0;
		for (const [folder, count] of folderCounts) {
			if (count > maxCount) {
				maxCount = count;
				dominantFolder = folder;
			}
		}

		// Coherence = notes in dominant folder / total notes
		const coherenceScore =
			cluster.noteIds.length > 0 ? maxCount / cluster.noteIds.length : 0;

		perCluster.push({
			clusterId: cluster.id,
			dominantFolder,
			coherenceScore,
			noteCount: cluster.noteIds.length,
		});

		totalWeightedCoherence += coherenceScore * cluster.noteIds.length;
		totalNotes += cluster.noteIds.length;
	}

	const overall = totalNotes > 0 ? totalWeightedCoherence / totalNotes : 0;

	return {overall, perCluster};
}

/**
 * Compute average internal link density across clusters
 *
 * Uses the pre-computed internalLinkDensity field on each cluster.
 * Weighted average by cluster size.
 */
export function computeAvgLinkDensity(clusters: EmbeddingCluster[]): number {
	let totalWeightedDensity = 0;
	let totalNotes = 0;

	for (const cluster of clusters) {
		totalWeightedDensity += cluster.internalLinkDensity * cluster.noteIds.length;
		totalNotes += cluster.noteIds.length;
	}

	return totalNotes > 0 ? totalWeightedDensity / totalNotes : 0;
}

/**
 * Compute all domain-specific metrics
 */
export function computeDomainMetrics(
	clusters: EmbeddingCluster[],
	noteTags: Map<string, string[]>,
): DomainMetrics {
	const tagHomogeneity = computeTagHomogeneity(clusters, noteTags);
	const folderCoherence = computeFolderCoherence(clusters);

	return {
		tagHomogeneity: tagHomogeneity.overall,
		folderCoherence: folderCoherence.overall,
		avgInternalLinkDensity: computeAvgLinkDensity(clusters),
		perClusterTagHomogeneity: tagHomogeneity.perCluster,
	};
}
