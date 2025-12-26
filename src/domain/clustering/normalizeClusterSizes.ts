import type { ResolvedLinks } from '@/ports/IMetadataProvider';
import { createCluster, generateClusterId, type Cluster, type ClusteringConfig } from './types';
import { calculateLinkDensity } from './analyzeLinks';

/**
 * Normalizes cluster sizes by splitting large clusters and merging small ones
 *
 * @param clusters - Array of clusters to normalize
 * @param resolvedLinks - Map of source -> { target -> count }
 * @param config - Clustering configuration
 * @returns Normalized array of clusters
 */
export function normalizeClusterSizes(
  clusters: Cluster[],
  resolvedLinks: ResolvedLinks,
  config: ClusteringConfig
): Cluster[] {
  let result: Cluster[] = [];

  // First pass: split oversized clusters
  for (const cluster of clusters) {
    if (cluster.noteIds.length > config.maxClusterSize) {
      const split = splitLargeCluster(cluster, resolvedLinks, config);
      result.push(...split);
    } else {
      result.push(cluster);
    }
  }

  // Second pass: merge undersized clusters
  result = mergeSmallClusters(result, config);

  return result;
}

/**
 * Split a large cluster into smaller ones
 * Uses a simple strategy: divide into roughly equal parts
 */
export function splitLargeCluster(
  cluster: Cluster,
  resolvedLinks: ResolvedLinks,
  config: ClusteringConfig
): Cluster[] {
  const { noteIds } = cluster;

  // Don't split if already within limits
  if (noteIds.length <= config.maxClusterSize) {
    return [cluster];
  }

  const targetSize = Math.floor((config.minClusterSize + config.maxClusterSize) / 2);
  const numClusters = Math.ceil(noteIds.length / targetSize);

  if (numClusters <= 1) {
    return [cluster];
  }

  // Sort notes by their link density to keep related notes together
  const sortedNotes = sortNotesByConnectivity(noteIds, resolvedLinks);

  // Split into roughly equal chunks
  const chunkSize = Math.ceil(sortedNotes.length / numClusters);
  const result: Cluster[] = [];

  for (let i = 0; i < numClusters; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, sortedNotes.length);
    const chunkNoteIds = sortedNotes.slice(start, end);

    if (chunkNoteIds.length === 0) continue;

    const density = calculateLinkDensity(chunkNoteIds, resolvedLinks, config);

    result.push(
      createCluster({
        id: generateClusterId(),
        noteIds: chunkNoteIds,
        folderPath: cluster.folderPath,
        dominantTags: cluster.dominantTags,
        candidateNames: [
          ...cluster.candidateNames,
          `Part ${i + 1}`,
        ],
        internalLinkDensity: density,
        reasons: [
          ...cluster.reasons,
          `Split oversized cluster (${cluster.noteIds.length} notes) into ${numClusters} parts`,
        ],
      })
    );
  }

  return result;
}

/**
 * Sort notes by their connectivity (number of links to other notes in the set)
 * Notes with more connections come first
 */
function sortNotesByConnectivity(
  noteIds: string[],
  resolvedLinks: ResolvedLinks
): string[] {
  const noteSet = new Set(noteIds);
  const connectivity = new Map<string, number>();

  for (const noteId of noteIds) {
    let count = 0;
    const targets = resolvedLinks[noteId];
    if (targets) {
      for (const target of Object.keys(targets)) {
        if (noteSet.has(target)) {
          count += targets[target];
        }
      }
    }
    connectivity.set(noteId, count);
  }

  return [...noteIds].sort((a, b) => {
    const connA = connectivity.get(a) || 0;
    const connB = connectivity.get(b) || 0;
    return connB - connA;
  });
}

/**
 * Merge clusters that are too small
 * Merges are done greedily, preferring clusters with similar properties
 */
export function mergeSmallClusters(
  clusters: Cluster[],
  config: ClusteringConfig
): Cluster[] {
  const small: Cluster[] = [];
  const result: Cluster[] = [];

  // Separate small and regular clusters
  for (const cluster of clusters) {
    if (cluster.noteIds.length < config.minClusterSize) {
      small.push(cluster);
    } else {
      result.push(cluster);
    }
  }

  // If no small clusters, return as-is
  if (small.length === 0) {
    return result;
  }

  // Try to merge small clusters with each other
  const merged = mergeSmallClustersGreedy(small, config);
  result.push(...merged);

  return result;
}

/**
 * Greedily merge small clusters based on similarity
 */
function mergeSmallClustersGreedy(
  clusters: Cluster[],
  config: ClusteringConfig
): Cluster[] {
  if (clusters.length === 0) return [];
  if (clusters.length === 1) return clusters;

  // Sort by folder path for grouping similar clusters
  const sorted = [...clusters].sort((a, b) => a.folderPath.localeCompare(b.folderPath));

  const result: Cluster[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Check if merging would exceed max size
    const mergedSize = current.noteIds.length + next.noteIds.length;

    // Check similarity (same folder path or overlapping tags)
    const isSimilar =
      current.folderPath === next.folderPath ||
      hasOverlappingTags(current.dominantTags, next.dominantTags);

    if (isSimilar && mergedSize <= config.maxClusterSize) {
      // Merge
      current = mergeClusters(current, next);
    } else {
      // Save current and start new
      result.push(current);
      current = next;
    }
  }

  result.push(current);

  return result;
}

/**
 * Check if two tag arrays have overlapping elements
 */
function hasOverlappingTags(tagsA: string[], tagsB: string[]): boolean {
  if (tagsA.length === 0 || tagsB.length === 0) {
    return false;
  }
  const setA = new Set(tagsA);
  return tagsB.some((tag) => setA.has(tag));
}

/**
 * Merge two clusters into one
 */
function mergeClusters(a: Cluster, b: Cluster): Cluster {
  const noteIds = [...new Set([...a.noteIds, ...b.noteIds])];
  const dominantTags = [...new Set([...a.dominantTags, ...b.dominantTags])];
  const candidateNames = [...new Set([...a.candidateNames, ...b.candidateNames])];

  // Average link density weighted by size
  const totalSize = a.noteIds.length + b.noteIds.length;
  const avgDensity =
    (a.internalLinkDensity * a.noteIds.length + b.internalLinkDensity * b.noteIds.length) /
    totalSize;

  // Use common folder path
  const folderPath = findCommonPath(a.folderPath, b.folderPath);

  // Combine reasons and add merge reason
  const combinedReasons = [...new Set([...a.reasons, ...b.reasons])];
  combinedReasons.push(
    `Merged undersized clusters: ${a.noteIds.length} + ${b.noteIds.length} notes`
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
 * Find common prefix of two paths
 */
function findCommonPath(a: string, b: string): string {
  if (a === b) return a;
  if (!a || !b) return '';

  const partsA = a.split('/');
  const partsB = b.split('/');
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
