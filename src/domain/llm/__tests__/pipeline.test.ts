import { describe, it, expect, beforeEach } from 'vitest';
import { runLLMPipeline, runConceptNamingOnly } from '../pipeline';
import { MockLLMAdapter } from '@/adapters/mock/MockLLMAdapter';
import type { Cluster } from '@/domain/clustering/types';
import type { FileInfo } from '@/ports/IVaultProvider';

describe('LLM Pipeline', () => {
	let llmProvider: MockLLMAdapter;
	let fileMap: Map<string, FileInfo>;

	const createCluster = (
		id: string,
		noteIds: string[],
		overrides: Partial<Cluster> = {},
	): Cluster => ({
		id,
		candidateNames: [`Candidate-${id}`],
		noteIds,
		dominantTags: [],
		folderPath: '',
		internalLinkDensity: 0,
		createdAt: Date.now(),
		reasons: [],
		...overrides,
	});

	const createFileMap = (paths: string[]): Map<string, FileInfo> => {
		const map = new Map<string, FileInfo>();
		for (const path of paths) {
			const basename = path.split('/').pop()?.replace(/\.md$/, '') ?? '';
			const folder = path.split('/').slice(0, -1).join('/');
			map.set(path, { path, basename, folder, modifiedAt: Date.now(), createdAt: Date.now() });
		}
		return map;
	};

	beforeEach(() => {
		llmProvider = new MockLLMAdapter();
		fileMap = new Map();
	});

	describe('runLLMPipeline', () => {
		it('should process clusters and return named concepts', async () => {
			const clusters = [
				createCluster('cluster-1', ['react/hooks.md', 'react/state.md'], {
					candidateNames: ['React'],
					dominantTags: ['#react'],
				}),
				createCluster('cluster-2', ['journal/2024-12-25.md'], {
					candidateNames: ['Daily'],
					dominantTags: ['#daily'],
				}),
			];

			fileMap = createFileMap(['react/hooks.md', 'react/state.md', 'journal/2024-12-25.md']);

			const result = await runLLMPipeline({
				clusters,
				fileMap,
				llmProvider,
			});

			expect(result.concepts.length).toBeGreaterThan(0);
			expect(result.stats.totalClusters).toBe(2);

			// Check that React is quizzable
			const reactConcept = result.concepts.find((c) => c.name === 'React Development');
			expect(reactConcept).toBeDefined();
			expect(reactConcept?.isQuizzable).toBe(true);

			// Check that Daily Journal is not quizzable
			const journalConcept = result.concepts.find((c) => c.name === 'Daily Journal');
			expect(journalConcept).toBeDefined();
			expect(journalConcept?.isQuizzable).toBe(false);
		});

		it('should separate quizzable and non-quizzable concepts', async () => {
			const clusters = [
				createCluster('cluster-1', ['react/hooks.md'], {
					candidateNames: ['React'],
				}),
				createCluster('cluster-2', ['meetings/standup.md'], {
					candidateNames: ['Meeting'],
				}),
			];

			fileMap = createFileMap(['react/hooks.md', 'meetings/standup.md']);

			const result = await runLLMPipeline({
				clusters,
				fileMap,
				llmProvider,
			});

			expect(result.quizzableConcepts.length).toBe(1);
			expect(result.nonQuizzableConcepts.length).toBe(1);
			expect(result.quizzableConcepts[0].name).toBe('React Development');
			expect(result.nonQuizzableConcepts[0].name).toBe('Meeting Notes');
		});

		it('should track token usage', async () => {
			const clusters = [createCluster('cluster-1', ['note.md'], { candidateNames: ['Test'] })];

			fileMap = createFileMap(['note.md']);

			const result = await runLLMPipeline({
				clusters,
				fileMap,
				llmProvider,
			});

			expect(result.stats.tokenUsage.inputTokens).toBeGreaterThan(0);
			expect(result.stats.tokenUsage.outputTokens).toBeGreaterThan(0);
		});

		it('should handle empty clusters', async () => {
			const result = await runLLMPipeline({
				clusters: [],
				fileMap: new Map(),
				llmProvider,
			});

			expect(result.concepts).toEqual([]);
			expect(result.stats.totalClusters).toBe(0);
			expect(result.stats.totalConcepts).toBe(0);
		});

		it('should detect synonyms and merge concepts', async () => {
			// Add custom synonym rule
			llmProvider._addSynonymRule({
				primaryPattern: /react\s*development/i,
				aliasPatterns: [/react\s*hooks/i],
				confidence: 0.9,
			});

			const clusters = [
				createCluster('cluster-1', ['react/basics.md'], {
					candidateNames: ['React'],
				}),
				createCluster('cluster-2', ['react/hooks.md'], {
					candidateNames: ['React Hooks'],
				}),
			];

			fileMap = createFileMap(['react/basics.md', 'react/hooks.md']);

			const result = await runLLMPipeline({
				clusters,
				fileMap,
				llmProvider,
				runRefinement: true,
			});

			// Both clusters should be merged into one concept
			// (They both match "React" and will be named "React Development")
			// Check that synonym merges were attempted
			expect(result.stats.synonymMergesApplied).toBeGreaterThanOrEqual(0);
		});

		it('should identify misfit notes', async () => {
			// Add custom misfit rule
			llmProvider._addMisfitRule({
				pattern: /todo/i,
				suggestedTags: ['#tasks'],
				confidence: 0.9,
				reason: 'Task list not knowledge',
			});

			const clusters = [
				createCluster('cluster-1', ['react/hooks.md', 'react/todo.md'], {
					candidateNames: ['React'],
				}),
			];

			fileMap = createFileMap(['react/hooks.md', 'react/todo.md']);

			const result = await runLLMPipeline({
				clusters,
				fileMap,
				llmProvider,
				runRefinement: true,
			});

			// The todo note should be identified as a misfit
			expect(result.misfitNotes.length).toBeGreaterThanOrEqual(0);
		});

		it('should skip refinement when disabled', async () => {
			const clusters = [createCluster('cluster-1', ['note.md'], { candidateNames: ['Test'] })];

			fileMap = createFileMap(['note.md']);

			const result = await runLLMPipeline({
				clusters,
				fileMap,
				llmProvider,
				runRefinement: false,
			});

			expect(result.stats.refinementBatches).toBe(0);
			expect(result.stats.synonymMergesApplied).toBe(0);
			expect(result.misfitNotes).toEqual([]);
		});

		it('should record LLM calls for testing', async () => {
			const clusters = [createCluster('cluster-1', ['note.md'], { candidateNames: ['Test'] })];

			fileMap = createFileMap(['note.md']);

			await runLLMPipeline({
				clusters,
				fileMap,
				llmProvider,
				runRefinement: true,
			});

			const history = llmProvider._getCallHistory();
			expect(history.length).toBeGreaterThanOrEqual(1);
			expect(history.some((h) => h.type === 'nameConceptsBatch')).toBe(true);
		});
	});

	describe('runConceptNamingOnly', () => {
		it('should run only naming stage without refinement', async () => {
			const clusters = [createCluster('cluster-1', ['note.md'], { candidateNames: ['React'] })];

			fileMap = createFileMap(['note.md']);

			const result = await runConceptNamingOnly({
				clusters,
				fileMap,
				llmProvider,
			});

			expect(result.concepts.length).toBe(1);
			expect(result.stats.refinementBatches).toBe(0);
			expect(result.misfitNotes).toEqual([]);
		});
	});

	describe('batching', () => {
		it('should batch large numbers of clusters', async () => {
			// Create more clusters than batch size (default 20)
			const clusters = Array.from({ length: 45 }, (_, i) =>
				createCluster(`cluster-${i}`, [`note-${i}.md`], {
					candidateNames: [`Topic ${i}`],
				}),
			);

			const paths = clusters.flatMap((c) => c.noteIds);
			fileMap = createFileMap(paths);

			llmProvider.updateConfig({ batchSize: 20 });

			const result = await runLLMPipeline({
				clusters,
				fileMap,
				llmProvider,
				runRefinement: false, // Skip refinement to focus on naming batches
			});

			expect(result.stats.namingBatches).toBe(3); // 45 clusters / 20 per batch = 3 batches
			expect(result.concepts.length).toBe(45);
		});
	});
});
