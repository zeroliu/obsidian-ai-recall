import type {
	ConceptNamingRequest,
	ConceptNamingResponse,
	ClusterRefinementRequest,
	ClusterRefinementResponse,
	LLMConfig,
} from '@/domain/llm/types';

/**
 * Port interface for LLM operations
 * Abstracts away specific LLM providers (Claude, OpenAI, etc.) for testability
 */
export interface ILLMProvider {
	/**
	 * Process a batch of clusters for concept naming
	 * @param request - Cluster summaries to name
	 * @returns Promise resolving to naming results
	 */
	nameConceptsBatch(request: ConceptNamingRequest): Promise<ConceptNamingResponse>;

	/**
	 * Process a batch of concepts for refinement (synonym detection, misfit identification)
	 * @param request - Concepts to analyze
	 * @returns Promise resolving to refinement results
	 */
	refineClustersBatch(request: ClusterRefinementRequest): Promise<ClusterRefinementResponse>;

	/**
	 * Get current LLM configuration
	 * @returns Current configuration
	 */
	getConfig(): LLMConfig;

	/**
	 * Update LLM configuration
	 * @param config - Partial configuration to update
	 */
	updateConfig(config: Partial<LLMConfig>): void;
}
