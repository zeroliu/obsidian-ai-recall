/**
 * Clustering Evaluation Metrics
 * For testing purposes only - not production code
 *
 * This module provides comprehensive metrics for evaluating clustering quality:
 * - Tier 1: Intrinsic metrics (silhouette, Davies-Bouldin, noise ratio, Gini)
 * - Tier 2: Semantic coherence (intra-cluster similarity, inter-cluster distance)
 * - Tier 3: Domain metrics (tag homogeneity, folder coherence, link density)
 */

// Re-export types
export type {
	IntrinsicMetrics,
	SemanticMetrics,
	DomainMetrics,
	MetricStatus,
	MetricStatusDetail,
	MetricStatusSummary,
	ClusteringEvaluation,
	EvaluationInput,
	GridSearchResult,
} from './types';
export {METRIC_THRESHOLDS} from './types';

// Re-export intrinsic metrics
export {
	computeSilhouetteScore,
	computeDaviesBouldinIndex,
	computeClusterSizeGini,
	computeNoiseRatio,
	computeClusterSizeStats,
	computeIntrinsicMetrics,
} from './intrinsic';

// Re-export semantic metrics
export {
	computeIntraClusterSimilarity,
	computeInterClusterDistance,
	computeCentroidCompactness,
	computeSemanticMetrics,
} from './semantic';

// Re-export domain metrics
export {
	computeTagHomogeneity,
	computeFolderCoherence,
	computeAvgLinkDensity,
	computeDomainMetrics,
} from './domain';

import {computeIntrinsicMetrics} from './intrinsic';
import {computeSemanticMetrics} from './semantic';
import {computeDomainMetrics} from './domain';
import type {
	ClusteringEvaluation,
	EvaluationInput,
	MetricStatus,
	MetricStatusDetail,
	MetricStatusSummary,
} from './types';
import {METRIC_THRESHOLDS} from './types';
import type {UMAPConfig, HDBSCANConfig} from '../../src/domain/clustering/types';

/**
 * Evaluate metric status based on thresholds
 */
function evaluateSilhouetteStatus(value: number): MetricStatus {
	if (value >= METRIC_THRESHOLDS.silhouetteScore.good) {
		return 'good';
	}
	if (value >= METRIC_THRESHOLDS.silhouetteScore.needsImprovement) {
		return 'needs_improvement';
	}
	return 'poor';
}

function evaluateNoiseRatioStatus(value: number): MetricStatus {
	const {good, needsImprovement} = METRIC_THRESHOLDS.noiseRatio;
	if (value >= good.min && value <= good.max) {
		return 'good';
	}
	if (value >= needsImprovement.min && value <= needsImprovement.max) {
		return 'needs_improvement';
	}
	return 'poor';
}

function evaluateTagHomogeneityStatus(value: number): MetricStatus {
	if (value >= METRIC_THRESHOLDS.tagHomogeneity.good) {
		return 'good';
	}
	if (value >= METRIC_THRESHOLDS.tagHomogeneity.needsImprovement) {
		return 'needs_improvement';
	}
	return 'poor';
}

/**
 * Compute status summary for key metrics
 */
export function computeMetricStatus(
	silhouetteScore: number,
	noiseRatio: number,
	tagHomogeneity: number,
): MetricStatusSummary {
	return {
		silhouetteScore: {
			value: silhouetteScore,
			target: '>=0.3',
			status: evaluateSilhouetteStatus(silhouetteScore),
		},
		noiseRatio: {
			value: noiseRatio,
			target: '5-20%',
			status: evaluateNoiseRatioStatus(noiseRatio),
		},
		tagHomogeneity: {
			value: tagHomogeneity,
			target: '>=0.5',
			status: evaluateTagHomogeneityStatus(tagHomogeneity),
		},
	};
}

/**
 * Check if all target metrics are met
 */
export function checkAllTargetsMet(status: MetricStatusSummary): boolean {
	return (
		status.silhouetteScore.status === 'good' &&
		status.noiseRatio.status === 'good' &&
		status.tagHomogeneity.status === 'good'
	);
}

/**
 * Compute complete clustering evaluation
 *
 * @param input - Evaluation input with embeddings, clusters, noise notes, and tags
 * @param config - Clustering configuration used
 * @returns Complete evaluation with all metrics and status
 */
export function evaluateClustering(
	input: EvaluationInput,
	config: {umap: UMAPConfig; hdbscan: HDBSCANConfig},
): ClusteringEvaluation {
	const {embeddings, clusters, noiseNotes, noteTags, totalNotes} = input;

	// Compute all metrics
	const intrinsic = computeIntrinsicMetrics(embeddings, clusters, noiseNotes, totalNotes);
	const semantic = computeSemanticMetrics(embeddings, clusters);
	const domain = computeDomainMetrics(clusters, noteTags);

	// Compute status for key metrics
	const status = computeMetricStatus(
		intrinsic.silhouetteScore,
		intrinsic.noiseRatio,
		domain.tagHomogeneity,
	);

	return {
		config,
		intrinsic,
		semantic,
		domain,
		status,
		allTargetsMet: checkAllTargetsMet(status),
		evaluatedAt: Date.now(),
	};
}

/**
 * Format evaluation as a summary string for console output
 */
export function formatEvaluationSummary(evaluation: ClusteringEvaluation): string {
	const {intrinsic, semantic, domain, status} = evaluation;

	const statusIcon = (s: MetricStatus) => {
		switch (s) {
			case 'good':
				return '[GOOD]';
			case 'needs_improvement':
				return '[NEEDS_IMPROVEMENT]';
			case 'poor':
				return '[POOR]';
		}
	};

	const lines = [
		'=== Clustering Evaluation ===',
		'',
		'Tier 1: Intrinsic Metrics',
		`  Silhouette Score:     ${intrinsic.silhouetteScore.toFixed(4)} ${statusIcon(status.silhouetteScore.status)} (target: >=0.3)`,
		`  Davies-Bouldin Index: ${intrinsic.daviesBouldinIndex.toFixed(4)} (target: <1.5)`,
		`  Noise Ratio:          ${(intrinsic.noiseRatio * 100).toFixed(1)}% ${statusIcon(status.noiseRatio.status)} (target: 5-20%)`,
		`  Cluster Size Gini:    ${intrinsic.clusterSizeGini.toFixed(4)} (target: <0.6)`,
		`  Cluster Count:        ${intrinsic.clusterCount}`,
		`  Avg Cluster Size:     ${intrinsic.avgClusterSize.toFixed(1)}`,
		'',
		'Tier 2: Semantic Coherence',
		`  Intra-cluster Similarity: ${semantic.avgIntraClusterSimilarity.toFixed(4)} (target: >0.7)`,
		`  Inter-cluster Distance:   ${semantic.avgInterClusterDistance.toFixed(4)} (target: >0.5)`,
		`  Centroid Compactness:     ${semantic.avgCentroidCompactness.toFixed(4)} (target: <0.3)`,
		'',
		'Tier 3: Domain Metrics',
		`  Tag Homogeneity:     ${(domain.tagHomogeneity * 100).toFixed(1)}% ${statusIcon(status.tagHomogeneity.status)} (target: >=50%)`,
		`  Folder Coherence:    ${(domain.folderCoherence * 100).toFixed(1)}%`,
		`  Avg Link Density:    ${(domain.avgInternalLinkDensity * 100).toFixed(1)}%`,
		'',
		`All Targets Met: ${evaluation.allTargetsMet ? 'YES' : 'NO'}`,
	];

	return lines.join('\n');
}
