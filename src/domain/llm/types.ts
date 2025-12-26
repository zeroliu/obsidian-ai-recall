/**
 * LLM Domain Types for Concept Naming and Cluster Refinement
 */

/**
 * Minimal cluster info sent to LLM to save tokens
 */
export interface ClusterSummary {
	/** Unique cluster identifier */
	clusterId: string;
	/** Candidate concept names derived from cluster analysis */
	candidateNames: string[];
	/** Top note titles (max 5) representing the cluster */
	representativeTitles: string[];
	/** Most common tags in the cluster */
	commonTags: string[];
	/** Common folder path for notes */
	folderPath: string;
	/** Number of notes in the cluster */
	noteCount: number;
}

/**
 * LLM response for a single cluster's concept naming
 */
export interface ConceptNamingResult {
	/** Cluster ID this result applies to */
	clusterId: string;
	/** LLM-assigned canonical concept name */
	canonicalName: string;
	/** Quizzability score (0-1) */
	quizzabilityScore: number;
	/** Whether the concept is suitable for quizzing */
	isQuizzable: boolean;
	/** Reason if not quizzable */
	nonQuizzableReason?: string;
	/** Other cluster IDs that should merge with this one */
	suggestedMerges: string[];
}

/**
 * A named concept (final output)
 */
export interface Concept {
	/** Unique concept identifier */
	id: string;
	/** Canonical concept name */
	name: string;
	/** Note IDs (file paths) belonging to this concept */
	noteIds: string[];
	/** Quizzability score (0-1) */
	quizzabilityScore: number;
	/** Whether this concept is suitable for quizzing */
	isQuizzable: boolean;
	/** Original cluster IDs that formed this concept */
	originalClusterIds: string[];
	/** Timestamp when concept was created */
	createdAt: number;
}

/**
 * Synonym pattern detected between concepts (Stage 3.5)
 */
export interface SynonymPattern {
	/** Concept ID to keep as primary */
	primaryConceptId: string;
	/** Concept IDs to merge into primary */
	aliasConceptIds: string[];
	/** Confidence score (0-1) */
	confidence: number;
	/** Explanation of why these are synonyms */
	reason: string;
}

/**
 * A note that doesn't fit its current concept (Stage 3.5)
 */
export interface MisfitNote {
	/** Note ID (file path) */
	noteId: string;
	/** Note title for display */
	noteTitle: string;
	/** Current concept ID the note belongs to */
	currentConceptId: string;
	/** Suggested tags for re-clustering */
	suggestedTags: string[];
	/** Confidence score (0-1) */
	confidence: number;
	/** Explanation of why this note is a misfit */
	reason: string;
}

/**
 * Request for concept naming batch
 */
export interface ConceptNamingRequest {
	/** Cluster summaries to name */
	clusters: ClusterSummary[];
}

/**
 * Response from concept naming batch
 */
export interface ConceptNamingResponse {
	/** Naming results for each cluster */
	results: ConceptNamingResult[];
	/** Token usage statistics */
	usage?: TokenUsage;
}

/**
 * Summary of a concept for refinement stage
 */
export interface ConceptSummary {
	/** Concept ID */
	conceptId: string;
	/** Concept name */
	name: string;
	/** Sample note titles (max 5) */
	sampleTitles: string[];
	/** Number of notes in concept */
	noteCount: number;
}

/**
 * Request for cluster refinement batch
 */
export interface ClusterRefinementRequest {
	/** Concepts to analyze for refinement */
	concepts: ConceptSummary[];
}

/**
 * Response from cluster refinement batch
 */
export interface ClusterRefinementResponse {
	/** Detected synonym patterns */
	synonymPatterns: SynonymPattern[];
	/** Detected misfit notes */
	misfitNotes: MisfitNote[];
	/** Token usage statistics */
	usage?: TokenUsage;
}

/**
 * Token usage statistics from LLM call
 */
export interface TokenUsage {
	/** Input tokens consumed */
	inputTokens: number;
	/** Output tokens generated */
	outputTokens: number;
}

/**
 * Configuration for LLM provider
 */
export interface LLMConfig {
	/** API key for the LLM service */
	apiKey?: string;
	/** Model to use */
	model: string;
	/** Maximum tokens in response */
	maxTokens: number;
	/** Temperature for generation (0-1) */
	temperature: number;
	/** Number of clusters per batch */
	batchSize: number;
	/** Maximum retries on failure */
	maxRetries: number;
	/** Base delay for exponential backoff (ms) */
	retryBaseDelay: number;
}

/**
 * Default LLM configuration
 */
export const DEFAULT_LLM_CONFIG: LLMConfig = {
	model: 'claude-sonnet-4-20250514',
	maxTokens: 4096,
	temperature: 0.3,
	batchSize: 20,
	maxRetries: 3,
	retryBaseDelay: 1000,
};

/**
 * Helper to create a concept with defaults
 */
export function createConcept(
	partial: Partial<Concept> & { name: string; noteIds: string[] },
): Concept {
	return {
		id: partial.id ?? `concept-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		name: partial.name,
		noteIds: partial.noteIds,
		quizzabilityScore: partial.quizzabilityScore ?? 0.5,
		isQuizzable: partial.isQuizzable ?? true,
		originalClusterIds: partial.originalClusterIds ?? [],
		createdAt: partial.createdAt ?? Date.now(),
	};
}

/**
 * Generate a unique concept ID
 */
export function generateConceptId(): string {
	return `concept-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
