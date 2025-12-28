#!/usr/bin/env npx tsx
/**
 * Evaluate clustering quality with comprehensive metrics
 *
 * Usage:
 *   TEST_VAULT_PATH=~/Documents/MyVault OPENAI_API_KEY=xxx npx tsx scripts/evaluate-clustering.ts [options]
 *
 * Environment:
 *   TEST_VAULT_PATH   Required when using --vault
 *   OPENAI_API_KEY    Required when using --vault
 *
 * Options:
 *   --vault           Run clustering from vault (requires env vars)
 *   --config <path>   Custom clustering config JSON
 *   --output <path>   Output file (default: outputs/clustering-evaluation.json)
 *   --help, -h        Show help
 */

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {OpenAIEmbeddingAdapter} from '../src/adapters/openai/OpenAIEmbeddingAdapter';
import {EmbeddingOrchestrator} from '../src/domain/embedding/embedBatch';
import {ClusteringPipeline} from '../src/domain/clustering/pipeline';
import type {ClusteringConfig} from '../src/domain/clustering/types';
import {DEFAULT_CLUSTERING_CONFIG} from '../src/domain/clustering/types';
import {getArg, readVault, requireTestVaultPath} from './lib/vault-helpers';
import {
	evaluateClustering,
	formatEvaluationSummary,
	type ClusteringEvaluation,
	type EvaluationInput,
} from './metrics';

// ============ Main ============

async function main() {
	const args = process.argv.slice(2);

	if (args.includes('--help') || args.includes('-h')) {
		console.log(`
Usage: TEST_VAULT_PATH=~/Documents/MyVault OPENAI_API_KEY=xxx npx tsx scripts/evaluate-clustering.ts [options]

Options:
  --vault           Run clustering from vault (requires env vars)
  --config <path>   Custom clustering config JSON
  --output <path>   Output file (default: outputs/clustering-evaluation.json)
  --help, -h        Show help

Environment:
  TEST_VAULT_PATH   Required when using --vault
  OPENAI_API_KEY    Required when using --vault

Example:
  TEST_VAULT_PATH=~/Documents/MyVault OPENAI_API_KEY=sk-xxx npx tsx scripts/evaluate-clustering.ts --vault
`);
		process.exit(0);
	}

	const useVault = args.includes('--vault');
	const configPath = getArg(args, '--config');
	const outputPath = getArg(args, '--output') ?? 'outputs/clustering-evaluation.json';

	if (!useVault) {
		console.error('Error: --vault flag is required');
		console.error('Run with --help for usage information');
		process.exit(1);
	}

	const vaultPath = requireTestVaultPath();
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		console.error('Error: OPENAI_API_KEY environment variable required');
		process.exit(1);
	}

	// Load custom config if provided
	let config: ClusteringConfig = DEFAULT_CLUSTERING_CONFIG;
	if (configPath && existsSync(configPath)) {
		const customConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
		config = {...DEFAULT_CLUSTERING_CONFIG, ...customConfig};
		if (customConfig.umap) {
			config.umap = {...DEFAULT_CLUSTERING_CONFIG.umap, ...customConfig.umap};
		}
		if (customConfig.hdbscan) {
			config.hdbscan = {...DEFAULT_CLUSTERING_CONFIG.hdbscan, ...customConfig.hdbscan};
		}
	}

	console.error(`=== Clustering Evaluation ===`);
	console.error(`Vault: ${vaultPath}`);
	console.error(`Config: ${configPath ?? 'default'}`);
	console.error('');

	const totalStartTime = Date.now();

	// Step 1: Read vault
	console.error('Step 1: Reading vault...');
	const vault = readVault(vaultPath);
	const {files, contents, noteTags, resolvedLinks, stubs} = vault;
	console.error(`  Non-stub notes: ${files.size}`);
	console.error(`  Stub notes excluded: ${stubs.length}`);
	console.error('');

	// Step 2: Embed notes
	console.error('Step 2: Embedding notes...');
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

	const embeddingMs = Date.now() - embeddingStartTime;
	console.error(`  Embedding complete: ${embeddingResult.notes.length} notes`);
	console.error(`  Estimated cost: $${embeddingResult.stats.estimatedCost.toFixed(6)}`);
	console.error('');

	// Step 3: Run clustering
	console.error('Step 3: Clustering (UMAP + HDBSCAN)...');
	const clusteringStartTime = Date.now();

	const pipeline = new ClusteringPipeline();
	const clusteringResult = await pipeline.run({
		embeddedNotes: embeddingResult.notes,
		noteTags,
		resolvedLinks,
		files,
		previousState: null,
		config,
	});

	const clusteringMs = Date.now() - clusteringStartTime;
	console.error(`  Clusters: ${clusteringResult.result.clusters.length}`);
	console.error(`  Noise notes: ${clusteringResult.result.noiseNotes.length}`);
	console.error('');

	// Step 4: Compute evaluation metrics
	console.error('Step 4: Computing evaluation metrics...');
	const metricsStartTime = Date.now();

	// Build embeddings map
	const embeddings = new Map<string, number[]>();
	for (const note of embeddingResult.notes) {
		embeddings.set(note.notePath, note.embedding);
	}

	const evaluationInput: EvaluationInput = {
		embeddings,
		clusters: clusteringResult.result.clusters,
		noiseNotes: clusteringResult.result.noiseNotes,
		noteTags,
		totalNotes: embeddingResult.notes.length,
	};

	const evaluation = evaluateClustering(evaluationInput, {
		umap: config.umap,
		hdbscan: config.hdbscan,
	});

	const metricsMs = Date.now() - metricsStartTime;
	console.error(`  Metrics computed in ${(metricsMs / 1000).toFixed(2)}s`);
	console.error('');

	// Ensure output directory exists
	const outputDir = dirname(outputPath);
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, {recursive: true});
	}

	// Save evaluation result
	writeFileSync(outputPath, JSON.stringify(evaluation, null, 2));

	// Print summary
	console.error(formatEvaluationSummary(evaluation));
	console.error('');
	console.error(`Total time: ${((Date.now() - totalStartTime) / 1000).toFixed(2)}s`);
	console.error(`  Embedding: ${(embeddingMs / 1000).toFixed(2)}s`);
	console.error(`  Clustering: ${(clusteringMs / 1000).toFixed(2)}s`);
	console.error(`  Metrics: ${(metricsMs / 1000).toFixed(2)}s`);
	console.error('');
	console.error(`Output saved to: ${outputPath}`);
}

main().catch((err) => {
	console.error('Error:', err.message);
	console.error(err.stack);
	process.exit(1);
});
