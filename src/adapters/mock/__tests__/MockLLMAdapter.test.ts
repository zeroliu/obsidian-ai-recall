import { describe, it, expect, beforeEach } from 'vitest';
import { MockLLMAdapter } from '../MockLLMAdapter';
import type { ClusterSummary, ConceptSummary } from '@/domain/llm/types';

describe('MockLLMAdapter', () => {
	let adapter: MockLLMAdapter;

	beforeEach(() => {
		adapter = new MockLLMAdapter();
	});

	describe('nameConceptsBatch', () => {
		it('should name React clusters correctly', async () => {
			const clusters: ClusterSummary[] = [
				{
					clusterId: 'cluster-1',
					candidateNames: ['React', 'Frontend'],
					representativeTitles: ['React Hooks Guide', 'useState Examples'],
					commonTags: ['#react', '#frontend'],
					folderPath: 'tech/react',
					noteCount: 45,
				},
			];

			const response = await adapter.nameConceptsBatch({ clusters });

			expect(response.results).toHaveLength(1);
			expect(response.results[0].canonicalName).toBe('React Development');
			expect(response.results[0].quizzabilityScore).toBe(0.9);
			expect(response.results[0].isQuizzable).toBe(true);
		});

		it('should mark meeting notes as non-quizzable', async () => {
			const clusters: ClusterSummary[] = [
				{
					clusterId: 'cluster-1',
					candidateNames: ['Meetings'],
					representativeTitles: ['Standup 2024-12-20', 'Team Sync'],
					commonTags: ['#meeting'],
					folderPath: 'work/meetings',
					noteCount: 50,
				},
			];

			const response = await adapter.nameConceptsBatch({ clusters });

			expect(response.results[0].canonicalName).toBe('Meeting Notes');
			expect(response.results[0].isQuizzable).toBe(false);
			expect(response.results[0].nonQuizzableReason).toContain('Meeting notes');
		});

		it('should mark daily journal as non-quizzable', async () => {
			const clusters: ClusterSummary[] = [
				{
					clusterId: 'cluster-1',
					candidateNames: ['Daily'],
					representativeTitles: ['2024-12-25', '2024-12-24'],
					commonTags: ['#daily'],
					folderPath: 'journal',
					noteCount: 365,
				},
			];

			const response = await adapter.nameConceptsBatch({ clusters });

			expect(response.results[0].canonicalName).toBe('Daily Journal');
			expect(response.results[0].isQuizzable).toBe(false);
		});

		it('should use first candidate name when no rule matches', async () => {
			const clusters: ClusterSummary[] = [
				{
					clusterId: 'cluster-1',
					candidateNames: ['Obscure Topic'],
					representativeTitles: ['Note 1', 'Note 2'],
					commonTags: [],
					folderPath: 'misc',
					noteCount: 10,
				},
			];

			const response = await adapter.nameConceptsBatch({ clusters });

			expect(response.results[0].canonicalName).toBe('Obscure Topic');
			expect(response.results[0].quizzabilityScore).toBe(0.5);
		});

		it('should generate name from folder when no candidates', async () => {
			const clusters: ClusterSummary[] = [
				{
					clusterId: 'cluster-1',
					candidateNames: [],
					representativeTitles: [],
					commonTags: [],
					folderPath: 'machine-learning/deep_learning',
					noteCount: 5,
				},
			];

			const response = await adapter.nameConceptsBatch({ clusters });

			expect(response.results[0].canonicalName).toBe('Deep Learning');
		});

		it('should detect merge suggestions for same canonical name', async () => {
			const clusters: ClusterSummary[] = [
				{
					clusterId: 'cluster-1',
					candidateNames: ['React'],
					representativeTitles: ['React Basics'],
					commonTags: ['#react'],
					folderPath: 'tech/react',
					noteCount: 20,
				},
				{
					clusterId: 'cluster-2',
					candidateNames: ['React Hooks'],
					representativeTitles: ['React useState'],
					commonTags: ['#react'],
					folderPath: 'tech/hooks',
					noteCount: 15,
				},
			];

			const response = await adapter.nameConceptsBatch({ clusters });

			// Both should be named "React Development"
			expect(response.results[0].canonicalName).toBe('React Development');
			expect(response.results[1].canonicalName).toBe('React Development');

			// First one should suggest merging the second
			expect(response.results[0].suggestedMerges).toContain('cluster-2');
		});

		it('should include token usage', async () => {
			const clusters: ClusterSummary[] = [
				{
					clusterId: 'cluster-1',
					candidateNames: ['Test'],
					representativeTitles: ['Note 1'],
					commonTags: [],
					folderPath: '',
					noteCount: 1,
				},
			];

			const response = await adapter.nameConceptsBatch({ clusters });

			expect(response.usage).toBeDefined();
			expect(response.usage?.inputTokens).toBeGreaterThan(0);
			expect(response.usage?.outputTokens).toBeGreaterThan(0);
		});

		it('should record call in history', async () => {
			const clusters: ClusterSummary[] = [
				{
					clusterId: 'cluster-1',
					candidateNames: ['Test'],
					representativeTitles: [],
					commonTags: [],
					folderPath: '',
					noteCount: 1,
				},
			];

			await adapter.nameConceptsBatch({ clusters });

			const history = adapter._getCallHistory();
			expect(history).toHaveLength(1);
			expect(history[0].type).toBe('nameConceptsBatch');
		});
	});

	describe('refineClustersBatch', () => {
		it('should detect JS/JavaScript synonym pattern', async () => {
			const concepts: ConceptSummary[] = [
				{
					conceptId: 'concept-1',
					name: 'JavaScript Development',
					sampleTitles: ['ES6 Features', 'Async/Await'],
					noteCount: 30,
				},
				{
					conceptId: 'concept-2',
					name: 'JS Tutorials',
					sampleTitles: ['JS Basics', 'DOM Manipulation'],
					noteCount: 15,
				},
			];

			const response = await adapter.refineClustersBatch({ concepts });

			expect(response.synonymPatterns).toHaveLength(1);
			expect(response.synonymPatterns[0].primaryConceptId).toBe('concept-1');
			expect(response.synonymPatterns[0].aliasConceptIds).toContain('concept-2');
			expect(response.synonymPatterns[0].confidence).toBe(0.98);
		});

		it('should detect misfit notes', async () => {
			const concepts: ConceptSummary[] = [
				{
					conceptId: 'concept-1',
					name: 'React Development',
					sampleTitles: ['React Hooks', 'My Grocery List', 'Component Patterns'],
					noteCount: 20,
				},
			];

			const response = await adapter.refineClustersBatch({ concepts });

			expect(response.misfitNotes).toHaveLength(1);
			expect(response.misfitNotes[0].noteTitle).toBe('My Grocery List');
			expect(response.misfitNotes[0].currentConceptId).toBe('concept-1');
			expect(response.misfitNotes[0].suggestedTags).toContain('#shopping');
		});

		it('should return empty arrays when no issues found', async () => {
			const concepts: ConceptSummary[] = [
				{
					conceptId: 'concept-1',
					name: 'Python Programming',
					sampleTitles: ['Python Basics', 'Decorators', 'List Comprehensions'],
					noteCount: 25,
				},
			];

			const response = await adapter.refineClustersBatch({ concepts });

			expect(response.synonymPatterns).toHaveLength(0);
			expect(response.misfitNotes).toHaveLength(0);
		});

		it('should record call in history', async () => {
			const concepts: ConceptSummary[] = [
				{
					conceptId: 'concept-1',
					name: 'Test',
					sampleTitles: [],
					noteCount: 1,
				},
			];

			await adapter.refineClustersBatch({ concepts });

			const history = adapter._getCallHistory();
			expect(history).toHaveLength(1);
			expect(history[0].type).toBe('refineClustersBatch');
		});
	});

	describe('config', () => {
		it('should return default config', () => {
			const config = adapter.getConfig();
			expect(config.model).toBe('claude-sonnet-4-20250514');
			expect(config.batchSize).toBe(20);
		});

		it('should accept custom config in constructor', () => {
			const customAdapter = new MockLLMAdapter({ batchSize: 10 });
			const config = customAdapter.getConfig();
			expect(config.batchSize).toBe(10);
		});

		it('should update config', () => {
			adapter.updateConfig({ temperature: 0.5 });
			const config = adapter.getConfig();
			expect(config.temperature).toBe(0.5);
		});
	});

	describe('test helpers', () => {
		it('should clear call history', async () => {
			await adapter.nameConceptsBatch({
				clusters: [
					{
						clusterId: '1',
						candidateNames: [],
						representativeTitles: [],
						commonTags: [],
						folderPath: '',
						noteCount: 0,
					},
				],
			});

			expect(adapter._getCallHistory()).toHaveLength(1);

			adapter._clearCallHistory();

			expect(adapter._getCallHistory()).toHaveLength(0);
		});

		it('should add custom naming rule', async () => {
			adapter._addNamingRule({
				pattern: /custom/i,
				canonicalName: 'Custom Concept',
				quizzabilityScore: 0.77,
				isQuizzable: true,
			});

			const response = await adapter.nameConceptsBatch({
				clusters: [
					{
						clusterId: '1',
						candidateNames: ['Custom Topic'],
						representativeTitles: [],
						commonTags: [],
						folderPath: '',
						noteCount: 1,
					},
				],
			});

			expect(response.results[0].canonicalName).toBe('Custom Concept');
			expect(response.results[0].quizzabilityScore).toBe(0.77);
		});

		it('should set fixture to replace all rules', async () => {
			adapter._setFixture({
				namingRules: [
					{
						pattern: /fixture/i,
						canonicalName: 'Fixture Concept',
						quizzabilityScore: 0.66,
						isQuizzable: true,
					},
				],
				synonymRules: [],
				misfitRules: [],
			});

			// React should no longer match (default rules replaced)
			const response = await adapter.nameConceptsBatch({
				clusters: [
					{
						clusterId: '1',
						candidateNames: ['React'],
						representativeTitles: [],
						commonTags: [],
						folderPath: '',
						noteCount: 1,
					},
				],
			});

			expect(response.results[0].canonicalName).toBe('React'); // Falls back to candidate name
		});

		it('should reset to default rules', async () => {
			adapter._setFixture({
				namingRules: [],
				synonymRules: [],
				misfitRules: [],
			});

			adapter._resetRules();

			const response = await adapter.nameConceptsBatch({
				clusters: [
					{
						clusterId: '1',
						candidateNames: ['React'],
						representativeTitles: [],
						commonTags: [],
						folderPath: '',
						noteCount: 1,
					},
				],
			});

			expect(response.results[0].canonicalName).toBe('React Development');
		});
	});
});
