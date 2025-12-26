// LLM Domain Module
// Provides concept naming and cluster refinement using LLMs

// Types
export type {
	ClusterSummary,
	ConceptNamingResult,
	Concept,
	SynonymPattern,
	MisfitNote,
	ConceptNamingRequest,
	ConceptNamingResponse,
	ConceptSummary,
	ClusterRefinementRequest,
	ClusterRefinementResponse,
	TokenUsage,
	LLMConfig,
} from './types';

export { DEFAULT_LLM_CONFIG, createConcept, generateConceptId } from './types';

// Cluster Summary Preparation
export {
	prepareClusterSummaries,
	selectRepresentativeTitles,
	batchClusterSummaries,
	DEFAULT_PREPARE_CONFIG,
} from './prepareClusterSummaries';
export type { PrepareClusterSummariesConfig } from './prepareClusterSummaries';

// Concept Naming
export {
	processConceptNaming,
	applyMergeSuggestions,
	createConceptFromResult,
	filterQuizzableConcepts,
	filterNonQuizzableConcepts,
} from './processConceptNaming';

// Cluster Refinements
export {
	applyClusterRefinements,
	applySynonymMerges,
	handleMisfitNotes,
	getMisfitNoteSuggestedTags,
	groupMisfitsByPrimaryTag,
} from './applyClusterRefinements';
export type { RefinementResult, RefinementStats } from './applyClusterRefinements';

// Pipeline
export { runLLMPipeline, runConceptNamingOnly } from './pipeline';
export type { LLMPipelineInput, LLMPipelineResult, LLMPipelineStats } from './pipeline';

// Prompts
export {
	CONCEPT_NAMING_SYSTEM_PROMPT,
	CLUSTER_REFINEMENT_SYSTEM_PROMPT,
	buildConceptNamingPrompt,
	buildClusterRefinementPrompt,
	parseNamingResponse,
	parseRefinementResponse,
} from './prompts';
