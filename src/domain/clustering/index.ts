/**
 * Clustering Domain Module
 *
 * This module provides algorithms for clustering notes based on:
 * - Folder structure
 * - Tags
 * - Links between notes
 * - Title keywords (with CJK support)
 */

// Types
export type { Cluster, ClusteringConfig, ClusteringInput } from './types';
export { DEFAULT_CLUSTERING_CONFIG, createCluster, generateClusterId } from './types';

// Algorithms
export { clusterByFolder, getFoldersByDepth, isSubfolderOf } from './clusterByFolder';
export { refineByTags, getTagCounts, findDominantTags, normalizeTag } from './refineByTags';
export {
	analyzeLinks,
	calculateLinkDensity,
	countInterClusterLinks,
	calculateLinkOverlap,
} from './analyzeLinks';
export {
	splitByLinkCommunities,
	buildBidirectionalAdjacency,
	findConnectedComponents,
	findCoreNotes,
	assignNotesToCores,
} from './splitByLinkCommunities';
export {
	mergeRelatedClusters,
	areSimilarSize,
	mergeTwoClusters,
	findCommonFolderPath,
} from './mergeRelatedClusters';
export {
	groupByTitleKeywords,
	extractTitleKeywords,
	detectLanguage,
	isCJK,
	segmentCJK,
	extractEnglishKeywords,
} from './groupByTitleKeywords';
export {
	normalizeClusterSizes,
	splitLargeCluster,
	mergeSmallClusters,
} from './normalizeClusterSizes';
export {
	identifySpecialNotes,
	isTemplateNote,
	isStubNote,
	assignStubNotesToClusters,
	createTemplatesCluster,
	preprocessSpecialNotes,
} from './handleSpecialNotes';

// Pipeline
export { runClusteringPipeline } from './pipeline';
