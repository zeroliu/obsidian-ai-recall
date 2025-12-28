#!/usr/bin/env npx tsx
/**
 * Grid search for optimal clustering hyperparameters
 *
 * Usage:
 *   TEST_VAULT_PATH=~/Documents/MyVault OPENAI_API_KEY=xxx npx tsx scripts/grid-search-clustering.ts [options]
 *
 * Environment:
 *   TEST_VAULT_PATH   Required. Path to the Obsidian vault.
 *   OPENAI_API_KEY    Required for embedding.
 *
 * Options:
 *   --output <path>       Output directory (default: outputs/grid-search)
 *   --no-cache-embeddings Skip embedding cache
 *   --cache-umap          Cache UMAP projections per config
 *   --help, -h            Show help
 */

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {OpenAIEmbeddingAdapter} from '../src/adapters/openai/OpenAIEmbeddingAdapter';
import {EmbeddingOrchestrator} from '../src/domain/embedding/embedBatch';
import {ClusteringPipeline} from '../src/domain/clustering/pipeline';
import {UMAPReducer} from '../src/domain/clustering/umapReducer';
import {HDBSCANClusterer} from '../src/domain/clustering/hdbscanClusterer';
import {computeClusterCentroids} from '../src/domain/clustering/centroidCalculator';
import type {EmbeddingCluster, UMAPConfig, HDBSCANConfig} from '../src/domain/clustering/types';
import {DEFAULT_CLUSTERING_CONFIG, generateEmbeddingClusterId} from '../src/domain/clustering/types';
import {getArg, readVault, requireTestVaultPath} from './lib/vault-helpers';
import {
	computeIntrinsicMetrics,
	computeSemanticMetrics,
	computeDomainMetrics,
	computeMetricStatus,
	checkAllTargetsMet,
	type GridSearchResult,
} from './metrics';

// ============ Grid Configuration ============

const PRIMARY_GRID = {
	umap: {
		nNeighbors: [5, 10, 15, 30, 50],
		minDist: [0.0, 0.05, 0.1, 0.2, 0.5],
		nComponents: [10], // Fixed for primary grid
	},
	hdbscan: {
		minClusterSize: [3, 5, 10, 15, 20, 30],
		minSamples: [3], // Fixed for primary grid
	},
};

interface GridSearchConfig {
	umap: {nNeighbors: number; minDist: number; nComponents: number};
	hdbscan: {minClusterSize: number; minSamples: number};
}

interface GridSearchSummary {
	grid: typeof PRIMARY_GRID;
	totalConfigs: number;
	completedConfigs: number;
	results: GridSearchResult[];
	topBySilhouette: GridSearchResult[];
	topByNoiseRatio: GridSearchResult[];
	topByTagHomogeneity: GridSearchResult[];
	timing: {
		embeddingMs: number;
		totalSearchMs: number;
		avgPerConfigMs: number;
	};
	startedAt: number;
	completedAt: number;
}

// ============ Helpers ============

/**
 * Generate all config combinations from grid
 */
function generateConfigs(grid: typeof PRIMARY_GRID): GridSearchConfig[] {
	const configs: GridSearchConfig[] = [];

	for (const nNeighbors of grid.umap.nNeighbors) {
		for (const minDist of grid.umap.minDist) {
			for (const nComponents of grid.umap.nComponents) {
				for (const minClusterSize of grid.hdbscan.minClusterSize) {
					for (const minSamples of grid.hdbscan.minSamples) {
						configs.push({
							umap: {nNeighbors, minDist, nComponents},
							hdbscan: {minClusterSize, minSamples},
						});
					}
				}
			}
		}
	}

	return configs;
}

/**
 * Build clusters from HDBSCAN labels
 */
function buildClustersFromLabels(
	labels: number[],
	notePaths: string[],
	embeddings: number[][],
	representativeCount: number,
): {clusters: EmbeddingCluster[]; noiseNotes: string[]} {
	// Group notes by cluster label
	const clusterMap = new Map<number, number[]>();
	const noiseNotes: string[] = [];

	for (let i = 0; i < labels.length; i++) {
		const label = labels[i];
		if (label === -1) {
			noiseNotes.push(notePaths[i]);
		} else {
			if (!clusterMap.has(label)) {
				clusterMap.set(label, []);
			}
			clusterMap.get(label)!.push(i);
		}
	}

	// Compute centroids and build clusters
	const centroidResults = computeClusterCentroids(embeddings, labels, representativeCount);

	const clusters: EmbeddingCluster[] = centroidResults.map((result) => {
		const indices = clusterMap.get(result.label) ?? [];
		return {
			id: generateEmbeddingClusterId(),
			noteIds: indices.map((i) => notePaths[i]),
			centroid: result.centroid,
			representativeNotes: result.representativeIndices.map((i) => notePaths[i]),
			candidateNames: [],
			dominantTags: [],
			folderPath: '',
			internalLinkDensity: 0,
			createdAt: Date.now(),
			reasons: [],
		};
	});

	return {clusters, noiseNotes};
}

/**
 * Write markdown report
 */
function writeReport(path: string, summary: GridSearchSummary): void {
	const formatConfig = (r: GridSearchResult) =>
		`nNeighbors=${r.config.umap.nNeighbors}, minDist=${r.config.umap.minDist}, minClusterSize=${r.config.hdbscan.minClusterSize}`;

	const lines = [
		'# Grid Search Results',
		'',
		`Generated: ${new Date(summary.completedAt).toISOString()}`,
		`Configurations tested: ${summary.completedConfigs}`,
		`Total time: ${(summary.timing.totalSearchMs / 1000 / 60).toFixed(1)} minutes`,
		'',
		'## Top 10 by Silhouette Score',
		'',
		'| Rank | nNeighbors | minDist | minClusterSize | Silhouette | Noise% | Clusters | Tag Homogeneity |',
		'|------|------------|---------|----------------|------------|--------|----------|-----------------|',
		...summary.topBySilhouette.slice(0, 10).map(
			(r, i) =>
				`| ${i + 1} | ${r.config.umap.nNeighbors} | ${r.config.umap.minDist} | ${r.config.hdbscan.minClusterSize} | ${r.metrics.silhouetteScore.toFixed(4)} | ${(r.metrics.noiseRatio * 100).toFixed(1)}% | ${r.metrics.clusterCount} | ${(r.metrics.tagHomogeneity * 100).toFixed(1)}% |`,
		),
		'',
		'## Top 10 by Noise Ratio (closest to 12.5%)',
		'',
		'| Rank | nNeighbors | minDist | minClusterSize | Noise% | Silhouette | Clusters | Tag Homogeneity |',
		'|------|------------|---------|----------------|--------|------------|----------|-----------------|',
		...summary.topByNoiseRatio.slice(0, 10).map(
			(r, i) =>
				`| ${i + 1} | ${r.config.umap.nNeighbors} | ${r.config.umap.minDist} | ${r.config.hdbscan.minClusterSize} | ${(r.metrics.noiseRatio * 100).toFixed(1)}% | ${r.metrics.silhouetteScore.toFixed(4)} | ${r.metrics.clusterCount} | ${(r.metrics.tagHomogeneity * 100).toFixed(1)}% |`,
		),
		'',
		'## Top 10 by Tag Homogeneity',
		'',
		'| Rank | nNeighbors | minDist | minClusterSize | Tag Homogeneity | Silhouette | Noise% | Clusters |',
		'|------|------------|---------|----------------|-----------------|------------|--------|----------|',
		...summary.topByTagHomogeneity.slice(0, 10).map(
			(r, i) =>
				`| ${i + 1} | ${r.config.umap.nNeighbors} | ${r.config.umap.minDist} | ${r.config.hdbscan.minClusterSize} | ${(r.metrics.tagHomogeneity * 100).toFixed(1)}% | ${r.metrics.silhouetteScore.toFixed(4)} | ${(r.metrics.noiseRatio * 100).toFixed(1)}% | ${r.metrics.clusterCount} |`,
		),
		'',
		'## Parameter Impact Analysis',
		'',
		'### Best configs meeting all targets (Silhouette>=0.3, Noise 5-20%, Tag Homogeneity>=0.5)',
		'',
	];

	// Find configs meeting all targets
	const meetingTargets = summary.results.filter((r) => {
		const status = computeMetricStatus(
			r.metrics.silhouetteScore,
			r.metrics.noiseRatio,
			r.metrics.tagHomogeneity,
		);
		return checkAllTargetsMet(status);
	});

	if (meetingTargets.length === 0) {
		lines.push('*No configurations met all target thresholds.*');
		lines.push('');
		lines.push('Consider relaxing targets or expanding the parameter search space.');
	} else {
		lines.push(
			'| nNeighbors | minDist | minClusterSize | Silhouette | Noise% | Tag Homogeneity |',
		);
		lines.push(
			'|------------|---------|----------------|------------|--------|-----------------|',
		);
		for (const r of meetingTargets.slice(0, 10)) {
			lines.push(
				`| ${r.config.umap.nNeighbors} | ${r.config.umap.minDist} | ${r.config.hdbscan.minClusterSize} | ${r.metrics.silhouetteScore.toFixed(4)} | ${(r.metrics.noiseRatio * 100).toFixed(1)}% | ${(r.metrics.tagHomogeneity * 100).toFixed(1)}% |`,
			);
		}
	}

	writeFileSync(path, lines.join('\n'));
}

// ============ Main ============

async function main() {
	const args = process.argv.slice(2);

	if (args.includes('--help') || args.includes('-h')) {
		console.log(`
Usage: TEST_VAULT_PATH=~/Documents/MyVault OPENAI_API_KEY=xxx npx tsx scripts/grid-search-clustering.ts [options]

Options:
  --output <path>       Output directory (default: outputs/grid-search)
  --no-cache-embeddings Skip embedding cache
  --cache-umap          Cache UMAP projections per config
  --help, -h            Show help

Environment:
  TEST_VAULT_PATH   Required. Path to the Obsidian vault.
  OPENAI_API_KEY    Required for embedding.

Primary Grid (${5 * 5 * 6} = 150 combinations):
  UMAP nNeighbors:      [5, 10, 15, 30, 50]
  UMAP minDist:         [0.0, 0.05, 0.1, 0.2, 0.5]
  HDBSCAN minClusterSize: [3, 5, 10, 15, 20, 30]

Example:
  TEST_VAULT_PATH=~/Documents/MyVault OPENAI_API_KEY=sk-xxx npx tsx scripts/grid-search-clustering.ts
`);
		process.exit(0);
	}

	const outputDir = getArg(args, '--output') ?? 'outputs/grid-search';
	const cacheEmbeddings = !args.includes('--no-cache-embeddings');
	const cacheUmap = args.includes('--cache-umap');

	const vaultPath = requireTestVaultPath();
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		console.error('Error: OPENAI_API_KEY environment variable required');
		process.exit(1);
	}

	// Prepare output directory
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, {recursive: true});
	}

	console.error('=== Grid Search for Clustering Parameters ===');
	console.error(`Vault: ${vaultPath}`);
	console.error(`Output: ${outputDir}`);
	console.error('');

	const startTime = Date.now();

	// Step 1: Read vault
	console.error('Step 1: Reading vault...');
	const vault = readVault(vaultPath);
	const {files, contents, noteTags, stubs} = vault;
	console.error(`  Non-stub notes: ${files.size}`);
	console.error('');

	// Step 2: Embed notes (with caching)
	console.error('Step 2: Loading/embedding notes...');
	const embeddingCachePath = join(outputDir, 'embeddings-cache.json');

	let embeddings: Map<string, number[]>;
	let notePaths: string[];
	let embeddingArray: number[][];

	if (cacheEmbeddings && existsSync(embeddingCachePath)) {
		console.error('  Loading from cache...');
		const cache = JSON.parse(readFileSync(embeddingCachePath, 'utf-8'));
		embeddings = new Map(Object.entries(cache.embeddings) as [string, number[]][]);
		notePaths = cache.notePaths;
		embeddingArray = cache.embeddingArray;
	} else {
		const embeddingStartTime = Date.now();
		const provider = new OpenAIEmbeddingAdapter({apiKey});
		const orchestrator = new EmbeddingOrchestrator(provider, null, {useCache: false});

		const notesToEmbed = Array.from(contents.entries()).map(([path, content]) => ({
			notePath: path,
			content,
		}));

		const embeddingResult = await orchestrator.embedNotes(notesToEmbed, (completed, total) => {
			process.stderr.write(`\r  Embedded ${completed}/${total} notes`);
		});
		console.error('');

		embeddings = new Map<string, number[]>();
		notePaths = [];
		embeddingArray = [];

		for (const note of embeddingResult.notes) {
			embeddings.set(note.notePath, note.embedding);
			notePaths.push(note.notePath);
			embeddingArray.push(note.embedding);
		}

		if (cacheEmbeddings) {
			writeFileSync(
				embeddingCachePath,
				JSON.stringify({
					embeddings: Object.fromEntries(embeddings),
					notePaths,
					embeddingArray,
				}),
			);
			console.error(`  Cached to ${embeddingCachePath}`);
		}
	}

	const embeddingMs = Date.now() - startTime;
	console.error(`  Loaded ${embeddings.size} embeddings`);
	console.error('');

	// Step 3: Generate grid configurations
	const configs = generateConfigs(PRIMARY_GRID);
	console.error(`Step 3: Running ${configs.length} configurations...`);
	console.error('');

	// Step 4: Run grid search
	const results: GridSearchResult[] = [];
	const umapCache = new Map<string, number[][]>();
	const searchStartTime = Date.now();

	for (let i = 0; i < configs.length; i++) {
		const config = configs[i];
		const progress = `[${i + 1}/${configs.length}]`;

		process.stderr.write(
			`\r  ${progress} nNeighbors=${config.umap.nNeighbors}, minDist=${config.umap.minDist}, minClusterSize=${config.hdbscan.minClusterSize}    `,
		);

		const configStartTime = Date.now();

		// UMAP reduction (potentially cached)
		const umapKey = `${config.umap.nNeighbors}-${config.umap.minDist}-${config.umap.nComponents}`;
		let reducedEmbeddings: number[][];

		const umapStartTime = Date.now();
		if (cacheUmap && umapCache.has(umapKey)) {
			reducedEmbeddings = umapCache.get(umapKey)!;
		} else {
			const umapConfig: UMAPConfig = {
				...config.umap,
				metric: 'cosine',
			};
			const reducer = new UMAPReducer(umapConfig);
			const result = await reducer.fit(
				notePaths.map((path, idx) => ({
					notePath: path,
					embedding: embeddingArray[idx],
				})),
			);
			reducedEmbeddings = result.reducedEmbeddings;

			if (cacheUmap) {
				umapCache.set(umapKey, reducedEmbeddings);
			}
		}
		const umapMs = Date.now() - umapStartTime;

		// HDBSCAN clustering
		const hdbscanStartTime = Date.now();
		const clusterer = new HDBSCANClusterer(config.hdbscan);
		const clusterResult = clusterer.cluster(reducedEmbeddings);
		const hdbscanMs = Date.now() - hdbscanStartTime;

		// Build clusters
		const {clusters, noiseNotes} = buildClustersFromLabels(
			clusterResult.labels,
			notePaths,
			embeddingArray,
			DEFAULT_CLUSTERING_CONFIG.representativeCount,
		);

		// Compute metrics
		const metricsStartTime = Date.now();
		const intrinsic = computeIntrinsicMetrics(
			embeddings,
			clusters,
			noiseNotes,
			embeddings.size,
		);
		const domain = computeDomainMetrics(clusters, noteTags);
		const semantic = computeSemanticMetrics(embeddings, clusters);
		const metricsMs = Date.now() - metricsStartTime;

		results.push({
			config,
			metrics: {
				silhouetteScore: intrinsic.silhouetteScore,
				noiseRatio: intrinsic.noiseRatio,
				clusterCount: intrinsic.clusterCount,
				tagHomogeneity: domain.tagHomogeneity,
				avgLinkDensity: domain.avgInternalLinkDensity,
				avgIntraClusterSimilarity: semantic.avgIntraClusterSimilarity,
			},
			timing: {umapMs, hdbscanMs, metricsMs},
		});

		// Save intermediate results every 25 configs
		if ((i + 1) % 25 === 0) {
			writeFileSync(
				join(outputDir, 'intermediate-results.json'),
				JSON.stringify(results, null, 2),
			);
		}
	}
	console.error('');
	console.error('');

	// Step 5: Analyze and save results
	console.error('Step 4: Analyzing results...');

	// Sort by each metric independently
	const topBySilhouette = [...results].sort(
		(a, b) => b.metrics.silhouetteScore - a.metrics.silhouetteScore,
	);

	// For noise ratio, sort by distance from optimal (12.5%)
	const targetNoise = 0.125;
	const topByNoiseRatio = [...results].sort(
		(a, b) =>
			Math.abs(a.metrics.noiseRatio - targetNoise) -
			Math.abs(b.metrics.noiseRatio - targetNoise),
	);

	const topByTagHomogeneity = [...results].sort(
		(a, b) => b.metrics.tagHomogeneity - a.metrics.tagHomogeneity,
	);

	const summary: GridSearchSummary = {
		grid: PRIMARY_GRID,
		totalConfigs: configs.length,
		completedConfigs: results.length,
		results,
		topBySilhouette,
		topByNoiseRatio,
		topByTagHomogeneity,
		timing: {
			embeddingMs,
			totalSearchMs: Date.now() - startTime,
			avgPerConfigMs: (Date.now() - searchStartTime) / results.length,
		},
		startedAt: startTime,
		completedAt: Date.now(),
	};

	// Save results
	writeFileSync(join(outputDir, 'grid-search-results.json'), JSON.stringify(summary, null, 2));
	writeReport(join(outputDir, 'grid-search-report.md'), summary);

	// Print summary
	console.error('=== Results ===');
	console.error('');
	console.error('Top 3 by Silhouette Score:');
	for (const r of topBySilhouette.slice(0, 3)) {
		console.error(
			`  nNeighbors=${r.config.umap.nNeighbors}, minDist=${r.config.umap.minDist}, minClusterSize=${r.config.hdbscan.minClusterSize}`,
		);
		console.error(
			`    Silhouette: ${r.metrics.silhouetteScore.toFixed(4)}, Noise: ${(r.metrics.noiseRatio * 100).toFixed(1)}%, Tag Homog: ${(r.metrics.tagHomogeneity * 100).toFixed(1)}%`,
		);
	}
	console.error('');
	console.error('Top 3 by Tag Homogeneity:');
	for (const r of topByTagHomogeneity.slice(0, 3)) {
		console.error(
			`  nNeighbors=${r.config.umap.nNeighbors}, minDist=${r.config.umap.minDist}, minClusterSize=${r.config.hdbscan.minClusterSize}`,
		);
		console.error(
			`    Tag Homog: ${(r.metrics.tagHomogeneity * 100).toFixed(1)}%, Silhouette: ${r.metrics.silhouetteScore.toFixed(4)}, Noise: ${(r.metrics.noiseRatio * 100).toFixed(1)}%`,
		);
	}
	console.error('');
	console.error(`Total time: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`);
	console.error(`Output saved to: ${outputDir}`);
}

main().catch((err) => {
	console.error('Error:', err.message);
	console.error(err.stack);
	process.exit(1);
});
