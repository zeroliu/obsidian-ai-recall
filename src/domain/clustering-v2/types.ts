import type { Cluster } from '@/domain/clustering/types';

/**
 * UMAP dimensionality reduction configuration
 */
export interface UMAPConfig {
	/** Number of nearest neighbors for local structure (default: 15) */
	nNeighbors: number;
	/** Minimum distance between points in low-dim space (default: 0.1) */
	minDist: number;
	/** Number of dimensions in output (default: 10) */
	nComponents: number;
	/** Distance metric to use (default: 'cosine') */
	metric: 'cosine' | 'euclidean';
}

/**
 * Default UMAP configuration
 */
export const DEFAULT_UMAP_CONFIG: UMAPConfig = {
	nNeighbors: 15,
	minDist: 0.1,
	nComponents: 10,
	metric: 'cosine',
};

/**
 * HDBSCAN clustering configuration
 */
export interface HDBSCANConfig {
	/** Minimum cluster size for a group to be considered a cluster (default: 5) */
	minClusterSize: number;
	/** Minimum samples for core point definition (default: 3) */
	minSamples: number;
}

/**
 * Default HDBSCAN configuration
 */
export const DEFAULT_HDBSCAN_CONFIG: HDBSCANConfig = {
	minClusterSize: 5,
	minSamples: 3,
};

/**
 * Cluster assignment result from HDBSCAN
 */
export interface ClusterAssignment {
	/** Index of the point in the input array */
	index: number;
	/** Cluster label (-1 for noise) */
	label: number;
}

/**
 * Embedding-based cluster with centroid information
 * Extends legacy Cluster with embedding-specific fields
 */
export interface EmbeddingCluster extends Cluster {
	/** Cluster centroid in embedding space */
	centroid: number[];
	/** Original centroid before any updates (for evolution tracking) */
	originalCentroid?: number[];
	/** Note paths closest to centroid (for LLM context) */
	representativeNotes: string[];
}

/**
 * Configuration for the clustering-v2 pipeline
 */
export interface ClusteringV2Config {
	/** UMAP configuration */
	umap: UMAPConfig;
	/** HDBSCAN configuration */
	hdbscan: HDBSCANConfig;
	/** Threshold for incremental vs full re-clustering (default: 0.05 = 5%) */
	incrementalThreshold: number;
	/** Minimum notes required to run clustering (default: 10) */
	minNotesForClustering: number;
	/** Number of representative notes to select per cluster (default: 5) */
	representativeCount: number;
	/** Minimum tag frequency to be considered dominant (default: 0.3) */
	dominantTagThreshold: number;
	/** Minimum cosine similarity for incremental note assignment (default: 0.3) */
	minAssignmentSimilarity: number;
}

/**
 * Default clustering-v2 configuration
 */
export const DEFAULT_CLUSTERING_V2_CONFIG: ClusteringV2Config = {
	umap: DEFAULT_UMAP_CONFIG,
	hdbscan: DEFAULT_HDBSCAN_CONFIG,
	incrementalThreshold: 0.05,
	minNotesForClustering: 10,
	representativeCount: 5,
	dominantTagThreshold: 0.3,
	minAssignmentSimilarity: 0.3,
};

/**
 * Input for the clustering-v2 pipeline
 */
export interface ClusteringV2Input {
	/** Embedded notes with their vectors */
	embeddings: Array<{
		notePath: string;
		embedding: number[];
	}>;
	/** Tags for each note (for metadata) */
	noteTags: Map<string, string[]>;
	/** Links for each note (for link density) */
	noteLinks: Map<string, string[]>;
	/** Configuration */
	config: ClusteringV2Config;
}

/**
 * Result of the clustering-v2 pipeline
 */
export interface ClusteringV2Result {
	/** Embedding-based clusters */
	clusters: EmbeddingCluster[];
	/** Notes that couldn't be clustered (noise) */
	noiseNotes: string[];
	/** Statistics about the clustering run */
	stats: {
		/** Total notes processed */
		totalNotes: number;
		/** Number of clusters formed */
		clusterCount: number;
		/** Notes assigned to noise */
		noiseCount: number;
		/** Whether this was a full or incremental run */
		wasIncremental: boolean;
	};
}

/**
 * State saved between clustering runs for incremental updates
 */
export interface ClusteringState {
	/** Current clusters with their noteIds (needed for incremental updates) */
	clusters: EmbeddingCluster[];
	/** Current cluster centroids (in original embedding space for cosine similarity) */
	centroids: Map<string, number[]>;
	/** Last full clustering timestamp */
	lastFullClusteringAt: number;
	/** Note hashes from last run (for change detection) */
	noteHashes: Map<string, string>;
}

/**
 * Convert an EmbeddingCluster to a legacy Cluster
 * Useful for compatibility with existing LLM pipeline
 */
export function toLegacyCluster(embeddingCluster: EmbeddingCluster): Cluster {
	return {
		id: embeddingCluster.id,
		candidateNames: embeddingCluster.candidateNames,
		noteIds: embeddingCluster.noteIds,
		dominantTags: embeddingCluster.dominantTags,
		folderPath: embeddingCluster.folderPath,
		internalLinkDensity: embeddingCluster.internalLinkDensity,
		createdAt: embeddingCluster.createdAt,
		reasons: embeddingCluster.reasons,
	};
}

/**
 * Generate a unique cluster ID for embedding-based clusters
 */
export function generateEmbeddingClusterId(): string {
	return `emb-cluster-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
