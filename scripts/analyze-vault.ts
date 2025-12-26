import { readFileSync, writeFileSync } from 'node:fs';
import { runClusteringPipeline } from '../src/domain/clustering/pipeline';
import type { FileInfo } from '../src/ports/IVaultProvider';
import type { FileMetadata, ResolvedLinks } from '../src/ports/IMetadataProvider';

const fixturePath = './src/test/fixtures/zeroliu-vault.json';
const data = JSON.parse(readFileSync(fixturePath, 'utf-8'));

const files: FileInfo[] = data.vault.files;
const metadata = new Map<string, FileMetadata>(
	Object.entries(data.metadata.metadata)
);
const resolvedLinks: ResolvedLinks = data.metadata.resolvedLinks;

console.log(`Total files: ${files.length}`);
console.log(`Metadata entries: ${metadata.size}`);
console.log(`Resolved links entries: ${Object.keys(resolvedLinks).length}`);

const result = runClusteringPipeline({
	files,
	metadata,
	resolvedLinks,
});

// Sort clusters by size (largest first)
const sortedClusters = [...result.clusters].sort(
	(a, b) => b.noteIds.length - a.noteIds.length
);

const output = {
	stats: result.stats,
	clusters: sortedClusters.map((cluster) => ({
		id: cluster.id,
		noteCount: cluster.noteIds.length,
		linkDensity: cluster.internalLinkDensity ?? 0,
		reasons: cluster.reasons,
		candidateNames: cluster.candidateNames,
		dominantTags: cluster.dominantTags,
		folderPath: cluster.folderPath,
		noteIds: cluster.noteIds,
	})),
};

const outputPath = './src/test/fixtures/zeroliu-vault-clusters.json';
writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log(`\nClustering complete!`);
console.log(`Total clusters: ${result.stats.totalClusters}`);
console.log(`Results saved to: ${outputPath}`);
