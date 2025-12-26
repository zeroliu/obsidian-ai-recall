import type { FileInfo } from '@/ports/IVaultProvider';
import type { FileMetadata, ResolvedLinks } from '@/ports/IMetadataProvider';
import type { Cluster, ClusteringConfig } from './types';
import { DEFAULT_CLUSTERING_CONFIG } from './types';
import { clusterByFolder } from './clusterByFolder';
import { refineByTags } from './refineByTags';
import { analyzeLinks } from './analyzeLinks';
import { mergeRelatedClusters } from './mergeRelatedClusters';
import { groupByTitleKeywords } from './groupByTitleKeywords';
import { normalizeClusterSizes } from './normalizeClusterSizes';

/**
 * Input for the clustering pipeline
 */
export interface PipelineInput {
  files: FileInfo[];
  metadata: Map<string, FileMetadata>;
  resolvedLinks: ResolvedLinks;
  config?: Partial<ClusteringConfig>;
}

/**
 * Result from the clustering pipeline
 */
export interface PipelineResult {
  clusters: Cluster[];
  stats: PipelineStats;
}

/**
 * Statistics about the clustering run
 */
export interface PipelineStats {
  totalNotes: number;
  totalClusters: number;
  averageClusterSize: number;
  minClusterSize: number;
  maxClusterSize: number;
}

/**
 * Run the complete clustering pipeline
 *
 * The pipeline executes the following steps:
 * 1. Group notes by folder (initial clustering)
 * 2. Refine clusters by dominant tags
 * 3. Analyze link density within clusters
 * 4. Merge highly-connected clusters
 * 5. Further refine by title keywords
 * 6. Normalize cluster sizes (split large, merge small)
 *
 * @param input - Pipeline input containing files, metadata, and config
 * @returns Pipeline result with clusters and statistics
 */
export function runClusteringPipeline(input: PipelineInput): PipelineResult {
  const config: ClusteringConfig = {
    ...DEFAULT_CLUSTERING_CONFIG,
    ...input.config,
  };

  const { files, metadata, resolvedLinks } = input;

  // Create file map for quick lookups
  const fileMap = new Map<string, FileInfo>();
  for (const file of files) {
    fileMap.set(file.path, file);
  }

  // Step 1: Initial clustering by folder
  let clusters = clusterByFolder(files, config);

  // Step 2: Refine by tags
  clusters = refineByTags(clusters, metadata, config);

  // Step 3: Analyze link density
  clusters = analyzeLinks(clusters, resolvedLinks, config);

  // Step 4: Merge related clusters based on links
  clusters = mergeRelatedClusters(clusters, resolvedLinks, config);

  // Step 5: Further refine by title keywords
  clusters = groupByTitleKeywords(clusters, fileMap, config);

  // Step 6: Normalize cluster sizes
  clusters = normalizeClusterSizes(clusters, resolvedLinks, config);

  // Calculate statistics
  const stats = calculateStats(clusters);

  return {
    clusters,
    stats,
  };
}

/**
 * Calculate statistics about the clusters
 */
function calculateStats(clusters: Cluster[]): PipelineStats {
  if (clusters.length === 0) {
    return {
      totalNotes: 0,
      totalClusters: 0,
      averageClusterSize: 0,
      minClusterSize: 0,
      maxClusterSize: 0,
    };
  }

  const sizes = clusters.map((c) => c.noteIds.length);
  const totalNotes = sizes.reduce((sum, size) => sum + size, 0);

  return {
    totalNotes,
    totalClusters: clusters.length,
    averageClusterSize: totalNotes / clusters.length,
    minClusterSize: Math.min(...sizes),
    maxClusterSize: Math.max(...sizes),
  };
}
