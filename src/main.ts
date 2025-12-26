import { Notice, Plugin } from 'obsidian';
import {
	ObsidianVaultAdapter,
	ObsidianMetadataAdapter,
} from '@/adapters/obsidian';
import { runClusteringPipeline } from '@/domain/clustering/pipeline';
import type { FileMetadata } from '@/ports/IMetadataProvider';

/**
 * Obsidian AI Recall Plugin
 * AI-powered spaced repetition for Obsidian
 */
export default class AIRecallPlugin extends Plugin {
	private vaultAdapter!: ObsidianVaultAdapter;
	private metadataAdapter!: ObsidianMetadataAdapter;

	async onload(): Promise<void> {
		console.log('Loading AI Recall plugin');

		// Initialize adapters
		this.vaultAdapter = new ObsidianVaultAdapter(this.app);
		this.metadataAdapter = new ObsidianMetadataAdapter(this.app);

		// Register clustering command
		this.addCommand({
			id: 'run-clustering',
			name: 'Run Note Clustering',
			callback: () => this.runClustering(),
		});
	}

	async onunload(): Promise<void> {
		console.log('Unloading AI Recall plugin');
	}

	private async runClustering(): Promise<void> {
		try {
			new Notice('Starting note clustering...');

			// Gather data from adapters
			const files = await this.vaultAdapter.listMarkdownFiles();
			const resolvedLinks = await this.metadataAdapter.getResolvedLinks();

			// Build metadata map
			const metadata = new Map<string, FileMetadata>();
			for (const file of files) {
				const fileMeta =
					await this.metadataAdapter.getFileMetadata(file.path);
				if (fileMeta) {
					metadata.set(file.path, fileMeta);
				}
			}

			// Run clustering pipeline
			const result = runClusteringPipeline({
				files,
				metadata,
				resolvedLinks,
			});

			// Log results
			console.log('Clustering complete:', result.stats);
			console.log(`Created ${result.clusters.length} clusters`);
			for (const cluster of result.clusters.slice(0, 10)) {
				console.log(
					`  - Cluster "${cluster.id}": ${cluster.noteIds.length} notes, tags: ${cluster.dominantTags.join(', ') || 'none'}`,
				);
			}

			new Notice(
				`Clustering complete: ${result.stats.totalClusters} clusters from ${result.stats.totalNotes} notes`,
			);
		} catch (error) {
			console.error('Clustering failed:', error);
			new Notice('Clustering failed. Check console for details.');
		}
	}
}
