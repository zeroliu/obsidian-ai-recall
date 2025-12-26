import type { ResolvedLinks } from '@/ports/IMetadataProvider';
import { calculateLinkOverlap } from './analyzeLinks';
import { type Cluster, type ClusteringConfig, createCluster, generateClusterId } from './types';

/**
 * Merges clusters that have high link overlap
 * Two clusters are merged if:
 * 1. They have high bidirectional link overlap (>= threshold)
 * 2. They have similar sizes (neither is 3x larger than the other)
 *
 * @param clusters - Array of clusters to potentially merge
 * @param resolvedLinks - Map of source -> { target -> count }
 * @param config - Clustering configuration
 * @returns Array of clusters after merging
 */
export function mergeRelatedClusters(
	clusters: Cluster[],
	resolvedLinks: ResolvedLinks,
	config: ClusteringConfig,
): Cluster[] {
	if (clusters.length <= 1) {
		return clusters;
	}

	// Track which clusters have been merged
	const merged = new Set<number>();
	const result: Cluster[] = [];

	// Find merge candidates
	const mergePairs: Array<[number, number, number]> = [];

	for (let i = 0; i < clusters.length; i++) {
		for (let j = i + 1; j < clusters.length; j++) {
			const overlap = calculateLinkOverlap(clusters[i], clusters[j], resolvedLinks);

			if (overlap >= config.mergeOverlapThreshold && areSimilarSize(clusters[i], clusters[j])) {
				mergePairs.push([i, j, overlap]);
			}
		}
	}

	// Sort by overlap (highest first) for greedy merging
	mergePairs.sort((a, b) => b[2] - a[2]);

	// Perform merges
	for (const [i, j, overlap] of mergePairs) {
		if (merged.has(i) || merged.has(j)) {
			continue;
		}

		// Merge clusters i and j
		const mergedCluster = mergeTwoClusters(clusters[i], clusters[j], overlap);

		// Check if merged cluster would be too large
		if (mergedCluster.noteIds.length <= config.maxClusterSize) {
			result.push(mergedCluster);
			merged.add(i);
			merged.add(j);
		}
	}

	// Add unmerged clusters
	for (let i = 0; i < clusters.length; i++) {
		if (!merged.has(i)) {
			result.push(clusters[i]);
		}
	}

	return result;
}

/**
 * Check if two clusters are similar in size
 * Returns true if neither is more than 3x larger than the other
 */
export function areSimilarSize(a: Cluster, b: Cluster): boolean {
	const ratio =
		a.noteIds.length > b.noteIds.length
			? a.noteIds.length / b.noteIds.length
			: b.noteIds.length / a.noteIds.length;

	return ratio <= 3;
}

/**
 * Merge two clusters into one
 */
export function mergeTwoClusters(a: Cluster, b: Cluster, overlap?: number): Cluster {
	// Combine note IDs (deduplicate just in case)
	const noteIds = [...new Set([...a.noteIds, ...b.noteIds])];

	// Combine and deduplicate dominant tags
	const dominantTags = [...new Set([...a.dominantTags, ...b.dominantTags])];

	// Combine candidate names
	const candidateNames = [...new Set([...a.candidateNames, ...b.candidateNames])];

	// Use the folder path of the larger cluster, or common path
	const folderPath = findCommonFolderPath(a.folderPath, b.folderPath);

	// Average the link densities (weighted by size)
	const totalSize = a.noteIds.length + b.noteIds.length;
	const avgDensity =
		(a.internalLinkDensity * a.noteIds.length + b.internalLinkDensity * b.noteIds.length) /
		totalSize;

	// Combine reasons and add merge reason
	const combinedReasons = [...new Set([...a.reasons, ...b.reasons])];
	const overlapPct = overlap !== undefined ? `${(overlap * 100).toFixed(0)}%` : 'high';
	combinedReasons.push(
		`Merged clusters due to link overlap (${overlapPct}): ${a.noteIds.length} + ${b.noteIds.length} notes`,
	);

	return createCluster({
		id: generateClusterId(),
		noteIds,
		dominantTags,
		candidateNames,
		folderPath,
		internalLinkDensity: avgDensity,
		reasons: combinedReasons,
	});
}

/**
 * Find the common folder path between two paths
 */
export function findCommonFolderPath(pathA: string, pathB: string): string {
	if (pathA === pathB) {
		return pathA;
	}

	if (pathA === '' || pathB === '') {
		return '';
	}

	const partsA = pathA.split('/');
	const partsB = pathB.split('/');
	const common: string[] = [];

	for (let i = 0; i < Math.min(partsA.length, partsB.length); i++) {
		if (partsA[i] === partsB[i]) {
			common.push(partsA[i]);
		} else {
			break;
		}
	}

	return common.join('/');
}
