import { describe, it, expect } from 'vitest';
import {
	CONCEPT_NAMING_SYSTEM_PROMPT,
	CLUSTER_REFINEMENT_SYSTEM_PROMPT,
	buildConceptNamingPrompt,
	buildClusterRefinementPrompt,
	parseNamingResponse,
	parseRefinementResponse,
} from '../prompts';
import type { ClusterSummary, ConceptSummary } from '../types';

describe('prompts', () => {
	describe('system prompts', () => {
		it('should have concept naming system prompt', () => {
			expect(CONCEPT_NAMING_SYSTEM_PROMPT).toContain('concept name');
			expect(CONCEPT_NAMING_SYSTEM_PROMPT).toContain('quizzability');
			expect(CONCEPT_NAMING_SYSTEM_PROMPT).toContain('JSON');
		});

		it('should have cluster refinement system prompt', () => {
			expect(CLUSTER_REFINEMENT_SYSTEM_PROMPT).toContain('SYNONYM');
			expect(CLUSTER_REFINEMENT_SYSTEM_PROMPT).toContain('MISFIT');
			expect(CLUSTER_REFINEMENT_SYSTEM_PROMPT).toContain('JSON');
		});
	});

	describe('buildConceptNamingPrompt', () => {
		it('should build prompt with cluster information', () => {
			const clusters: ClusterSummary[] = [
				{
					clusterId: 'cluster-1',
					candidateNames: ['React', 'Frontend'],
					representativeTitles: ['Hooks Guide', 'State Management'],
					commonTags: ['#react', '#frontend'],
					folderPath: 'tech/react',
					noteCount: 45,
				},
			];

			const prompt = buildConceptNamingPrompt(clusters);

			expect(prompt).toContain('cluster-1');
			expect(prompt).toContain('React, Frontend');
			expect(prompt).toContain('Hooks Guide');
			expect(prompt).toContain('#react');
			expect(prompt).toContain('tech/react');
			expect(prompt).toContain('45');
		});

		it('should handle multiple clusters', () => {
			const clusters: ClusterSummary[] = [
				{
					clusterId: 'cluster-1',
					candidateNames: ['React'],
					representativeTitles: ['Note 1'],
					commonTags: [],
					folderPath: '',
					noteCount: 10,
				},
				{
					clusterId: 'cluster-2',
					candidateNames: ['Python'],
					representativeTitles: ['Note 2'],
					commonTags: [],
					folderPath: '',
					noteCount: 20,
				},
			];

			const prompt = buildConceptNamingPrompt(clusters);

			expect(prompt).toContain('2 note clusters');
			expect(prompt).toContain('Cluster 1');
			expect(prompt).toContain('Cluster 2');
		});

		it('should handle empty values', () => {
			const clusters: ClusterSummary[] = [
				{
					clusterId: 'cluster-1',
					candidateNames: [],
					representativeTitles: [],
					commonTags: [],
					folderPath: '',
					noteCount: 0,
				},
			];

			const prompt = buildConceptNamingPrompt(clusters);

			expect(prompt).toContain('Candidate names: None');
			expect(prompt).toContain('Common tags: None');
			expect(prompt).toContain('Folder: Root');
		});
	});

	describe('buildClusterRefinementPrompt', () => {
		it('should build prompt with concept information', () => {
			const concepts: ConceptSummary[] = [
				{
					conceptId: 'concept-1',
					name: 'React Development',
					sampleTitles: ['Hooks', 'State', 'Props'],
					noteCount: 30,
				},
			];

			const prompt = buildClusterRefinementPrompt(concepts);

			expect(prompt).toContain('concept-1');
			expect(prompt).toContain('React Development');
			expect(prompt).toContain('Hooks, State, Props');
			expect(prompt).toContain('30');
		});
	});

	describe('parseNamingResponse', () => {
		it('should parse valid JSON array', () => {
			const response = `[
				{
					"clusterId": "cluster-1",
					"canonicalName": "React Development",
					"quizzabilityScore": 0.9,
					"isQuizzable": true,
					"nonQuizzableReason": null,
					"suggestedMerges": []
				}
			]`;

			const results = parseNamingResponse(response);

			expect(results).toHaveLength(1);
			expect(results[0].clusterId).toBe('cluster-1');
			expect(results[0].canonicalName).toBe('React Development');
			expect(results[0].quizzabilityScore).toBe(0.9);
			expect(results[0].isQuizzable).toBe(true);
		});

		it('should parse JSON from markdown code block', () => {
			const response = `Here are the results:

\`\`\`json
[
	{
		"clusterId": "cluster-1",
		"canonicalName": "Test",
		"quizzabilityScore": 0.5,
		"isQuizzable": true,
		"suggestedMerges": []
	}
]
\`\`\`

That's all!`;

			const results = parseNamingResponse(response);

			expect(results).toHaveLength(1);
			expect(results[0].canonicalName).toBe('Test');
		});

		it('should normalize score out of range', () => {
			const response = `[
				{
					"clusterId": "cluster-1",
					"canonicalName": "Test",
					"quizzabilityScore": 1.5,
					"isQuizzable": true,
					"suggestedMerges": []
				}
			]`;

			const results = parseNamingResponse(response);

			expect(results[0].quizzabilityScore).toBe(1);
		});

		it('should handle non-quizzable with reason', () => {
			const response = `[
				{
					"clusterId": "cluster-1",
					"canonicalName": "Meeting Notes",
					"quizzabilityScore": 0.1,
					"isQuizzable": false,
					"nonQuizzableReason": "Ephemeral content",
					"suggestedMerges": []
				}
			]`;

			const results = parseNamingResponse(response);

			expect(results[0].isQuizzable).toBe(false);
			expect(results[0].nonQuizzableReason).toBe('Ephemeral content');
		});

		it('should handle suggested merges', () => {
			const response = `[
				{
					"clusterId": "cluster-1",
					"canonicalName": "JavaScript",
					"quizzabilityScore": 0.9,
					"isQuizzable": true,
					"suggestedMerges": ["cluster-2", "cluster-3"]
				}
			]`;

			const results = parseNamingResponse(response);

			expect(results[0].suggestedMerges).toEqual(['cluster-2', 'cluster-3']);
		});

		it('should throw on invalid JSON', () => {
			expect(() => parseNamingResponse('not json')).toThrow();
		});

		it('should throw on non-array', () => {
			expect(() => parseNamingResponse('{"foo": "bar"}')).toThrow('Expected array');
		});

		it('should throw on missing required fields', () => {
			expect(() => parseNamingResponse('[{"foo": "bar"}]')).toThrow('clusterId');
		});
	});

	describe('parseRefinementResponse', () => {
		it('should parse valid refinement response', () => {
			const response = `{
				"synonymPatterns": [
					{
						"primaryConceptId": "concept-1",
						"aliasConceptIds": ["concept-2"],
						"confidence": 0.95,
						"reason": "JS is JavaScript"
					}
				],
				"misfitNotes": [
					{
						"noteId": "note-1",
						"noteTitle": "Grocery List",
						"currentConceptId": "concept-3",
						"suggestedTags": ["#personal"],
						"confidence": 0.9,
						"reason": "Not programming content"
					}
				]
			}`;

			const result = parseRefinementResponse(response);

			expect(result.synonymPatterns).toHaveLength(1);
			expect(result.synonymPatterns[0].primaryConceptId).toBe('concept-1');
			expect(result.synonymPatterns[0].confidence).toBe(0.95);

			expect(result.misfitNotes).toHaveLength(1);
			expect(result.misfitNotes[0].noteTitle).toBe('Grocery List');
			expect(result.misfitNotes[0].suggestedTags).toContain('#personal');
		});

		it('should handle empty arrays', () => {
			const response = `{
				"synonymPatterns": [],
				"misfitNotes": []
			}`;

			const result = parseRefinementResponse(response);

			expect(result.synonymPatterns).toEqual([]);
			expect(result.misfitNotes).toEqual([]);
		});

		it('should generate noteId if missing', () => {
			const response = `{
				"synonymPatterns": [],
				"misfitNotes": [
					{
						"noteTitle": "My Test Note",
						"currentConceptId": "concept-1",
						"suggestedTags": [],
						"confidence": 0.8,
						"reason": "Test"
					}
				]
			}`;

			const result = parseRefinementResponse(response);

			expect(result.misfitNotes[0].noteId).toBe('note-my-test-note');
		});

		it('should handle JSON in markdown code block', () => {
			const response = `\`\`\`json
{
	"synonymPatterns": [],
	"misfitNotes": []
}
\`\`\``;

			const result = parseRefinementResponse(response);

			expect(result.synonymPatterns).toEqual([]);
			expect(result.misfitNotes).toEqual([]);
		});

		it('should throw on invalid JSON', () => {
			expect(() => parseRefinementResponse('not json')).toThrow();
		});
	});
});
