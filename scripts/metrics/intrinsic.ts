/**
 * Tier 1: Intrinsic Clustering Metrics
 * Automated metrics that don't require ground truth labels
 */

import {cosineSimilarity, euclideanDistance} from '../../src/domain/clustering/centroidCalculator';
import type {EmbeddingCluster} from '../../src/domain/clustering/types';
import type {IntrinsicMetrics} from './types';

/**
 * Compute silhouette score for clustering
 *
 * For each sample i:
 *   a(i) = mean distance to other points in same cluster
 *   b(i) = min(mean distance to points in each other cluster)
 *   s(i) = (b(i) - a(i)) / max(a(i), b(i))
 *
 * Final score = mean of all s(i)
 *
 * Uses cosine distance (1 - similarity) on original embeddings.
 *
 * @returns Silhouette score in range [-1, 1], higher is better
 */
export function computeSilhouetteScore(
	embeddings: Map<string, number[]>,
	clusters: EmbeddingCluster[],
): number {
	if (clusters.length < 2) {
		// Need at least 2 clusters to compute silhouette
		return 0;
	}

	const silhouetteScores: number[] = [];

	// Build a map of noteId -> cluster index for quick lookup
	const noteToCluster = new Map<string, number>();
	for (let clusterIdx = 0; clusterIdx < clusters.length; clusterIdx++) {
		for (const noteId of clusters[clusterIdx].noteIds) {
			noteToCluster.set(noteId, clusterIdx);
		}
	}

	// For each note in each cluster
	for (let clusterIdx = 0; clusterIdx < clusters.length; clusterIdx++) {
		const cluster = clusters[clusterIdx];
		if (cluster.noteIds.length < 2) {
			// Single-point clusters have silhouette = 0
			for (const noteId of cluster.noteIds) {
				silhouetteScores.push(0);
			}
			continue;
		}

		for (const noteId of cluster.noteIds) {
			const embedding = embeddings.get(noteId);
			if (!embedding) continue;

			// a(i) = mean distance to other points in same cluster
			let sumIntraDistance = 0;
			let intraCount = 0;
			for (const otherNoteId of cluster.noteIds) {
				if (otherNoteId === noteId) continue;
				const otherEmbedding = embeddings.get(otherNoteId);
				if (!otherEmbedding) continue;
				sumIntraDistance += 1 - cosineSimilarity(embedding, otherEmbedding);
				intraCount++;
			}
			const a = intraCount > 0 ? sumIntraDistance / intraCount : 0;

			// b(i) = min(mean distance to points in each other cluster)
			let minInterDistance = Number.POSITIVE_INFINITY;
			for (let otherClusterIdx = 0; otherClusterIdx < clusters.length; otherClusterIdx++) {
				if (otherClusterIdx === clusterIdx) continue;
				const otherCluster = clusters[otherClusterIdx];
				if (otherCluster.noteIds.length === 0) continue;

				let sumInterDistance = 0;
				let interCount = 0;
				for (const otherNoteId of otherCluster.noteIds) {
					const otherEmbedding = embeddings.get(otherNoteId);
					if (!otherEmbedding) continue;
					sumInterDistance += 1 - cosineSimilarity(embedding, otherEmbedding);
					interCount++;
				}
				const meanInterDistance = interCount > 0 ? sumInterDistance / interCount : 0;
				if (meanInterDistance < minInterDistance) {
					minInterDistance = meanInterDistance;
				}
			}
			const b = minInterDistance === Number.POSITIVE_INFINITY ? 0 : minInterDistance;

			// s(i) = (b - a) / max(a, b)
			const maxAB = Math.max(a, b);
			const silhouette = maxAB > 0 ? (b - a) / maxAB : 0;
			silhouetteScores.push(silhouette);
		}
	}

	if (silhouetteScores.length === 0) {
		return 0;
	}

	// Return mean silhouette score
	return silhouetteScores.reduce((sum, s) => sum + s, 0) / silhouetteScores.length;
}

/**
 * Compute Davies-Bouldin index
 *
 * For each cluster pair (i, j):
 *   R(i,j) = (S(i) + S(j)) / M(i,j)
 *   where S(i) = avg distance of points to centroid i
 *   and M(i,j) = distance between centroids i and j
 *
 * DB = (1/n) * sum(max_j(R(i,j))) for all i
 *
 * @returns Davies-Bouldin index (0+, lower is better)
 */
export function computeDaviesBouldinIndex(
	embeddings: Map<string, number[]>,
	clusters: EmbeddingCluster[],
): number {
	if (clusters.length < 2) {
		return 0;
	}

	// Compute scatter (S) for each cluster: avg distance from points to centroid
	const scatters: number[] = [];
	for (const cluster of clusters) {
		if (cluster.noteIds.length === 0 || !cluster.centroid) {
			scatters.push(0);
			continue;
		}

		let sumDistance = 0;
		let count = 0;
		for (const noteId of cluster.noteIds) {
			const embedding = embeddings.get(noteId);
			if (!embedding) continue;
			sumDistance += euclideanDistance(embedding, cluster.centroid);
			count++;
		}
		scatters.push(count > 0 ? sumDistance / count : 0);
	}

	// Compute DB index
	let dbSum = 0;
	for (let i = 0; i < clusters.length; i++) {
		let maxR = 0;
		for (let j = 0; j < clusters.length; j++) {
			if (i === j) continue;
			if (!clusters[i].centroid || !clusters[j].centroid) continue;

			// M(i,j) = distance between centroids
			const m = euclideanDistance(clusters[i].centroid, clusters[j].centroid);
			if (m === 0) continue;

			// R(i,j) = (S(i) + S(j)) / M(i,j)
			const r = (scatters[i] + scatters[j]) / m;
			if (r > maxR) {
				maxR = r;
			}
		}
		dbSum += maxR;
	}

	return dbSum / clusters.length;
}

/**
 * Compute Gini coefficient for cluster size distribution
 *
 * G = (sum_i sum_j |x_i - x_j|) / (2 * n^2 * mean)
 *
 * @returns Gini coefficient in range [0, 1], where 0 is perfect equality
 */
export function computeClusterSizeGini(clusterSizes: number[]): number {
	if (clusterSizes.length <= 1) {
		return 0;
	}

	const n = clusterSizes.length;
	const sum = clusterSizes.reduce((a, b) => a + b, 0);
	const mean = sum / n;

	if (mean === 0) {
		return 0;
	}

	let sumDiff = 0;
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			sumDiff += Math.abs(clusterSizes[i] - clusterSizes[j]);
		}
	}

	return sumDiff / (2 * n * n * mean);
}

/**
 * Compute noise ratio (percentage of notes not assigned to any cluster)
 */
export function computeNoiseRatio(noiseCount: number, totalNotes: number): number {
	if (totalNotes === 0) {
		return 0;
	}
	return noiseCount / totalNotes;
}

/**
 * Compute basic cluster size statistics
 */
export function computeClusterSizeStats(clusterSizes: number[]): {
	avg: number;
	median: number;
	stdDev: number;
} {
	if (clusterSizes.length === 0) {
		return {avg: 0, median: 0, stdDev: 0};
	}

	const n = clusterSizes.length;
	const sum = clusterSizes.reduce((a, b) => a + b, 0);
	const avg = sum / n;

	// Median
	const sorted = [...clusterSizes].sort((a, b) => a - b);
	const median =
		n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

	// Standard deviation
	const sumSquaredDiff = clusterSizes.reduce((acc, size) => acc + (size - avg) ** 2, 0);
	const stdDev = Math.sqrt(sumSquaredDiff / n);

	return {avg, median, stdDev};
}

/**
 * Compute all intrinsic metrics
 */
export function computeIntrinsicMetrics(
	embeddings: Map<string, number[]>,
	clusters: EmbeddingCluster[],
	noiseNotes: string[],
	totalNotes: number,
): IntrinsicMetrics {
	const clusterSizes = clusters.map((c) => c.noteIds.length);
	const sizeStats = computeClusterSizeStats(clusterSizes);

	return {
		silhouetteScore: computeSilhouetteScore(embeddings, clusters),
		daviesBouldinIndex: computeDaviesBouldinIndex(embeddings, clusters),
		noiseRatio: computeNoiseRatio(noiseNotes.length, totalNotes),
		clusterSizeGini: computeClusterSizeGini(clusterSizes),
		clusterCount: clusters.length,
		avgClusterSize: sizeStats.avg,
		medianClusterSize: sizeStats.median,
		clusterSizeStdDev: sizeStats.stdDev,
	};
}
