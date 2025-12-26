import type {
	ClusterSummary,
	ConceptNamingResult,
	ConceptSummary,
	SynonymPattern,
	MisfitNote,
} from './types';

/**
 * System prompt for concept naming
 */
export const CONCEPT_NAMING_SYSTEM_PROMPT = `You are an expert at organizing and naming knowledge concepts from personal notes.
Your task is to analyze note clusters and assign meaningful concept names.

For each cluster, you will:
1. Assign a canonical concept name (concise, 2-5 words)
2. Score quizzability (0-1) - how suitable for spaced repetition quiz
3. Determine if quizzable (some content types are not suitable)
4. Suggest clusters that should merge (if conceptually the same topic)

Guidelines for naming:
- Use clear, descriptive names (e.g., "React Hooks", "Golf Swing Mechanics")
- Prefer common terminology over jargon
- Avoid overly broad names (e.g., "Programming" is too vague)
- Avoid overly narrow names (e.g., "useState Hook" is too specific for a cluster)

Guidelines for quizzability:
- HIGH (0.7-1.0): Technical concepts, learning notes, how-to guides, reference material
- MEDIUM (0.4-0.7): Project notes, research, mixed content
- LOW (0.1-0.4): Personal reflections, brainstorming
- NOT QUIZZABLE: Meeting notes, daily journals, to-do lists, ephemeral content

Output JSON format only, no additional text.`;

/**
 * System prompt for cluster refinement
 */
export const CLUSTER_REFINEMENT_SYSTEM_PROMPT = `You are an expert at analyzing knowledge organization and detecting inconsistencies.
Your task is to identify two types of issues in named concepts:

1. SYNONYM PATTERNS: Concepts that should be merged because they refer to the same topic
   - Abbreviations: "JS" and "JavaScript", "FW" and "Firework"
   - Alternative names: "React Hooks" and "Hooks in React"
   - Subsets: "useState" should merge into "React Hooks"

2. MISFIT NOTES: Notes that don't belong in their current concept
   - A todo list in a "Programming" concept
   - A recipe in a "Work Projects" concept
   - Suggest tags for re-clustering, NOT a target concept

Be conservative - only flag clear issues with high confidence.
Output JSON format only, no additional text.`;

/**
 * Build user prompt for concept naming
 *
 * @param clusters - Cluster summaries to name
 * @returns User prompt string
 */
export function buildConceptNamingPrompt(clusters: ClusterSummary[]): string {
	const clusterCount = clusters.length;

	const clusterDescriptions = clusters
		.map(
			(c, i) => `
## Cluster ${i + 1}
- ID: ${c.clusterId}
- Candidate names: ${c.candidateNames.join(', ') || 'None'}
- Sample note titles: ${c.representativeTitles.join(', ') || 'None'}
- Common tags: ${c.commonTags.join(', ') || 'None'}
- Folder: ${c.folderPath || 'Root'}
- Note count: ${c.noteCount}`,
		)
		.join('\n');

	return `Analyze these ${clusterCount} note clusters and provide concept naming results.
${clusterDescriptions}

Return JSON array with this structure for each cluster:
[
  {
    "clusterId": "cluster-id",
    "canonicalName": "Concept Name",
    "quizzabilityScore": 0.85,
    "isQuizzable": true,
    "nonQuizzableReason": null,
    "suggestedMerges": []
  }
]

If a cluster should merge with another, include the target cluster ID(s) in suggestedMerges.
If not quizzable, set isQuizzable to false and provide nonQuizzableReason.`;
}

/**
 * Build user prompt for cluster refinement
 *
 * @param concepts - Concept summaries to refine
 * @returns User prompt string
 */
export function buildClusterRefinementPrompt(concepts: ConceptSummary[]): string {
	const conceptCount = concepts.length;

	const conceptDescriptions = concepts
		.map(
			(c, i) => `
## Concept ${i + 1}
- ID: ${c.conceptId}
- Name: ${c.name}
- Sample note titles: ${c.sampleTitles.join(', ') || 'None'}
- Note count: ${c.noteCount}`,
		)
		.join('\n');

	return `Analyze these ${conceptCount} concepts for synonyms and misfits.
${conceptDescriptions}

Return JSON with this structure:
{
  "synonymPatterns": [
    {
      "primaryConceptId": "concept-to-keep",
      "aliasConceptIds": ["concept-to-merge-1", "concept-to-merge-2"],
      "confidence": 0.95,
      "reason": "Explanation of why these are synonyms"
    }
  ],
  "misfitNotes": [
    {
      "noteId": "note-id",
      "noteTitle": "Note Title",
      "currentConceptId": "current-concept-id",
      "suggestedTags": ["#tag1", "#tag2"],
      "confidence": 0.8,
      "reason": "Explanation of why this note doesn't fit"
    }
  ]
}

Guidelines:
- Only include synonyms with confidence >= 0.8
- Only include misfits with confidence >= 0.7
- For misfits, suggest tags that describe where the note SHOULD go, not the target concept
- If no issues found, return empty arrays`;
}

/**
 * Parse concept naming response from LLM
 *
 * @param response - Raw LLM response text
 * @returns Parsed naming results
 * @throws Error if parsing fails
 */
export function parseNamingResponse(response: string): ConceptNamingResult[] {
	// Try to extract JSON from response
	const json = extractJSON(response);

	// Parse as array
	const parsed = JSON.parse(json);

	if (!Array.isArray(parsed)) {
		throw new Error('Expected array of naming results');
	}

	// Validate and normalize each result
	return parsed.map((item: Record<string, unknown>) => {
		if (typeof item.clusterId !== 'string') {
			throw new Error('Missing or invalid clusterId');
		}
		if (typeof item.canonicalName !== 'string') {
			throw new Error('Missing or invalid canonicalName');
		}

		return {
			clusterId: item.clusterId,
			canonicalName: item.canonicalName,
			quizzabilityScore: normalizeScore(item.quizzabilityScore),
			isQuizzable: item.isQuizzable !== false,
			nonQuizzableReason:
				typeof item.nonQuizzableReason === 'string' ? item.nonQuizzableReason : undefined,
			suggestedMerges: Array.isArray(item.suggestedMerges)
				? item.suggestedMerges.filter((id): id is string => typeof id === 'string')
				: [],
		};
	});
}

/**
 * Parse cluster refinement response from LLM
 *
 * @param response - Raw LLM response text
 * @returns Parsed refinement results
 * @throws Error if parsing fails
 */
export function parseRefinementResponse(response: string): {
	synonymPatterns: SynonymPattern[];
	misfitNotes: MisfitNote[];
} {
	// Try to extract JSON from response
	const json = extractJSON(response);

	// Parse as object
	const parsed = JSON.parse(json);

	if (typeof parsed !== 'object' || parsed === null) {
		throw new Error('Expected object with synonymPatterns and misfitNotes');
	}

	// Parse synonym patterns
	const synonymPatterns: SynonymPattern[] = [];
	if (Array.isArray(parsed.synonymPatterns)) {
		for (const item of parsed.synonymPatterns) {
			if (typeof item.primaryConceptId === 'string' && Array.isArray(item.aliasConceptIds)) {
				synonymPatterns.push({
					primaryConceptId: item.primaryConceptId,
					aliasConceptIds: item.aliasConceptIds.filter(
						(id: unknown): id is string => typeof id === 'string',
					),
					confidence: normalizeScore(item.confidence),
					reason: typeof item.reason === 'string' ? item.reason : '',
				});
			}
		}
	}

	// Parse misfit notes
	const misfitNotes: MisfitNote[] = [];
	if (Array.isArray(parsed.misfitNotes)) {
		for (const item of parsed.misfitNotes) {
			if (typeof item.noteTitle === 'string' && typeof item.currentConceptId === 'string') {
				misfitNotes.push({
					noteId: typeof item.noteId === 'string' ? item.noteId : generateNoteId(item.noteTitle),
					noteTitle: item.noteTitle,
					currentConceptId: item.currentConceptId,
					suggestedTags: Array.isArray(item.suggestedTags)
						? item.suggestedTags.filter((tag: unknown): tag is string => typeof tag === 'string')
						: [],
					confidence: normalizeScore(item.confidence),
					reason: typeof item.reason === 'string' ? item.reason : '',
				});
			}
		}
	}

	return { synonymPatterns, misfitNotes };
}

/**
 * Extract JSON from LLM response
 * Handles markdown code blocks and extra text
 */
function extractJSON(response: string): string {
	// Remove markdown code blocks
	let cleaned = response.trim();

	// Try to extract from ```json ... ``` blocks
	const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (jsonBlockMatch) {
		cleaned = jsonBlockMatch[1].trim();
	}

	// Try to find array or object start
	const arrayStart = cleaned.indexOf('[');
	const objectStart = cleaned.indexOf('{');

	if (arrayStart === -1 && objectStart === -1) {
		throw new Error('No JSON found in response');
	}

	// Determine which comes first
	let start: number;

	if (arrayStart === -1) {
		start = objectStart;
	} else if (objectStart === -1) {
		start = arrayStart;
	} else {
		start = Math.min(arrayStart, objectStart);
	}

	// Find matching end
	let depth = 0;
	let end = start;

	for (let i = start; i < cleaned.length; i++) {
		const char = cleaned[i];
		if (char === '[' || char === '{') {
			depth++;
		} else if (char === ']' || char === '}') {
			depth--;
			if (depth === 0) {
				end = i + 1;
				break;
			}
		}
	}

	return cleaned.slice(start, end);
}

/**
 * Normalize a score to 0-1 range
 */
function normalizeScore(value: unknown): number {
	if (typeof value !== 'number') {
		return 0.5;
	}
	return Math.max(0, Math.min(1, value));
}

/**
 * Generate a note ID from title
 */
function generateNoteId(title: string): string {
	return `note-${title
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')}`;
}
