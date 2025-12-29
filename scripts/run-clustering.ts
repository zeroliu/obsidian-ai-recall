#!/usr/bin/env npx tsx
/**
 * Run clustering pipeline (without LLM) on a vault
 *
 * This script is a thin wrapper around PipelineOrchestrator that allows
 * running the production clustering pipeline outside of the Obsidian environment.
 *
 * Usage:
 *   TEST_VAULT_PATH=~/Documents/MyVault OPENAI_API_KEY=xxx npx tsx scripts/run-clustering.ts [options]
 *   TEST_VAULT_PATH=~/Documents/MyVault VOYAGE_API_KEY=xxx npx tsx scripts/run-clustering.ts --provider voyage [options]
 *
 * Environment:
 *   TEST_VAULT_PATH   Required. Path to the Obsidian vault to test with.
 *   OPENAI_API_KEY    Required for OpenAI embedding (default provider)
 *   VOYAGE_API_KEY    Required for Voyage AI embedding
 *
 * Options:
 *   --provider <name> Embedding provider: openai (default) or voyage
 *   --output <path>   Output directory (default: outputs)
 *   --help, -h        Show help
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  FileStorageAdapter,
  FileSystemMetadataAdapter,
  FileSystemVaultAdapter,
} from '../src/adapters/filesystem';
import { OpenAIEmbeddingAdapter } from '../src/adapters/openai/OpenAIEmbeddingAdapter';
import { VoyageEmbeddingAdapter } from '../src/adapters/voyage/VoyageEmbeddingAdapter';
import type { IEmbeddingProvider } from '../src/ports/IEmbeddingProvider';
import { PipelineOrchestrator } from '../src/domain/pipeline/PipelineOrchestrator';
import type { PersistedClusteringResult, PipelineProgress } from '../src/domain/pipeline/types';
import { getArg, requireTestVaultPath } from './lib/vault-helpers';

// ============ Main ============

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: TEST_VAULT_PATH=~/Documents/MyVault OPENAI_API_KEY=xxx npx tsx scripts/run-clustering.ts [options]
       TEST_VAULT_PATH=~/Documents/MyVault VOYAGE_API_KEY=xxx npx tsx scripts/run-clustering.ts --provider voyage [options]

Options:
  --provider <name> Embedding provider: openai (default) or voyage
  --output <path>   Output directory (default: outputs)
  --help, -h        Show help

Environment:
  TEST_VAULT_PATH   Required. Path to the Obsidian vault to test with.
  OPENAI_API_KEY    Required for OpenAI embedding (default provider)
  VOYAGE_API_KEY    Required for Voyage AI embedding

Examples:
  TEST_VAULT_PATH=~/Documents/MyVault OPENAI_API_KEY=sk-xxx npx tsx scripts/run-clustering.ts
  TEST_VAULT_PATH=~/Documents/MyVault VOYAGE_API_KEY=pa-xxx npx tsx scripts/run-clustering.ts --provider voyage
`);
    process.exit(0);
  }

  // Get vault path from environment
  const resolvedVaultPath = requireTestVaultPath();

  const providerName = getArg(args, '--provider') ?? 'openai';
  const outputDir = getArg(args, '--output') ?? 'outputs';

  // Create embedding provider based on --provider flag
  let embeddingProvider: IEmbeddingProvider;
  if (providerName === 'voyage') {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      console.error('Error: VOYAGE_API_KEY environment variable required for Voyage provider');
      process.exit(1);
    }
    embeddingProvider = new VoyageEmbeddingAdapter({ apiKey });
  } else if (providerName === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('Error: OPENAI_API_KEY environment variable required for OpenAI provider');
      process.exit(1);
    }
    embeddingProvider = new OpenAIEmbeddingAdapter({ apiKey });
  } else {
    console.error(`Error: Unknown provider "${providerName}". Use "openai" or "voyage".`);
    process.exit(1);
  }

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  console.error(`=== Clustering Pipeline ===`);
  console.error(`Vault: ${resolvedVaultPath}`);
  console.error(`Provider: ${embeddingProvider.getProviderName()} (${embeddingProvider.getModelName()})`);
  console.error(`Output: ${outputDir}`);
  console.error('');

  // Create adapters
  const vaultAdapter = new FileSystemVaultAdapter(resolvedVaultPath);
  const metadataAdapter = new FileSystemMetadataAdapter(resolvedVaultPath);
  const storageAdapter = new FileStorageAdapter(outputDir);

  // Create orchestrator (no LLM provider)
  const orchestrator = new PipelineOrchestrator(
    vaultAdapter,
    metadataAdapter,
    storageAdapter,
    embeddingProvider,
    [], // No exclude patterns
    null, // No LLM provider
  );

  // Run pipeline with progress reporting
  const result = await orchestrator.run((progress: PipelineProgress) => {
    const stageNames: Record<PipelineProgress['stage'], string> = {
      reading: 'Reading',
      embedding: 'Embedding',
      clustering: 'Clustering',
      refining: 'Refining',
      saving: 'Saving',
    };
    process.stderr.write(`\r[${stageNames[progress.stage]}] ${progress.message}`);
    if (progress.current === progress.total) {
      console.error(''); // Newline after stage completion
    }
  });

  // Load persisted result for detailed output
  const persistedResult = await storageAdapter.read<PersistedClusteringResult>('clusters');

  // Print summary
  console.error('');
  console.error('=== Results ===');
  console.error(`Total notes: ${result.totalNotes}`);
  console.error(`Excluded: ${result.excludedCount}`);
  console.error(`Clusters: ${result.clusterCount}`);
  console.error(`Noise notes: ${result.noiseCount}`);
  console.error('');
  console.error(`Total time: ${(result.timing.totalMs / 1000).toFixed(2)}s`);
  console.error(`  Embedding: ${(result.timing.embeddingMs / 1000).toFixed(2)}s`);
  console.error(`  Clustering: ${(result.timing.clusteringMs / 1000).toFixed(2)}s`);
  console.error('');
  console.error('Embedding stats:');
  console.error(`  Cache hits: ${result.embeddingStats.cacheHits}`);
  console.error(`  Cache misses: ${result.embeddingStats.cacheMisses}`);
  console.error(`  Tokens: ${result.embeddingStats.tokensProcessed}`);
  console.error(`  Estimated cost: $${result.embeddingStats.estimatedCost.toFixed(6)}`);
  console.error('');
  console.error(`Output saved to: ${join(outputDir, 'clusters.json')}`);

  // Print top clusters
  if (persistedResult) {
    console.error('');
    console.error('=== Top 10 Clusters ===');
    const sortedClusters = [...persistedResult.clusters].sort(
      (a, b) => b.noteIds.length - a.noteIds.length,
    );
    for (const cluster of sortedClusters.slice(0, 10)) {
      const name = cluster.candidateNames[0] ?? cluster.id;
      console.error(`  [${cluster.noteIds.length} notes] ${cluster.candidateNames.slice(0, 3).join(', ') || name}`);
      console.error(`    Tags: ${cluster.dominantTags.slice(0, 5).join(', ') || '(none)'}`);
      if (cluster.representativeNotes) {
        console.error(`    Representatives: ${cluster.representativeNotes.map((n) => n.title).join(', ')}`);
      }
    }
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
