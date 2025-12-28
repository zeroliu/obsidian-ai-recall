/**
 * Tier 2: Semantic Coherence Metrics
 * Measure whether clusters are semantically meaningful using embeddings
 */

import {cosineSimilarity, euclideanDistance} from '../../src/domain/clustering/centroidCalculator';
import type {EmbeddingCluster} from '../../src/domain/clustering/types';
import type {SemanticMetrics} from './types';

/**
 * Compute average intra-cluster similarity
 *
 * For each cluster, compute the average pairwise cosine similarity
 * between all notes in the cluster. Return the weighted average
 * across all clusters.
 *
 * @returns Average similarity in range [0, 1], higher is better
 */
export function computeIntraClusterSimilarity(
	embeddings: Map<string, number[]>,
	clusters: EmbeddingCluster[],
): {overall: number; perCluster: Array<{clusterId: string; similarity: number; noteCount: number}>} {
	const perCluster: Array<{clusterId: string; similarity: number; noteCount: number}> = [];
	let totalWeightedSimilarity = 0;
	let totalPairs = 0;

	for (const cluster of clusters) {
		const noteIds = cluster.noteIds;
		if (noteIds.length < 2) {
			perCluster.push({
				clusterId: cluster.id,
				similarity: 1.0, // Single note has perfect similarity with itself
				noteCount: noteIds.length,
			});
			continue;
		}

		let sumSimilarity = 0;
		let pairCount = 0;

		for (let i = 0; i < noteIds.length; i++) {
			const embeddingI = embeddings.get(noteIds[i]);
			if (!embeddingI) continue;

			for (let j = i + 1; j < noteIds.length; j++) {
				const embeddingJ = embeddings.get(noteIds[j]);
				if (!embeddingJ) continue;

				sumSimilarity += cosineSimilarity(embeddingI, embeddingJ);
				pairCount++;
			}
		}

		const clusterSimilarity = pairCount > 0 ? sumSimilarity / pairCount : 1.0;
		perCluster.push({
			clusterId: cluster.id,
			similarity: clusterSimilarity,
			noteCount: noteIds.length,
		});

		totalWeightedSimilarity += sumSimilarity;
		totalPairs += pairCount;
	}

	const overall = totalPairs > 0 ? totalWeightedSimilarity / totalPairs : 0;

	return {overall, perCluster};
}

/**
 * Compute average inter-cluster distance
 *
 * Compute the average Euclidean distance between all pairs of cluster centroids.
 *
 * @returns Average distance (higher means better separation)
 */
export function computeInterClusterDistance(clusters: EmbeddingCluster[]): number {
	if (clusters.length < 2) {
		return 0;
	}

	let sumDistance = 0;
	let pairCount = 0;

	for (let i = 0; i < clusters.length; i++) {
		const centroidI = clusters[i].centroid;
		if (!centroidI) continue;

		for (let j = i + 1; j < clusters.length; j++) {
			const centroidJ = clusters[j].centroid;
			if (!centroidJ) continue;

			sumDistance += euclideanDistance(centroidI, centroidJ);
			pairCount++;
		}
	}

	return pairCount > 0 ? sumDistance / pairCount : 0;
}

/**
 * Compute average centroid compactness
 *
 * For each cluster, compute the average distance from each note
 * to the cluster centroid. Lower values indicate tighter clusters.
 *
 * @returns Average compactness using cosine distance (1 - similarity)
 */
export function computeCentroidCompactness(
	embeddings: Map<string, number[]>,
	clusters: EmbeddingCluster[],
): {overall: number; perCluster: Array<{clusterId: string; compactness: number; noteCount: number}>} {
	const perCluster: Array<{clusterId: string; compactness: number; noteCount: number}> = [];
	let totalDistance = 0;
	let totalNotes = 0;

	for (const cluster of clusters) {
		if (cluster.noteIds.length === 0 || !cluster.centroid) {
			perCluster.push({
				clusterId: cluster.id,
				compactness: 0,
				noteCount: 0,
			});
			continue;
		}

		let sumDistance = 0;
		let count = 0;

		for (const noteId of cluster.noteIds) {
			const embedding = embeddings.get(noteId);
			if (!embedding) continue;

			// Use cosine distance (1 - similarity) for consistency with embeddings
			sumDistance += 1 - cosineSimilarity(embedding, cluster.centroid);
			count++;
		}

		const clusterCompactness = count > 0 ? sumDistance / count : 0;
		perCluster.push({
			clusterId: cluster.id,
			compactness: clusterCompactness,
			noteCount: count,
		});

		totalDistance += sumDistance;
		totalNotes += count;
	}

	const overall = totalNotes > 0 ? totalDistance / totalNotes : 0;

	return {overall, perCluster};
}

/**
 * Compute all semantic coherence metrics
 */
export function computeSemanticMetrics(
	embeddings: Map<string, number[]>,
	clusters: EmbeddingCluster[],
): SemanticMetrics {
	const intraSimilarity = computeIntraClusterSimilarity(embeddings, clusters);
	const compactness = computeCentroidCompactness(embeddings, clusters);

	// Combine per-cluster data
	const perClusterCoherence = clusters.map((cluster) => {
		const intra = intraSimilarity.perCluster.find((p) => p.clusterId === cluster.id);
		const compact = compactness.perCluster.find((p) => p.clusterId === cluster.id);

		return {
			clusterId: cluster.id,
			intraClusterSimilarity: intra?.similarity ?? 0,
			centroidCompactness: compact?.compactness ?? 0,
			noteCount: cluster.noteIds.length,
		};
	});

	return {
		avgIntraClusterSimilarity: intraSimilarity.overall,
		avgInterClusterDistance: computeInterClusterDistance(clusters),
		avgCentroidCompactness: compactness.overall,
		perClusterCoherence,
	};
}
