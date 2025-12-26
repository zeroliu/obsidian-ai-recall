import type { Cluster } from '@/domain/clustering/types';
import type { FileInfo } from '@/ports/IVaultProvider';
import type { ILLMProvider } from '@/ports/ILLMProvider';
import type { Concept, ConceptNamingResult, ConceptSummary, MisfitNote, TokenUsage } from './types';
import { prepareClusterSummaries, batchClusterSummaries } from './prepareClusterSummaries';
import { processConceptNaming } from './processConceptNaming';
import { applyClusterRefinements } from './applyClusterRefinements';

/**
 * Input for the LLM pipeline
 */
export interface LLMPipelineInput {
	/** Clusters from the clustering pipeline */
	clusters: Cluster[];
	/** Map of file paths to FileInfo for getting titles */
	fileMap: Map<string, FileInfo>;
	/** LLM provider instance */
	llmProvider: ILLMProvider;
	/** Whether to run refinement stage (Stage 3.5) */
	runRefinement?: boolean;
}

/**
 * Result from the LLM pipeline
 */
export interface LLMPipelineResult {
	/** Named concepts */
	concepts: Concept[];
	/** Quizzable concepts only */
	quizzableConcepts: Concept[];
	/** Non-quizzable concepts */
	nonQuizzableConcepts: Concept[];
	/** Misfit notes identified during refinement */
	misfitNotes: MisfitNote[];
	/** Pipeline statistics */
	stats: LLMPipelineStats;
}

/**
 * Statistics about the LLM pipeline run
 */
export interface LLMPipelineStats {
	/** Total clusters processed */
	totalClusters: number;
	/** Total concepts created */
	totalConcepts: number;
	/** Number of quizzable concepts */
	quizzableConceptCount: number;
	/** Number of non-quizzable concepts */
	nonQuizzableConceptCount: number;
	/** Number of batches for concept naming */
	namingBatches: number;
	/** Number of batches for refinement */
	refinementBatches: number;
	/** Token usage statistics */
	tokenUsage: TokenUsage;
	/** Synonym merges applied */
	synonymMergesApplied: number;
	/** Notes removed as misfits */
	misfitNotesRemoved: number;
}

/**
 * Run the complete LLM pipeline (Stage 3 + Stage 3.5)
 *
 * The pipeline executes the following steps:
 * 1. Prepare cluster summaries for LLM
 * 2. Batch clusters for efficient LLM calls
 * 3. Call LLM to name concepts (Stage 3)
 * 4. Process naming results into concepts
 * 5. Optionally run refinement (Stage 3.5):
 *    - Detect synonym patterns
 *    - Identify misfit notes
 *    - Apply merges and removals
 *
 * @param input - Pipeline input
 * @returns Pipeline result with named concepts and statistics
 */
export async function runLLMPipeline(input: LLMPipelineInput): Promise<LLMPipelineResult> {
	const { clusters, fileMap, llmProvider, runRefinement = true } = input;
	const config = llmProvider.getConfig();

	// Initialize token tracking
	const tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

	// Step 1: Prepare cluster summaries
	const summaries = prepareClusterSummaries(clusters, fileMap, {
		batchSize: config.batchSize,
	});

	// Step 2: Batch summaries
	const batches = batchClusterSummaries(summaries, config.batchSize);

	// Step 3: Call LLM to name concepts
	const allResults: ConceptNamingResult[] = [];

	for (const batch of batches) {
		const response = await llmProvider.nameConceptsBatch({ clusters: batch });
		allResults.push(...response.results);

		if (response.usage) {
			tokenUsage.inputTokens += response.usage.inputTokens;
			tokenUsage.outputTokens += response.usage.outputTokens;
		}
	}

	// Step 4: Process results into concepts
	let concepts = processConceptNaming(clusters, allResults);

	// Initialize refinement stats
	let synonymMergesApplied = 0;
	let misfitNotesRemoved = 0;
	let misfitNotes: MisfitNote[] = [];
	let refinementBatches = 0;

	// Step 5: Run refinement if enabled
	if (runRefinement && concepts.length > 0) {
		const refinementResult = await runRefinementStage(concepts, llmProvider, tokenUsage);
		concepts = refinementResult.concepts;
		misfitNotes = refinementResult.misfitNotes;
		synonymMergesApplied = refinementResult.synonymMergesApplied;
		misfitNotesRemoved = refinementResult.misfitNotesRemoved;
		refinementBatches = refinementResult.batchCount;
	}

	// Separate quizzable and non-quizzable
	const quizzableConcepts = concepts.filter((c) => c.isQuizzable);
	const nonQuizzableConcepts = concepts.filter((c) => !c.isQuizzable);

	return {
		concepts,
		quizzableConcepts,
		nonQuizzableConcepts,
		misfitNotes,
		stats: {
			totalClusters: clusters.length,
			totalConcepts: concepts.length,
			quizzableConceptCount: quizzableConcepts.length,
			nonQuizzableConceptCount: nonQuizzableConcepts.length,
			namingBatches: batches.length,
			refinementBatches,
			tokenUsage,
			synonymMergesApplied,
			misfitNotesRemoved,
		},
	};
}

/**
 * Run the refinement stage (Stage 3.5)
 */
async function runRefinementStage(
	concepts: Concept[],
	llmProvider: ILLMProvider,
	tokenUsage: TokenUsage,
): Promise<{
	concepts: Concept[];
	misfitNotes: MisfitNote[];
	synonymMergesApplied: number;
	misfitNotesRemoved: number;
	batchCount: number;
}> {
	const config = llmProvider.getConfig();

	// Prepare concept summaries for refinement
	const conceptSummaries: ConceptSummary[] = concepts.map((concept) => ({
		conceptId: concept.id,
		name: concept.name,
		sampleTitles: concept.noteIds.slice(0, 5).map((noteId) => {
			const fileName = noteId.split('/').pop() || noteId;
			return fileName.replace(/\.md$/i, '');
		}),
		noteCount: concept.noteIds.length,
	}));

	// Batch concept summaries
	const batches: ConceptSummary[][] = [];
	for (let i = 0; i < conceptSummaries.length; i += config.batchSize) {
		batches.push(conceptSummaries.slice(i, i + config.batchSize));
	}

	// Collect all refinement results
	let allSynonymPatterns: import('./types').SynonymPattern[] = [];
	let allMisfitNotes: MisfitNote[] = [];

	for (const batch of batches) {
		const response = await llmProvider.refineClustersBatch({ concepts: batch });
		allSynonymPatterns = allSynonymPatterns.concat(response.synonymPatterns);
		allMisfitNotes = allMisfitNotes.concat(response.misfitNotes);

		if (response.usage) {
			tokenUsage.inputTokens += response.usage.inputTokens;
			tokenUsage.outputTokens += response.usage.outputTokens;
		}
	}

	// Apply refinements
	const result = applyClusterRefinements(concepts, allSynonymPatterns, allMisfitNotes);

	return {
		concepts: result.concepts,
		misfitNotes: allMisfitNotes,
		synonymMergesApplied: result.stats.synonymMergesApplied,
		misfitNotesRemoved: result.stats.notesRemoved,
		batchCount: batches.length,
	};
}

/**
 * Run only the concept naming stage (Stage 3) without refinement
 *
 * @param input - Pipeline input (runRefinement will be ignored)
 * @returns Pipeline result without refinement
 */
export async function runConceptNamingOnly(
	input: Omit<LLMPipelineInput, 'runRefinement'>,
): Promise<LLMPipelineResult> {
	return runLLMPipeline({ ...input, runRefinement: false });
}
