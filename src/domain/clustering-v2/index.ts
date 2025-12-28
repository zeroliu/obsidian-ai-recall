// Types
export type {
	UMAPConfig,
	HDBSCANConfig,
	ClusterAssignment,
	EmbeddingCluster,
	ClusteringV2Config,
	ClusteringV2Input,
	ClusteringV2Result,
	ClusteringState,
} from './types';

export {
	DEFAULT_UMAP_CONFIG,
	DEFAULT_HDBSCAN_CONFIG,
	DEFAULT_CLUSTERING_V2_CONFIG,
	toLegacyCluster,
	generateEmbeddingClusterId,
} from './types';

// UMAP Reducer
export { UMAPReducer, reduceEmbeddings } from './umapReducer';
export type { UMAPResult } from './umapReducer';

// HDBSCAN Clusterer
export { HDBSCANClusterer, clusterPoints } from './hdbscanClusterer';
export type { HDBSCANResult } from './hdbscanClusterer';

// Centroid Calculator
export {
	computeCentroid,
	cosineSimilarity,
	euclideanDistance,
	selectRepresentatives,
	computeClusterCentroids,
	findNearestCentroid,
} from './centroidCalculator';
export type { ClusterCentroidResult } from './centroidCalculator';

// Incremental Updater
export {
	detectChanges,
	assignNotesToClusters,
	applyIncrementalUpdate,
	updateClusteringState,
} from './incrementalUpdater';
export type {
	ChangeDetectionResult,
	IncrementalUpdateResult,
	NoteAssignment,
} from './incrementalUpdater';

// Pipeline
export { ClusteringV2Pipeline, runClusteringV2Pipeline } from './pipeline';
export type { PipelineInput, PipelineResult } from './pipeline';
