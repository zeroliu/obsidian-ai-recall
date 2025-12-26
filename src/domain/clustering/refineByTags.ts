import type { FileMetadata } from '@/ports/IMetadataProvider';
import { type Cluster, type ClusteringConfig, createCluster } from './types';

/**
 * Refines clusters by splitting them based on dominant tags
 * If a cluster has distinct tag groups, it may be split into sub-clusters
 *
 * @param clusters - Array of clusters to refine
 * @param metadata - Map of file path to metadata
 * @param config - Clustering configuration
 * @returns Refined array of clusters
 */
export function refineByTags(
	clusters: Cluster[],
	metadata: Map<string, FileMetadata>,
	config: ClusteringConfig,
): Cluster[] {
	const refined: Cluster[] = [];

	for (const cluster of clusters) {
		// Calculate tag frequencies for this cluster
		const tagCounts = getTagCounts(cluster.noteIds, metadata);

		// Find dominant tags (tags that appear in >= threshold of notes)
		const dominantTags = findDominantTags(tagCounts, cluster.noteIds.length, config);

		if (dominantTags.length === 0) {
			// No dominant tags, keep cluster as-is
			refined.push({
				...cluster,
				dominantTags: [],
				reasons: [...cluster.reasons, 'No dominant tags found'],
			});
			continue;
		}

		// Check if we should split this cluster
		const tagGroups = groupNotesByDominantTag(cluster.noteIds, dominantTags, metadata);

		// Only split if we have multiple distinct groups of significant size
		const significantGroups = Array.from(tagGroups.entries()).filter(
			([, noteIds]) => noteIds.length >= config.minClusterSize,
		);

		if (significantGroups.length <= 1) {
			// Single dominant group or no significant groups, keep cluster with tags
			const tagList = dominantTags.slice(0, 3).join(', ');
			refined.push({
				...cluster,
				dominantTags,
				reasons: [...cluster.reasons, `Dominant tags: ${tagList}`],
			});
			continue;
		}

		// Split into sub-clusters based on dominant tags
		for (const [tag, noteIds] of significantGroups) {
			refined.push(
				createCluster({
					noteIds,
					folderPath: cluster.folderPath,
					dominantTags: [tag],
					candidateNames: [...cluster.candidateNames, formatTagAsCandidateName(tag)],
					reasons: [...cluster.reasons, `Split by tag: ${tag} (${noteIds.length} notes)`],
				}),
			);
		}

		// Handle notes without any dominant tags (orphans)
		const allGroupedNotes = new Set(significantGroups.flatMap(([, ids]) => ids));
		const orphans = cluster.noteIds.filter((id) => !allGroupedNotes.has(id));

		if (orphans.length > 0) {
			refined.push(
				createCluster({
					noteIds: orphans,
					folderPath: cluster.folderPath,
					dominantTags: [],
					candidateNames: [...cluster.candidateNames, 'Other'],
					reasons: [
						...cluster.reasons,
						`Orphaned notes without dominant tags (${orphans.length} notes)`,
					],
				}),
			);
		}
	}

	return refined;
}

/**
 * Count occurrences of each tag in the cluster
 */
export function getTagCounts(
	noteIds: string[],
	metadata: Map<string, FileMetadata>,
): Map<string, number> {
	const counts = new Map<string, number>();

	for (const noteId of noteIds) {
		const meta = metadata.get(noteId);
		if (!meta) continue;

		for (const tag of meta.tags) {
			const normalized = normalizeTag(tag);
			counts.set(normalized, (counts.get(normalized) || 0) + 1);
		}
	}

	return counts;
}

/**
 * Find tags that appear in at least threshold% of notes
 */
export function findDominantTags(
	tagCounts: Map<string, number>,
	totalNotes: number,
	config: ClusteringConfig,
): string[] {
	if (totalNotes === 0) return [];

	const threshold = config.dominantTagThreshold;
	const dominantTags: string[] = [];

	for (const [tag, count] of tagCounts.entries()) {
		const frequency = count / totalNotes;
		if (frequency >= threshold) {
			dominantTags.push(tag);
		}
	}

	// Sort by frequency (most common first)
	return dominantTags.sort((a, b) => {
		const countA = tagCounts.get(a) || 0;
		const countB = tagCounts.get(b) || 0;
		return countB - countA;
	});
}

/**
 * Group notes by their most relevant dominant tag
 * Each note is assigned to at most one group (the most frequent matching tag)
 */
export function groupNotesByDominantTag(
	noteIds: string[],
	dominantTags: string[],
	metadata: Map<string, FileMetadata>,
): Map<string, string[]> {
	const groups = new Map<string, string[]>();

	// Initialize groups for each dominant tag
	for (const tag of dominantTags) {
		groups.set(tag, []);
	}

	for (const noteId of noteIds) {
		const meta = metadata.get(noteId);
		if (!meta) continue;

		// Find the first (most dominant) tag that this note has
		const noteTags = new Set(meta.tags.map(normalizeTag));
		const matchingTag = dominantTags.find((tag) => noteTags.has(tag));

		if (matchingTag) {
			groups.get(matchingTag)?.push(noteId);
		}
	}

	return groups;
}

/**
 * Normalize a tag for comparison
 * Ensures consistent handling of # prefix
 */
export function normalizeTag(tag: string): string {
	const cleaned = tag.trim().toLowerCase();
	return cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
}

/**
 * Format a tag as a candidate cluster name
 */
function formatTagAsCandidateName(tag: string): string {
	return (
		tag
			// Remove # prefix
			.replace(/^#/, '')
			// Replace common separators with spaces
			.replace(/[-_/]/g, ' ')
			// Capitalize first letter of each word
			.replace(/\b\w/g, (c) => c.toUpperCase())
			.trim()
	);
}
