import type { ResolvedLinks } from '@/ports/IMetadataProvider';
import type { Cluster, ClusteringConfig } from './types';

/**
 * Analyzes link density within clusters and updates the internalLinkDensity field
 * Uses sampling for large clusters to maintain performance
 *
 * @param clusters - Array of clusters to analyze
 * @param resolvedLinks - Map of source -> { target -> count }
 * @param config - Clustering configuration
 * @returns Clusters with updated internalLinkDensity
 */
export function analyzeLinks(
  clusters: Cluster[],
  resolvedLinks: ResolvedLinks,
  config: ClusteringConfig
): Cluster[] {
  return clusters.map((cluster) => {
    const density = calculateLinkDensity(cluster.noteIds, resolvedLinks, config);
    return {
      ...cluster,
      internalLinkDensity: density,
    };
  });
}

/**
 * Calculate the internal link density for a set of notes
 * Link density = actual internal links / possible internal links
 *
 * For large clusters, uses sampling for performance
 */
export function calculateLinkDensity(
  noteIds: string[],
  resolvedLinks: ResolvedLinks,
  config: ClusteringConfig
): number {
  if (noteIds.length < 2) {
    return 0;
  }

  // Create a set for O(1) lookup
  const noteSet = new Set(noteIds);

  // For large clusters, sample a subset
  const sampled =
    noteIds.length > config.sampleSize
      ? sampleArray(noteIds, config.sampleSize)
      : noteIds;

  let internalLinks = 0;

  for (const noteId of sampled) {
    const targets = resolvedLinks[noteId];
    if (!targets) continue;

    for (const target of Object.keys(targets)) {
      if (noteSet.has(target)) {
        internalLinks += targets[target];
      }
    }
  }

  // Possible links in a directed graph: n * (n - 1)
  // For sampled data, scale accordingly
  const n = sampled.length;
  const possibleLinks = n * (noteIds.length - 1);

  if (possibleLinks === 0) {
    return 0;
  }

  // Scale up if we sampled
  const scaleFactor = noteIds.length / sampled.length;
  const estimatedTotalLinks = internalLinks * scaleFactor;
  const totalPossibleLinks = noteIds.length * (noteIds.length - 1);

  return Math.min(1, estimatedTotalLinks / totalPossibleLinks);
}

/**
 * Count links between two clusters
 * Returns the number of notes in cluster A that link to notes in cluster B
 */
export function countInterClusterLinks(
  clusterA: Cluster,
  clusterB: Cluster,
  resolvedLinks: ResolvedLinks
): number {
  const setB = new Set(clusterB.noteIds);
  let count = 0;

  for (const noteId of clusterA.noteIds) {
    const targets = resolvedLinks[noteId];
    if (!targets) continue;

    for (const target of Object.keys(targets)) {
      if (setB.has(target)) {
        count++;
        break; // Count each source note only once
      }
    }
  }

  return count;
}

/**
 * Calculate bidirectional link overlap between two clusters
 * Returns a value between 0 and 1
 */
export function calculateLinkOverlap(
  clusterA: Cluster,
  clusterB: Cluster,
  resolvedLinks: ResolvedLinks
): number {
  const linksAtoB = countInterClusterLinks(clusterA, clusterB, resolvedLinks);
  const linksBtoA = countInterClusterLinks(clusterB, clusterA, resolvedLinks);

  const totalLinks = linksAtoB + linksBtoA;
  const maxPossible = clusterA.noteIds.length + clusterB.noteIds.length;

  if (maxPossible === 0) {
    return 0;
  }

  return totalLinks / maxPossible;
}

/**
 * Randomly sample elements from an array
 * Uses Fisher-Yates partial shuffle for efficiency
 */
function sampleArray<T>(array: T[], count: number): T[] {
  if (count >= array.length) {
    return [...array];
  }

  const result = [...array];
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (result.length - i));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.slice(0, count);
}
