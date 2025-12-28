#!/usr/bin/env npx tsx
/**
 * Run embedding-based clustering (V2) on a vault
 *
 * Usage:
 *   OPENAI_API_KEY=xxx npx tsx scripts/run-clustering-v2.ts ~/path/to/vault [options]
 *
 * Options:
 *   --output <path>   Output file (default: outputs/vault-clusters-v2.json)
 *   --help, -h        Show help
 */

import {existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {basename, dirname, join, resolve} from 'node:path';
import {OpenAIEmbeddingAdapter} from '../src/adapters/openai/OpenAIEmbeddingAdapter';
import {EmbeddingOrchestrator} from '../src/domain/embedding/embedBatch';
import {ClusteringV2Pipeline} from '../src/domain/clustering-v2/pipeline';
import {cosineSimilarity} from '../src/domain/clustering-v2/centroidCalculator';
import type {FileInfo} from '../src/ports/IVaultProvider';
import type {ResolvedLinks} from '../src/ports/IMetadataProvider';

// ============ Types ============

interface ClusteringV2Output {
	stats: {
		totalNotes: number;
		clusteredNotes: number;
		noiseNotes: number;
		stubNotes: number;
		clusterCount: number;
		avgClusterSize: number;
		embeddingDimensions: number;
		umapDimensions: number;
		embeddingStats: {
			cacheHits: number;
			cacheMisses: number;
			tokensProcessed: number;
			estimatedCost: number;
		};
	};
	clusters: Array<{
		id: string;
		noteCount: number;
		representativeNotes: Array<{
			path: string;
			title: string;
			distanceToCentroid: number;
		}>;
		candidateNames: string[];
		dominantTags: string[];
		folderPath: string;
		internalLinkDensity: number;
	}>;
	noiseNotes: string[];
	stubs: string[];
	timing: {
		embeddingMs: number;
		clusteringMs: number;
		totalMs: number;
	};
}

// ============ Helpers ============

function findMarkdownFiles(dir: string, baseDir: string = dir): string[] {
	const files: string[] = [];
	const entries = readdirSync(dir, {withFileTypes: true});

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.name.startsWith('.') || entry.name === 'node_modules') {
			continue;
		}

		if (entry.isDirectory()) {
			files.push(...findMarkdownFiles(fullPath, baseDir));
		} else if (entry.isFile() && entry.name.endsWith('.md')) {
			files.push(fullPath);
		}
	}

	return files;
}

function parseFrontmatter(content: string): Record<string, unknown> {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) return {};

	const yamlContent = match[1];
	const frontmatter: Record<string, unknown> = {};
	const lines = yamlContent.split('\n');

	for (const line of lines) {
		const colonIndex = line.indexOf(':');
		if (colonIndex > 0) {
			const key = line.slice(0, colonIndex).trim();
			const value = line.slice(colonIndex + 1).trim();
			if (value.startsWith('[') && value.endsWith(']')) {
				frontmatter[key] = value
					.slice(1, -1)
					.split(',')
					.map((s) => s.trim().replace(/^["']|["']$/g, ''))
					.filter(Boolean);
			} else {
				frontmatter[key] = value.replace(/^["']|["']$/g, '');
			}
		}
	}

	return frontmatter;
}

function extractTags(content: string, frontmatter: Record<string, unknown>): string[] {
	const tags = new Set<string>();

	// From frontmatter
	if (frontmatter.tags) {
		const fmTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags];
		for (const tag of fmTags) {
			const normalized = String(tag).startsWith('#') ? String(tag) : `#${String(tag)}`;
			tags.add(normalized);
		}
	}

	// Inline tags
	const withoutCode = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');
	const inlineTagRegex = /(?<![`\w])#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
	let match: RegExpExecArray | null;
	while ((match = inlineTagRegex.exec(withoutCode)) !== null) {
		tags.add(`#${match[1]}`);
	}

	return Array.from(tags);
}

function extractLinks(content: string): string[] {
	const links = new Set<string>();
	const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

	let match: RegExpExecArray | null;
	while ((match = wikiLinkRegex.exec(content)) !== null) {
		let link = match[1].trim();
		const hashIndex = link.indexOf('#');
		if (hashIndex > 0) link = link.slice(0, hashIndex);
		else if (hashIndex === 0) continue;
		if (link) links.add(link);
	}

	return Array.from(links);
}

function buildResolvedLinks(
	files: string[],
	linksMap: Map<string, string[]>,
): ResolvedLinks {
	const resolvedLinks: ResolvedLinks = {};

	// Build basename to path map
	const basenameToPath: Record<string, string> = {};
	for (const filePath of files) {
		const name = basename(filePath, '.md');
		if (!basenameToPath[name] || filePath.length < basenameToPath[name].length) {
			basenameToPath[name] = filePath;
		}
	}

	for (const filePath of files) {
		const links = linksMap.get(filePath) || [];
		if (links.length === 0) continue;

		const linkCounts: Record<string, number> = {};

		for (const link of links) {
			let resolved: string | null = null;
			if (files.includes(link) || files.includes(`${link}.md`)) {
				resolved = files.includes(link) ? link : `${link}.md`;
			} else {
				resolved = basenameToPath[link] || null;
			}

			if (resolved) {
				linkCounts[resolved] = (linkCounts[resolved] || 0) + 1;
			}
		}

		if (Object.keys(linkCounts).length > 0) {
			resolvedLinks[filePath] = linkCounts;
		}
	}

	return resolvedLinks;
}

function isStubNote(content: string): boolean {
	// Remove frontmatter and code blocks
	const withoutFrontmatter = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
	const withoutCode = withoutFrontmatter.replace(/```[\s\S]*?```/g, '');
	const words = withoutCode.split(/\s+/).filter((w) => w.length > 0);
	return words.length < 50;
}

function getArg(args: string[], name: string): string | undefined {
	const index = args.indexOf(name);
	if (index !== -1 && args[index + 1]) {
		return args[index + 1];
	}
	return undefined;
}

// ============ Main ============

async function main() {
	const args = process.argv.slice(2);

	if (args.includes('--help') || args.includes('-h')) {
		console.log(`
Usage: OPENAI_API_KEY=xxx npx tsx scripts/run-clustering-v2.ts ~/path/to/vault [options]

Options:
  --output <path>   Output file (default: outputs/vault-clusters-v2.json)
  --help, -h        Show help

Environment:
  OPENAI_API_KEY    Required for embedding

Example:
  OPENAI_API_KEY=sk-xxx npx tsx scripts/run-clustering-v2.ts ~/Documents/MyVault
`);
		process.exit(0);
	}

	const vaultPath = args.find((a) => !a.startsWith('--'));
	if (!vaultPath) {
		console.error('Error: Vault path required');
		process.exit(1);
	}

	const resolvedVaultPath = resolve(vaultPath);
	if (!existsSync(resolvedVaultPath)) {
		console.error(`Error: Vault path does not exist: ${resolvedVaultPath}`);
		process.exit(1);
	}

	const outputPath = getArg(args, '--output') ?? 'outputs/vault-clusters-v2.json';

	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		console.error('Error: OPENAI_API_KEY environment variable required');
		process.exit(1);
	}

	console.error(`=== Clustering V2 Pipeline ===`);
	console.error(`Vault: ${resolvedVaultPath}`);
	console.error('');

	const totalStartTime = Date.now();

	// Step 1: Read vault
	console.error('Step 1: Reading vault...');
	const allFilePaths = findMarkdownFiles(resolvedVaultPath);
	console.error(`Found ${allFilePaths.length} markdown files`);

	const files: Map<string, FileInfo> = new Map();
	const contents: Map<string, string> = new Map();
	const noteTags: Map<string, string[]> = new Map();
	const linksMap: Map<string, string[]> = new Map();
	const stubs: string[] = [];

	for (const fullPath of allFilePaths) {
		const relativePath = fullPath.replace(resolvedVaultPath + '/', '');
		const content = readFileSync(fullPath, 'utf-8');
		const stats = statSync(fullPath);

		// Check if stub
		if (isStubNote(content)) {
			stubs.push(relativePath);
			continue;
		}

		files.set(relativePath, {
			path: relativePath,
			basename: basename(fullPath, '.md'),
			folder: dirname(relativePath) === '.' ? '' : dirname(relativePath),
			modifiedAt: stats.mtimeMs,
			createdAt: stats.birthtimeMs,
		});

		contents.set(relativePath, content);

		const frontmatter = parseFrontmatter(content);
		noteTags.set(relativePath, extractTags(content, frontmatter));
		linksMap.set(relativePath, extractLinks(content));
	}

	const relativePaths = Array.from(files.keys());
	const resolvedLinks = buildResolvedLinks(relativePaths, linksMap);

	console.error(`Non-stub notes: ${files.size}`);
	console.error(`Stub notes excluded: ${stubs.length}`);
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
	console.error(
		`Embedding complete: ${embeddingResult.notes.length} notes, ${embeddingResult.stats.tokensProcessed} tokens`,
	);
	console.error(`Estimated cost: $${embeddingResult.stats.estimatedCost.toFixed(6)}`);
	console.error('');

	// Step 3: Run clustering
	console.error('Step 3: Clustering (UMAP + HDBSCAN)...');
	const clusteringStartTime = Date.now();

	const pipeline = new ClusteringV2Pipeline();
	const clusteringResult = await pipeline.run({
		embeddedNotes: embeddingResult.notes,
		noteTags,
		resolvedLinks,
		files,
		previousState: null,
	});

	const clusteringMs = Date.now() - clusteringStartTime;
	console.error(`Clustering complete: ${clusteringResult.result.clusters.length} clusters found`);
	console.error(`Noise notes: ${clusteringResult.result.noiseNotes.length}`);
	console.error('');

	// Build output
	const embeddingMap = new Map<string, number[]>();
	for (const note of embeddingResult.notes) {
		embeddingMap.set(note.notePath, note.embedding);
	}

	const output: ClusteringV2Output = {
		stats: {
			totalNotes: allFilePaths.length,
			clusteredNotes: clusteringResult.result.clusters.reduce((sum, c) => sum + c.noteIds.length, 0),
			noiseNotes: clusteringResult.result.noiseNotes.length,
			stubNotes: stubs.length,
			clusterCount: clusteringResult.result.clusters.length,
			avgClusterSize:
				clusteringResult.result.clusters.length > 0
					? clusteringResult.result.clusters.reduce((sum, c) => sum + c.noteIds.length, 0) /
						clusteringResult.result.clusters.length
					: 0,
			embeddingDimensions: provider.getDimensions(),
			umapDimensions: 10,
			embeddingStats: {
				cacheHits: embeddingResult.stats.cacheHits,
				cacheMisses: embeddingResult.stats.cacheMisses,
				tokensProcessed: embeddingResult.stats.tokensProcessed,
				estimatedCost: embeddingResult.stats.estimatedCost,
			},
		},
		clusters: clusteringResult.result.clusters.map((cluster) => ({
			id: cluster.id,
			noteCount: cluster.noteIds.length,
			representativeNotes: cluster.representativeNotes.map((notePath) => {
				const embedding = embeddingMap.get(notePath);
				const distance = embedding && cluster.centroid
					? 1 - cosineSimilarity(embedding, cluster.centroid)
					: 0;
				return {
					path: notePath,
					title: files.get(notePath)?.basename ?? basename(notePath, '.md'),
					distanceToCentroid: distance,
				};
			}),
			candidateNames: cluster.candidateNames,
			dominantTags: cluster.dominantTags,
			folderPath: cluster.folderPath,
			internalLinkDensity: cluster.internalLinkDensity,
		})),
		noiseNotes: clusteringResult.result.noiseNotes,
		stubs,
		timing: {
			embeddingMs,
			clusteringMs,
			totalMs: Date.now() - totalStartTime,
		},
	};

	// Ensure output directory exists
	const outputDir = dirname(outputPath);
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, {recursive: true});
	}

	writeFileSync(outputPath, JSON.stringify(output, null, 2));

	// Print summary
	console.error('=== Results ===');
	console.error(`Total notes: ${output.stats.totalNotes}`);
	console.error(`Clustered: ${output.stats.clusteredNotes}`);
	console.error(`Noise: ${output.stats.noiseNotes}`);
	console.error(`Stubs: ${output.stats.stubNotes}`);
	console.error(`Clusters: ${output.stats.clusterCount}`);
	console.error(`Avg cluster size: ${output.stats.avgClusterSize.toFixed(1)}`);
	console.error('');
	console.error(`Total time: ${(output.timing.totalMs / 1000).toFixed(2)}s`);
	console.error(`  Embedding: ${(output.timing.embeddingMs / 1000).toFixed(2)}s`);
	console.error(`  Clustering: ${(output.timing.clusteringMs / 1000).toFixed(2)}s`);
	console.error('');
	console.error(`Output saved to: ${outputPath}`);

	// Print top clusters
	console.error('');
	console.error('=== Top 10 Clusters ===');
	const sortedClusters = [...output.clusters].sort((a, b) => b.noteCount - a.noteCount);
	for (const cluster of sortedClusters.slice(0, 10)) {
		console.error(
			`  [${cluster.noteCount} notes] ${cluster.candidateNames.slice(0, 3).join(', ')}`,
		);
		console.error(`    Tags: ${cluster.dominantTags.slice(0, 5).join(', ') || '(none)'}`);
		console.error(`    Representatives: ${cluster.representativeNotes.map((n) => n.title).join(', ')}`);
	}
}

main().catch((err) => {
	console.error('Error:', err.message);
	console.error(err.stack);
	process.exit(1);
});
