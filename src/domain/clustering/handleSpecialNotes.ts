import type { FileMetadata, ResolvedLinks } from '@/ports/IMetadataProvider';
import type { FileInfo } from '@/ports/IVaultProvider';
import type { Cluster } from './types';

/**
 * Configuration for handling special notes
 */
export interface SpecialNotesConfig {
	/** Minimum word count to not be considered a stub (default: 50) */
	stubWordThreshold: number;
	/** Patterns that identify template notes */
	templatePatterns: RegExp[];
	/** Whether to exclude template notes from clustering */
	excludeTemplates: boolean;
}

/**
 * Default configuration for special notes handling
 */
export const DEFAULT_SPECIAL_NOTES_CONFIG: SpecialNotesConfig = {
	stubWordThreshold: 50,
	templatePatterns: [/^template/i, /template$/i, /^_template/i, /\.template$/i, /\/templates?\//i],
	excludeTemplates: true,
};

/**
 * Result of identifying special notes
 */
export interface SpecialNotesResult {
	/** Notes that should be clustered normally */
	regularNotes: string[];
	/** Stub notes (< threshold words, just links) */
	stubNotes: string[];
	/** Template/boilerplate notes */
	templateNotes: string[];
}

/**
 * Identify stub and template notes from a list of note IDs
 *
 * Stub notes: Notes with < 50 words that are mostly just links
 * Template notes: Notes matching template patterns
 *
 * @param noteIds - Array of note paths to analyze
 * @param metadata - Map of path -> metadata
 * @param files - Map of path -> file info
 * @param config - Special notes configuration
 * @returns Classification of notes
 */
export function identifySpecialNotes(
	noteIds: string[],
	metadata: Map<string, FileMetadata>,
	files: Map<string, FileInfo>,
	config: SpecialNotesConfig = DEFAULT_SPECIAL_NOTES_CONFIG,
): SpecialNotesResult {
	const regularNotes: string[] = [];
	const stubNotes: string[] = [];
	const templateNotes: string[] = [];

	for (const noteId of noteIds) {
		const meta = metadata.get(noteId);
		const file = files.get(noteId);

		// Check if it's a template
		if (isTemplateNote(noteId, file?.basename || '', config.templatePatterns)) {
			templateNotes.push(noteId);
			continue;
		}

		// Check if it's a stub (low word count, primarily links)
		if (meta && isStubNote(meta, config.stubWordThreshold)) {
			stubNotes.push(noteId);
			continue;
		}

		regularNotes.push(noteId);
	}

	return { regularNotes, stubNotes, templateNotes };
}

/**
 * Check if a note is a template based on path/name patterns
 */
export function isTemplateNote(path: string, basename: string, patterns: RegExp[]): boolean {
	for (const pattern of patterns) {
		if (pattern.test(path) || pattern.test(basename)) {
			return true;
		}
	}
	return false;
}

/**
 * Check if a note is a stub (low word count, primarily just links)
 * Stub notes are characterized by:
 * - Low word count (< threshold)
 * - High link-to-word ratio
 */
export function isStubNote(meta: FileMetadata, wordThreshold: number): boolean {
	// If word count is above threshold, not a stub
	if (meta.wordCount >= wordThreshold) {
		return false;
	}

	// If it has very few words and some links, it's likely a stub
	// (e.g., a note that just contains [[links]] to other notes)
	if (meta.wordCount < 20 && meta.links.length > 0) {
		return true;
	}

	// Notes with more links than meaningful words are likely stubs
	if (meta.links.length > meta.wordCount / 5) {
		return true;
	}

	return false;
}

/**
 * Assign stub notes to their most-linked note's cluster
 *
 * For each stub note, find the note it links to most and assign
 * it to the same cluster as that target note.
 *
 * @param stubNotes - Array of stub note paths
 * @param clusters - Current clusters (without stub notes)
 * @param resolvedLinks - Map of source -> { target -> count }
 * @param metadata - Map of path -> metadata
 * @returns Clusters with stub notes assigned
 */
export function assignStubNotesToClusters(
	stubNotes: string[],
	clusters: Cluster[],
	resolvedLinks: ResolvedLinks,
	_metadata: Map<string, FileMetadata>,
): Cluster[] {
	if (stubNotes.length === 0) {
		return clusters;
	}

	// Build a map of noteId -> cluster index for quick lookup
	const noteToCluster = new Map<string, number>();
	for (let i = 0; i < clusters.length; i++) {
		for (const noteId of clusters[i].noteIds) {
			noteToCluster.set(noteId, i);
		}
	}

	// Track stub notes to add to each cluster
	const stubAssignments = new Map<number, string[]>();
	const unassigned: string[] = [];

	for (const stubNote of stubNotes) {
		const targets = resolvedLinks[stubNote];
		let assignedCluster = -1;

		if (targets) {
			// Find the target with the most links
			let maxLinks = 0;
			let bestTarget = '';

			for (const [target, count] of Object.entries(targets)) {
				if (count > maxLinks && noteToCluster.has(target)) {
					maxLinks = count;
					bestTarget = target;
				}
			}

			if (bestTarget) {
				assignedCluster = noteToCluster.get(bestTarget) ?? -1;
			}
		}

		// If no outgoing links, check incoming links
		if (assignedCluster === -1) {
			for (const [source, targets] of Object.entries(resolvedLinks)) {
				if (targets[stubNote] && noteToCluster.has(source)) {
					assignedCluster = noteToCluster.get(source) ?? -1;
					break;
				}
			}
		}

		if (assignedCluster >= 0) {
			const existing = stubAssignments.get(assignedCluster) || [];
			existing.push(stubNote);
			stubAssignments.set(assignedCluster, existing);
		} else {
			unassigned.push(stubNote);
		}
	}

	// Add stub notes to their assigned clusters
	const result = clusters.map((cluster, index) => {
		const stubs = stubAssignments.get(index);
		if (stubs && stubs.length > 0) {
			return {
				...cluster,
				noteIds: [...cluster.noteIds, ...stubs],
				reasons: [...cluster.reasons, `Assigned ${stubs.length} stub notes`],
			};
		}
		return cluster;
	});

	// Handle unassigned stub notes - they stay unassigned for now
	// They will be picked up by the final normalization step
	if (unassigned.length > 0) {
		// Add to the smallest cluster to balance sizes, or create uncategorized
		// For now, we'll leave them out - they're stub notes anyway
		// The pipeline will handle them in the normalization step
	}

	return result;
}

/**
 * Create a templates cluster from template notes
 */
export function createTemplatesCluster(
	templateNotes: string[],
	folderPath: string,
): Cluster | null {
	if (templateNotes.length === 0) {
		return null;
	}

	return {
		id: `cluster-templates-${Date.now()}`,
		noteIds: templateNotes,
		candidateNames: ['Templates', 'Boilerplate'],
		dominantTags: [],
		folderPath,
		internalLinkDensity: 0,
		createdAt: Date.now(),
		reasons: [`Template/boilerplate notes (${templateNotes.length} notes)`],
	};
}

/**
 * Pre-process files to separate special notes before clustering
 *
 * @param files - All files to process
 * @param metadata - Map of path -> metadata
 * @param config - Special notes configuration
 * @returns Files split into categories
 */
export function preprocessSpecialNotes(
	files: FileInfo[],
	metadata: Map<string, FileMetadata>,
	config: SpecialNotesConfig = DEFAULT_SPECIAL_NOTES_CONFIG,
): {
	regularFiles: FileInfo[];
	stubFiles: FileInfo[];
	templateFiles: FileInfo[];
} {
	const fileMap = new Map<string, FileInfo>();
	for (const file of files) {
		fileMap.set(file.path, file);
	}

	const result = identifySpecialNotes(
		files.map((f) => f.path),
		metadata,
		fileMap,
		config,
	);

	return {
		regularFiles: result.regularNotes
			.map((id) => fileMap.get(id))
			.filter((f): f is FileInfo => f !== undefined),
		stubFiles: result.stubNotes
			.map((id) => fileMap.get(id))
			.filter((f): f is FileInfo => f !== undefined),
		templateFiles: result.templateNotes
			.map((id) => fileMap.get(id))
			.filter((f): f is FileInfo => f !== undefined),
	};
}
