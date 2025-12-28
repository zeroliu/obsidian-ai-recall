/**
 * Clustering evaluation metrics types
 * For testing purposes only - not production code
 */

import type {UMAPConfig, HDBSCANConfig, EmbeddingCluster} from '../../src/domain/clustering/types';

/**
 * Tier 1: Intrinsic Clustering Metrics
 * Automated metrics that don't require ground truth labels
 */
export interface IntrinsicMetrics {
	/** Silhouette score (-1 to 1, higher is better). Target: >= 0.3 */
	silhouetteScore: number;
	/** Davies-Bouldin index (0+, lower is better). Target: < 1.5 */
	daviesBouldinIndex: number;
	/** Percentage of notes in noise cluster (0-1). Target: 5-20% (0.05-0.2) */
	noiseRatio: number;
	/** Gini coefficient of cluster sizes (0-1, lower is more equal). Target: < 0.6 */
	clusterSizeGini: number;
	/** Number of clusters formed */
	clusterCount: number;
	/** Average notes per cluster */
	avgClusterSize: number;
	/** Median cluster size */
	medianClusterSize: number;
	/** Standard deviation of cluster sizes */
	clusterSizeStdDev: number;
}

/**
 * Tier 2: Semantic Coherence Metrics
 * Measure whether clusters are semantically meaningful using embeddings
 */
export interface SemanticMetrics {
	/** Average cosine similarity between all pairs within clusters. Target: > 0.7 */
	avgIntraClusterSimilarity: number;
	/** Average distance between cluster centroids. Target: > 0.5 */
	avgInterClusterDistance: number;
	/** Average distance from notes to their cluster centroid. Target: < 0.3 */
	avgCentroidCompactness: number;
	/** Per-cluster breakdown */
	perClusterCoherence: Array<{
		clusterId: string;
		intraClusterSimilarity: number;
		centroidCompactness: number;
		noteCount: number;
	}>;
}

/**
 * Tier 3: Domain-Specific Metrics
 * Use Obsidian metadata as proxy ground truth
 */
export interface DomainMetrics {
	/** Percentage of notes sharing the dominant tag in their cluster (0-1). Target: >= 0.5 */
	tagHomogeneity: number;
	/** Percentage of notes from the most common folder in their cluster (0-1) */
	folderCoherence: number;
	/** Average internal link density across clusters (0-1) */
	avgInternalLinkDensity: number;
	/** Per-cluster tag distribution */
	perClusterTagHomogeneity: Array<{
		clusterId: string;
		dominantTag: string | null;
		homogeneityScore: number;
		noteCount: number;
	}>;
}

/**
 * Status for a single metric
 */
export type MetricStatus = 'good' | 'needs_improvement' | 'poor';

/**
 * Detailed status for a metric with value and target
 */
export interface MetricStatusDetail {
	value: number;
	target: string;
	status: MetricStatus;
}

/**
 * Status summary for key metrics (for agent decision-making)
 */
export interface MetricStatusSummary {
	silhouetteScore: MetricStatusDetail;
	noiseRatio: MetricStatusDetail;
	tagHomogeneity: MetricStatusDetail;
}

/**
 * Complete clustering evaluation result
 * NO composite score - metrics reported separately for agent analysis
 */
export interface ClusteringEvaluation {
	/** Configuration used for clustering */
	config: {
		umap: UMAPConfig;
		hdbscan: HDBSCANConfig;
	};
	/** Tier 1: Intrinsic metrics */
	intrinsic: IntrinsicMetrics;
	/** Tier 2: Semantic coherence metrics */
	semantic: SemanticMetrics;
	/** Tier 3: Domain-specific metrics */
	domain: DomainMetrics;
	/** Individual metric status for agent decision-making */
	status: MetricStatusSummary;
	/** Whether all target metrics are met */
	allTargetsMet: boolean;
	/** Timestamp when evaluation was performed */
	evaluatedAt: number;
}

/**
 * Input for evaluation functions
 */
export interface EvaluationInput {
	/** Embeddings map: notePath -> embedding vector */
	embeddings: Map<string, number[]>;
	/** Clusters from pipeline */
	clusters: EmbeddingCluster[];
	/** Notes in noise cluster */
	noiseNotes: string[];
	/** Tags for each note */
	noteTags: Map<string, string[]>;
	/** Total notes processed */
	totalNotes: number;
}

/**
 * Grid search result for a single configuration
 */
export interface GridSearchResult {
	config: {
		umap: {nNeighbors: number; minDist: number; nComponents: number};
		hdbscan: {minClusterSize: number; minSamples: number};
	};
	metrics: {
		silhouetteScore: number;
		noiseRatio: number;
		clusterCount: number;
		tagHomogeneity: number;
		avgLinkDensity: number;
		avgIntraClusterSimilarity: number;
	};
	timing: {
		umapMs: number;
		hdbscanMs: number;
		metricsMs: number;
	};
}

/**
 * Thresholds for metric status classification
 */
export const METRIC_THRESHOLDS = {
	silhouetteScore: {
		good: 0.3,
		needsImprovement: 0.1,
	},
	noiseRatio: {
		good: {min: 0.05, max: 0.2},
		needsImprovement: {min: 0.02, max: 0.3},
	},
	tagHomogeneity: {
		good: 0.5,
		needsImprovement: 0.3,
	},
} as const;
