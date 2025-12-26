import type { FileInfo } from '@/ports/IVaultProvider';
import { createCluster, type Cluster, type ClusteringConfig } from './types';

/**
 * Groups files by their folder path
 * This is the first pass of clustering - a simple but effective heuristic
 *
 * @param files - Array of file info objects
 * @param config - Clustering configuration
 * @returns Array of clusters, one per folder (including root)
 */
export function clusterByFolder(files: FileInfo[], _config: ClusteringConfig): Cluster[] {
  // Group files by folder
  const folderMap = new Map<string, string[]>();

  for (const file of files) {
    const folder = file.folder || '/'; // Use '/' for root-level files
    const existing = folderMap.get(folder) || [];
    existing.push(file.path);
    folderMap.set(folder, existing);
  }

  // Convert to clusters
  const clusters: Cluster[] = [];

  for (const [folder, noteIds] of folderMap.entries()) {
    // Generate candidate names from folder path
    const candidateNames = generateFolderCandidateNames(folder);
    const folderDisplay = folder === '/' ? 'root' : `'${folder}'`;

    clusters.push(
      createCluster({
        noteIds,
        folderPath: folder === '/' ? '' : folder,
        candidateNames,
        reasons: [`Grouped by folder: ${folderDisplay} (${noteIds.length} notes)`],
      })
    );
  }

  return clusters;
}

/**
 * Generate candidate names for a cluster based on folder path
 * These will be used by the LLM to help name the cluster
 */
function generateFolderCandidateNames(folder: string): string[] {
  if (folder === '/' || folder === '') {
    return ['Root', 'Uncategorized', 'General'];
  }

  const parts = folder.split('/').filter(Boolean);
  const names: string[] = [];

  // Add the deepest folder name
  const deepest = parts[parts.length - 1];
  names.push(formatFolderName(deepest));

  // Add full path as a candidate if nested
  if (parts.length > 1) {
    names.push(parts.map(formatFolderName).join(' / '));
  }

  // Add parent context if available
  if (parts.length > 1) {
    const parent = parts[parts.length - 2];
    names.push(`${formatFolderName(parent)}: ${formatFolderName(deepest)}`);
  }

  return names;
}

/**
 * Format a folder name for display
 * Handles common naming conventions
 */
function formatFolderName(name: string): string {
  return (
    name
      // Replace common separators with spaces
      .replace(/[-_]/g, ' ')
      // Capitalize first letter of each word
      .replace(/\b\w/g, (c) => c.toUpperCase())
      // Trim whitespace
      .trim()
  );
}

/**
 * Get folders sorted by depth (deepest first)
 * Useful for nested folder processing
 */
export function getFoldersByDepth(files: FileInfo[]): string[] {
  const folders = new Set<string>();

  for (const file of files) {
    if (file.folder) {
      folders.add(file.folder);
    }
  }

  return Array.from(folders).sort((a, b) => {
    const depthA = a.split('/').length;
    const depthB = b.split('/').length;
    return depthB - depthA; // Deepest first
  });
}

/**
 * Check if a folder is a subfolder of another
 */
export function isSubfolderOf(child: string, parent: string): boolean {
  if (parent === '' || parent === '/') {
    return child !== '' && child !== '/';
  }
  return child.startsWith(`${parent}/`);
}
