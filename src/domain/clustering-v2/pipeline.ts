import type { EmbeddedNote } from '@/domain/embedding/types';
import type { ResolvedLinks } from '@/ports/IMetadataProvider';
import type { FileInfo } from '@/ports/IVaultProvider';
import { computeCentroid, selectRepresentatives } from './centroidCalculator';
import { HDBSCANClusterer } from './hdbscanClusterer';
import { applyIncrementalUpdate, detectChanges, updateClusteringState } from './incrementalUpdater';
import {
	type ClusteringState,
	type ClusteringV2Config,
	type ClusteringV2Result,
	DEFAULT_CLUSTERING_V2_CONFIG,
	type EmbeddingCluster,
	generateEmbeddingClusterId,
} from './types';
import { UMAPReducer } from './umapReducer';

/**
 * Input for the clustering pipeline
 */
export interface PipelineInput {
	/** Embedded notes with their vectors */
	embeddedNotes: EmbeddedNote[];
	/** Tags for each note (path -> tags) */
	noteTags: Map<string, string[]>;
	/** Resolved links for link density calculation */
	resolvedLinks: ResolvedLinks;
	/** File info for each note */
	files: Map<string, FileInfo>;
	/** Previous clustering state for incremental updates */
	previousState: ClusteringState | null;
	/** Configuration */
	config?: Partial<ClusteringV2Config>;
}

/**
 * Result of the clustering pipeline
 */
export interface PipelineResult {
	/** Clustering result with clusters and stats */
	result: ClusteringV2Result;
	/** Updated clustering state for future runs */
	state: ClusteringState;
}

/**
 * Embedding-based clustering pipeline
 *
 * Orchestrates the full clustering flow:
 * 1. UMAP dimensionality reduction
 * 2. HDBSCAN clustering
 * 3. Centroid and representative computation
 * 4. Cluster metadata population
 *
 * Supports both full and incremental modes based on change detection.
 */
export class ClusteringV2Pipeline {
	private config: ClusteringV2Config;
	private umapReducer: UMAPReducer;
	private hdbscanClusterer: HDBSCANClusterer;

	constructor(config: Partial<ClusteringV2Config> = {}) {
		this.config = { ...DEFAULT_CLUSTERING_V2_CONFIG, ...config };
		this.umapReducer = new UMAPReducer(this.config.umap);
		this.hdbscanClusterer = new HDBSCANClusterer(this.config.hdbscan);
	}

	/**
	 * Run the clustering pipeline
	 *
	 * @param input - Pipeline input with embedded notes and metadata
	 * @returns Clustering result and updated state
	 */
	async run(input: PipelineInput): Promise<PipelineResult> {
		const config = { ...this.config, ...input.config };

		// Check if we have enough notes
		if (input.embeddedNotes.length < config.minNotesForClustering) {
			return this.handleTooFewNotes(input.embeddedNotes);
		}

		// Build note hash map for change detection
		const noteHashes = new Map<string, string>();
		for (const note of input.embeddedNotes) {
			noteHashes.set(note.notePath, note.contentHash);
		}

		// Detect changes to decide on full vs incremental
		const changes = detectChanges(noteHashes, input.previousState, config.incrementalThreshold);

		if (changes.shouldUseIncremental && input.previousState) {
			return this.runIncremental(input, changes, noteHashes, config);
		}

		return this.runFull(input, noteHashes, config);
	}

	/**
	 * Run full clustering (UMAP → HDBSCAN → build clusters)
	 */
	private async runFull(
		input: PipelineInput,
		noteHashes: Map<string, string>,
		config: ClusteringV2Config,
	): Promise<PipelineResult> {
		// Prepare embeddings for UMAP
		const embeddings = input.embeddedNotes.map((note) => ({
			notePath: note.notePath,
			embedding: note.embedding,
		}));

		// Step 1: UMAP dimensionality reduction
		const { reducedEmbeddings, notePaths } = await this.umapReducer.fit(embeddings);

		// Create reduced embedding map
		const reducedMap = new Map<string, number[]>();
		for (let i = 0; i < notePaths.length; i++) {
			reducedMap.set(notePaths[i], reducedEmbeddings[i]);
		}

		// Step 2: HDBSCAN clustering
		const hdbscanResult = this.hdbscanClusterer.cluster(reducedEmbeddings);

		// Step 3: Compute centroids and representatives
		// Use ORIGINAL embeddings for centroids (high-dimensional for semantic similarity)
		const originalEmbeddingMap = new Map<string, number[]>();
		for (const note of input.embeddedNotes) {
			originalEmbeddingMap.set(note.notePath, note.embedding);
		}

		// Step 4: Build clusters
		const clusters = this.buildClusters(
			notePaths,
			hdbscanResult.labels,
			originalEmbeddingMap,
			input.noteTags,
			input.resolvedLinks,
			input.files,
			config,
		);

		// Collect noise notes
		const noiseNotes = hdbscanResult.noiseIndices.map((i) => notePaths[i]);

		// Build state for future incremental updates
		const state = updateClusteringState(noteHashes, clusters, reducedMap);

		return {
			result: {
				clusters,
				noiseNotes,
				stats: {
					totalNotes: input.embeddedNotes.length,
					clusterCount: clusters.length,
					noiseCount: noiseNotes.length,
					wasIncremental: false,
				},
			},
			state,
		};
	}

	/**
	 * Run incremental update (assign new notes to existing clusters)
	 */
	private async runIncremental(
		input: PipelineInput,
		changes: ReturnType<typeof detectChanges>,
		noteHashes: Map<string, string>,
		config: ClusteringV2Config,
	): Promise<PipelineResult> {
		if (!input.previousState) {
			throw new Error('Cannot run incremental without previous state');
		}

		// Get embeddings for new and modified notes
		const changedPaths = new Set([...changes.newNotes, ...changes.modifiedNotes]);
		const changedEmbeddings = input.embeddedNotes
			.filter((note) => changedPaths.has(note.notePath))
			.map((note) => ({
				notePath: note.notePath,
				embedding: note.embedding,
			}));

		// Reconstruct previous clusters from state
		// Note: In real usage, clusters would be persisted/reloaded
		// For now, we need to handle this case gracefully
		const previousClusters = this.reconstructClustersFromState(
			input.previousState,
			input.embeddedNotes,
			input.noteTags,
			input.resolvedLinks,
			input.files,
			config,
		);

		// Apply incremental updates
		const updateResult = applyIncrementalUpdate(
			previousClusters,
			changes,
			changedEmbeddings,
			0.3, // minSimilarity
		);

		// Update state
		const reducedMap = new Map(input.previousState.reducedEmbeddings);
		// Transform new embeddings and add to map
		if (changedEmbeddings.length > 0 && this.umapReducer.isFitted()) {
			const { reducedEmbeddings, notePaths } = this.umapReducer.transform(changedEmbeddings);
			for (let i = 0; i < notePaths.length; i++) {
				reducedMap.set(notePaths[i], reducedEmbeddings[i]);
			}
		}

		const state = updateClusteringState(noteHashes, updateResult.clusters, reducedMap);

		return {
			result: {
				clusters: updateResult.clusters,
				noiseNotes: updateResult.unassignedNotes,
				stats: {
					totalNotes: input.embeddedNotes.length,
					clusterCount: updateResult.clusters.length,
					noiseCount: updateResult.unassignedNotes.length,
					wasIncremental: true,
				},
			},
			state,
		};
	}

	/**
	 * Build EmbeddingCluster objects from clustering results
	 */
	private buildClusters(
		notePaths: string[],
		labels: number[],
		embeddingMap: Map<string, number[]>,
		noteTags: Map<string, string[]>,
		resolvedLinks: ResolvedLinks,
		files: Map<string, FileInfo>,
		config: ClusteringV2Config,
	): EmbeddingCluster[] {
		// Group notes by cluster label
		const clusterNotes = new Map<number, string[]>();
		for (let i = 0; i < labels.length; i++) {
			const label = labels[i];
			if (label === -1) continue; // Skip noise

			const notes = clusterNotes.get(label);
			if (notes) {
				notes.push(notePaths[i]);
			} else {
				clusterNotes.set(label, [notePaths[i]]);
			}
		}

		const clusters: EmbeddingCluster[] = [];

		for (const [label, noteIds] of clusterNotes.entries()) {
			// Get embeddings for this cluster
			const clusterEmbeddings: Array<{ index: number; embedding: number[] }> = [];
			for (let i = 0; i < noteIds.length; i++) {
				const embedding = embeddingMap.get(noteIds[i]);
				if (embedding) {
					clusterEmbeddings.push({ index: i, embedding });
				}
			}

			if (clusterEmbeddings.length === 0) continue;

			// Compute centroid
			const centroid = computeCentroid(clusterEmbeddings.map((e) => e.embedding));

			// Select representative notes
			const representativeIndices = selectRepresentatives(
				clusterEmbeddings,
				centroid,
				config.representativeCount,
			);
			const representativeNotes = representativeIndices.map((i) => noteIds[i]);

			// Extract candidate names from representative note titles
			const candidateNames = this.extractCandidateNames(representativeNotes, files);

			// Calculate dominant tags
			const dominantTags = this.calculateDominantTags(
				noteIds,
				noteTags,
				config.dominantTagThreshold,
			);

			// Calculate most common folder
			const folderPath = this.calculateCommonFolder(noteIds);

			// Calculate link density
			const internalLinkDensity = this.calculateLinkDensity(noteIds, resolvedLinks);

			clusters.push({
				id: generateEmbeddingClusterId(),
				candidateNames,
				noteIds,
				dominantTags,
				folderPath,
				internalLinkDensity,
				createdAt: Date.now(),
				reasons: [`Embedding-based cluster (label: ${label})`],
				centroid,
				representativeNotes,
			});
		}

		return clusters;
	}

	/**
	 * Extract candidate names from representative note titles
	 */
	private extractCandidateNames(
		representativeNotes: string[],
		files: Map<string, FileInfo>,
	): string[] {
		const names: string[] = [];

		for (const notePath of representativeNotes) {
			const file = files.get(notePath);
			if (file) {
				// Extract meaningful words from basename
				const words = file.basename
					.replace(/[-_]/g, ' ')
					.split(/\s+/)
					.filter((w) => w.length > 2);
				names.push(...words.slice(0, 3));
			}
		}

		// Return unique names, limited to 10
		return [...new Set(names)].slice(0, 10);
	}

	/**
	 * Calculate dominant tags for a cluster
	 */
	private calculateDominantTags(
		noteIds: string[],
		noteTags: Map<string, string[]>,
		threshold: number,
	): string[] {
		const tagCounts = new Map<string, number>();

		for (const noteId of noteIds) {
			const tags = noteTags.get(noteId) || [];
			for (const tag of tags) {
				tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
			}
		}

		const minCount = Math.max(1, Math.floor(noteIds.length * threshold));
		const dominantTags: string[] = [];

		for (const [tag, count] of tagCounts.entries()) {
			if (count >= minCount) {
				dominantTags.push(tag);
			}
		}

		// Sort by frequency
		dominantTags.sort((a, b) => (tagCounts.get(b) || 0) - (tagCounts.get(a) || 0));

		return dominantTags.slice(0, 10);
	}

	/**
	 * Calculate most common folder path
	 */
	private calculateCommonFolder(noteIds: string[]): string {
		const folderCounts = new Map<string, number>();

		for (const noteId of noteIds) {
			const parts = noteId.split('/');
			if (parts.length > 1) {
				const folder = parts.slice(0, -1).join('/');
				folderCounts.set(folder, (folderCounts.get(folder) || 0) + 1);
			}
		}

		let maxFolder = '';
		let maxCount = 0;

		for (const [folder, count] of folderCounts.entries()) {
			if (count > maxCount) {
				maxCount = count;
				maxFolder = folder;
			}
		}

		return maxFolder;
	}

	/**
	 * Calculate internal link density for a cluster
	 */
	private calculateLinkDensity(noteIds: string[], resolvedLinks: ResolvedLinks): number {
		if (noteIds.length < 2) {
			return 0;
		}

		const noteSet = new Set(noteIds);
		let internalLinks = 0;

		for (const noteId of noteIds) {
			const targets = resolvedLinks[noteId];
			if (!targets) continue;

			for (const target of Object.keys(targets)) {
				if (noteSet.has(target)) {
					internalLinks += targets[target];
				}
			}
		}

		// Possible links in a directed graph: n * (n - 1)
		const possibleLinks = noteIds.length * (noteIds.length - 1);
		if (possibleLinks === 0) return 0;

		return Math.min(1, internalLinks / possibleLinks);
	}

	/**
	 * Handle case with too few notes for clustering
	 */
	private handleTooFewNotes(embeddedNotes: EmbeddedNote[]): PipelineResult {
		// Put all notes in noise
		return {
			result: {
				clusters: [],
				noiseNotes: embeddedNotes.map((n) => n.notePath),
				stats: {
					totalNotes: embeddedNotes.length,
					clusterCount: 0,
					noiseCount: embeddedNotes.length,
					wasIncremental: false,
				},
			},
			state: {
				reducedEmbeddings: new Map(),
				centroids: new Map(),
				lastFullClusteringAt: Date.now(),
				noteHashes: new Map(),
			},
		};
	}

	/**
	 * Reconstruct clusters from previous state
	 * This is a simplified version - in production, clusters would be persisted
	 * Note: Additional parameters are kept for future expansion when clusters are fully persisted
	 */
	private reconstructClustersFromState(
		state: ClusteringState,
		_embeddedNotes: EmbeddedNote[],
		_noteTags: Map<string, string[]>,
		_resolvedLinks: ResolvedLinks,
		_files: Map<string, FileInfo>,
		_config: ClusteringV2Config,
	): EmbeddingCluster[] {
		// In a real implementation, clusters would be loaded from storage
		// For now, we create placeholder clusters from centroids
		const clusters: EmbeddingCluster[] = [];

		for (const [clusterId, centroid] of state.centroids.entries()) {
			clusters.push({
				id: clusterId,
				candidateNames: [],
				noteIds: [],
				dominantTags: [],
				folderPath: '',
				internalLinkDensity: 0,
				createdAt: Date.now(),
				reasons: ['Reconstructed from state'],
				centroid,
				representativeNotes: [],
			});
		}

		return clusters;
	}

	/**
	 * Get current configuration
	 */
	getConfig(): ClusteringV2Config {
		return { ...this.config };
	}
}

/**
 * Convenience function to run clustering in one call
 */
export async function runClusteringV2Pipeline(input: PipelineInput): Promise<PipelineResult> {
	const pipeline = new ClusteringV2Pipeline(input.config);
	return pipeline.run(input);
}
