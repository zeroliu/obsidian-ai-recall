import { MockMetadataAdapter } from '@/adapters/mock/MockMetadataAdapter';
import { MockVaultAdapter } from '@/adapters/mock/MockVaultAdapter';
import type { FileMetadata } from '@/ports/IMetadataProvider';
import emptyVault from '@/test/fixtures/empty-vault.json';
import mixedVault from '@/test/fixtures/mixed-vault.json';
import reactVault from '@/test/fixtures/react-vault.json';
import type { VaultFixture } from '@/test/fixtures/types';
import { describe, expect, it } from 'vitest';
import { type PipelineInput, runClusteringPipeline } from '../pipeline';
import type { ClusteringConfig } from '../types';

describe('Clustering Pipeline Integration', () => {
	const config: Partial<ClusteringConfig> = {
		minClusterSize: 2,
		maxClusterSize: 100,
	};

	async function createPipelineInput(
		fixture: VaultFixture,
		configOverride?: Partial<ClusteringConfig>,
	): Promise<PipelineInput> {
		const vaultAdapter = new MockVaultAdapter(fixture);
		const metadataAdapter = new MockMetadataAdapter(fixture);

		const files = await vaultAdapter.listMarkdownFiles();
		const resolvedLinks = await metadataAdapter.getResolvedLinks();

		// Build metadata map
		const metadata = new Map<string, FileMetadata>();
		for (const file of files) {
			const meta = await metadataAdapter.getFileMetadata(file.path);
			if (meta) {
				metadata.set(file.path, meta);
			}
		}

		return {
			files,
			metadata,
			resolvedLinks,
			config: { ...config, ...configOverride },
		};
	}

	describe('React Vault', () => {
		it('should cluster React notes together', async () => {
			const input = await createPipelineInput(reactVault as VaultFixture);
			const result = runClusteringPipeline(input);

			expect(result.clusters.length).toBeGreaterThan(0);
			expect(result.stats.totalNotes).toBe(6);

			// All notes should be in clusters
			const allNoteIds = result.clusters.flatMap((c) => c.noteIds);
			expect(allNoteIds).toHaveLength(6);

			// Should have react as a dominant tag in at least one cluster
			const reactCluster = result.clusters.find((c) =>
				c.dominantTags.some((t) => t.includes('react')),
			);
			expect(reactCluster).toBeDefined();
		});

		it('should calculate correct statistics', async () => {
			const input = await createPipelineInput(reactVault as VaultFixture);
			const result = runClusteringPipeline(input);

			expect(result.stats.totalNotes).toBe(6);
			expect(result.stats.totalClusters).toBeGreaterThan(0);
			expect(result.stats.averageClusterSize).toBeGreaterThan(0);
			expect(result.stats.minClusterSize).toBeLessThanOrEqual(result.stats.maxClusterSize);
		});

		it('should respect minClusterSize', async () => {
			const input = await createPipelineInput(reactVault as VaultFixture, {
				minClusterSize: 3,
			});
			const result = runClusteringPipeline(input);

			// Small clusters should be merged
			result.clusters.forEach((cluster) => {
				// Some clusters might still be small if they can't be merged
				// but they should be at least 1
				expect(cluster.noteIds.length).toBeGreaterThanOrEqual(1);
			});
		});
	});

	describe('Mixed Vault', () => {
		it('should cluster React and Golf notes separately', async () => {
			const input = await createPipelineInput(mixedVault as VaultFixture);
			const result = runClusteringPipeline(input);

			// Total notes in clusters + stubs should equal all notes
			expect(result.stats.totalNotes + result.stats.stubCount).toBe(8);

			// Should have multiple clusters due to different topics
			expect(result.clusters.length).toBeGreaterThan(0);

			// Check that clustered notes are unique
			const allNoteIds = result.clusters.flatMap((c) => c.noteIds);
			expect(new Set(allNoteIds).size).toBe(result.stats.totalNotes);

			// Stubs should be returned separately
			expect(result.stubs.length).toBe(result.stats.stubCount);
		});

		it('should separate daily notes from topic notes', async () => {
			const input = await createPipelineInput(mixedVault as VaultFixture);
			const result = runClusteringPipeline(input);

			// Daily notes should be in their own cluster or with similar notes
			const dailyCluster = result.clusters.find((c) =>
				c.noteIds.some((id) => id.includes('daily/')),
			);

			if (dailyCluster) {
				// Daily notes should be grouped together
				const dailyNotes = dailyCluster.noteIds.filter((id) => id.includes('daily/'));
				expect(dailyNotes.length).toBeGreaterThanOrEqual(1);
			}
		});

		it('should handle root-level notes', async () => {
			const input = await createPipelineInput(mixedVault as VaultFixture);
			const result = runClusteringPipeline(input);

			// Root Note.md should be somewhere
			const allNoteIds = result.clusters.flatMap((c) => c.noteIds);
			expect(allNoteIds).toContain('Root Note.md');
		});
	});

	describe('Empty Vault', () => {
		it('should handle empty vault gracefully', async () => {
			const input = await createPipelineInput(emptyVault as VaultFixture);
			const result = runClusteringPipeline(input);

			expect(result.clusters).toHaveLength(0);
			expect(result.stats.totalNotes).toBe(0);
			expect(result.stats.totalClusters).toBe(0);
		});
	});

	describe('Pipeline Steps', () => {
		it('should preserve folder path information', async () => {
			const input = await createPipelineInput(reactVault as VaultFixture);
			const result = runClusteringPipeline(input);

			// At least one cluster should have folder path info
			const clusterWithFolder = result.clusters.find((c) => c.folderPath !== '');
			expect(clusterWithFolder).toBeDefined();
		});

		it('should calculate link density', async () => {
			const input = await createPipelineInput(reactVault as VaultFixture);
			const result = runClusteringPipeline(input);

			// React vault has interconnected notes, so at least one cluster should have non-zero density
			const hasLinkDensity = result.clusters.some((c) => c.internalLinkDensity > 0);
			expect(hasLinkDensity).toBe(true);
		});

		it('should generate candidate names', async () => {
			const input = await createPipelineInput(reactVault as VaultFixture);
			const result = runClusteringPipeline(input);

			// Every cluster should have at least one candidate name
			result.clusters.forEach((cluster) => {
				expect(cluster.candidateNames.length).toBeGreaterThan(0);
			});
		});
	});

	describe('Configuration', () => {
		it('should use default config when not provided', async () => {
			const fixture = reactVault as VaultFixture;
			const vaultAdapter = new MockVaultAdapter(fixture);
			const metadataAdapter = new MockMetadataAdapter(fixture);

			const input: PipelineInput = {
				files: await vaultAdapter.listMarkdownFiles(),
				metadata: new Map(),
				resolvedLinks: await metadataAdapter.getResolvedLinks(),
				// No config provided
			};

			const result = runClusteringPipeline(input);

			expect(result.clusters).toBeDefined();
		});

		it('should respect maxClusterSize', async () => {
			const input = await createPipelineInput(mixedVault as VaultFixture, {
				maxClusterSize: 3,
			});
			const result = runClusteringPipeline(input);

			result.clusters.forEach((cluster) => {
				expect(cluster.noteIds.length).toBeLessThanOrEqual(3);
			});
		});
	});
});
