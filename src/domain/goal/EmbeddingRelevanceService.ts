import { createNoteRelevancePrompt } from '@/adapters/anthropic/prompts/noteRelevance';
import {
  EmbeddingCacheManager,
  EmbeddingOrchestrator,
  findTopKSimilar,
  similarityToRelevanceScore,
} from '@/domain/embedding';
import { filterByIncludePatterns, filterExcludedPaths } from '@/domain/pipeline/pathFilter';
import type { IEmbeddingProvider, ILLMProvider, IStorageAdapter, IVaultProvider } from '@/ports';
import type { GoalDraft } from './BrainstormService';
import type { ScoredNote } from './NoteRelevanceService';

/**
 * Progress callback for relevance scoring operations.
 */
export type RelevanceProgressCallback = (
  phase: 'indexing' | 'searching' | 'explaining',
  current: number,
  total: number,
  message?: string,
) => void;

/**
 * Configuration for embedding-based relevance service.
 */
export interface EmbeddingRelevanceConfig {
  /** Number of top candidates to consider (default: 40) */
  topK: number;
  /** Whether to use LLM for explanations (default: true) */
  useLLMExplanations: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_EMBEDDING_RELEVANCE_CONFIG: EmbeddingRelevanceConfig = {
  topK: 40,
  useLLMExplanations: true,
};

/**
 * Service for embedding-based note relevance scoring.
 *
 * Uses vector embeddings with cosine similarity for initial candidate retrieval,
 * then LLM reranking for top candidates to provide explanations.
 *
 * This approach scales to 100k+ notes by:
 * 1. Embedding notes once and caching them
 * 2. Using fast cosine similarity for initial filtering
 * 3. Only sending top-K candidates to LLM for explanations
 */
export class EmbeddingRelevanceService {
  private orchestrator: EmbeddingOrchestrator;
  private config: EmbeddingRelevanceConfig;

  constructor(
    private vaultProvider: IVaultProvider,
    private embeddingProvider: IEmbeddingProvider,
    private llmProvider: ILLMProvider,
    storageAdapter: IStorageAdapter,
    config?: Partial<EmbeddingRelevanceConfig>,
  ) {
    const cache = new EmbeddingCacheManager(storageAdapter);
    this.orchestrator = new EmbeddingOrchestrator(embeddingProvider, cache);
    this.config = { ...DEFAULT_EMBEDDING_RELEVANCE_CONFIG, ...config };
  }

  /**
   * Score all notes in the vault for relevance to a goal.
   * Returns notes sorted by relevance score (highest first).
   */
  async scoreNotes(
    goalDraft: GoalDraft,
    includePatterns: string[],
    excludePatterns: string[],
    onProgress?: RelevanceProgressCallback,
  ): Promise<ScoredNote[]> {
    // 1. Get filtered file list
    let files = await this.vaultProvider.listMarkdownFiles();

    files = filterByIncludePatterns(files, includePatterns);
    const { included } = filterExcludedPaths(files, excludePatterns);
    files = included;

    // Exclude ignite folder
    files = files.filter((file) => !file.path.startsWith('ignite/'));

    if (files.length === 0) {
      return [];
    }

    // 2. Read note contents
    onProgress?.('indexing', 0, files.length, 'Reading notes...');

    const notesWithContent = await Promise.all(
      files.map(async (file) => {
        const content = await this.vaultProvider.readFile(file.path);
        return {
          notePath: file.path,
          content,
        };
      }),
    );

    // 3. Embed all notes (with caching)
    onProgress?.('indexing', 0, files.length, 'Indexing notes...');

    const embeddingResult = await this.orchestrator.embedNotes(
      notesWithContent,
      (completed, total) => {
        onProgress?.('indexing', completed, total, `Indexing notes (${completed}/${total})...`);
      },
    );

    // Build embedding map
    const noteEmbeddings = new Map<string, number[]>();
    for (const note of embeddingResult.notes) {
      noteEmbeddings.set(note.notePath, note.embedding);
    }

    // 4. Embed goal as query
    onProgress?.('searching', 0, 1, 'Preparing search query...');

    const queryText = this.buildQueryText(goalDraft);
    const queryEmbedding = await this.embedQuery(queryText);

    // 5. Similarity search
    onProgress?.('searching', 1, 1, 'Finding relevant notes...');

    const topCandidates = findTopKSimilar(queryEmbedding, noteEmbeddings, this.config.topK);

    // 6. LLM rerank and explain (if enabled)
    if (this.config.useLLMExplanations && topCandidates.length > 0) {
      onProgress?.('explaining', 0, topCandidates.length, 'Generating relevance explanations...');

      const scoredNotes = await this.rerankWithLLM(
        goalDraft,
        topCandidates,
        notesWithContent,
        onProgress,
      );

      return scoredNotes;
    }

    // Return results without LLM explanations
    return topCandidates.map((candidate) => {
      const note = notesWithContent.find((n) => n.notePath === candidate.notePath);
      return {
        path: candidate.notePath,
        score: similarityToRelevanceScore(candidate.similarity),
        reason: 'Semantically similar to goal description',
        preview: note ? this.createPreview(note.content) : undefined,
      };
    });
  }

  /**
   * Build query text from goal draft for embedding.
   */
  private buildQueryText(goalDraft: GoalDraft): string {
    const parts = [`Learning Goal: ${goalDraft.name}`, `Description: ${goalDraft.description}`];

    if (goalDraft.milestones.length > 0) {
      parts.push(`Milestones: ${goalDraft.milestones.join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Embed query text using the embedding provider.
   */
  private async embedQuery(text: string): Promise<number[]> {
    const result = await this.embeddingProvider.embed('__query__', text);
    return result.embedding;
  }

  /**
   * Use LLM to rerank and explain relevance of top candidates.
   */
  private async rerankWithLLM(
    goalDraft: GoalDraft,
    candidates: Array<{ notePath: string; similarity: number }>,
    notesWithContent: Array<{ notePath: string; content: string }>,
    onProgress?: RelevanceProgressCallback,
  ): Promise<ScoredNote[]> {
    // Build note previews for LLM
    const notePreviews = candidates.map((candidate) => {
      const note = notesWithContent.find((n) => n.notePath === candidate.notePath);
      const preview = note ? this.createPreview(note.content) : '';
      return {
        path: candidate.notePath,
        preview,
        embeddingScore: similarityToRelevanceScore(candidate.similarity),
      };
    });

    // Build prompt
    const systemPrompt = createNoteRelevancePrompt(goalDraft.name, goalDraft.description);
    const userMessage = this.buildLLMUserMessage(notePreviews);

    // Call LLM
    const response = await this.llmProvider.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      {
        temperature: 0.3,
        maxTokens: 4000,
      },
    );

    onProgress?.('explaining', candidates.length, candidates.length, 'Done!');

    // Parse LLM response
    const llmScores = this.parseLLMResponse(response.content);

    // Merge LLM scores with embedding scores
    return this.mergeScores(candidates, notePreviews, llmScores);
  }

  /**
   * Build user message for LLM with note previews.
   */
  private buildLLMUserMessage(
    notePreviews: Array<{ path: string; preview: string; embeddingScore: number }>,
  ): string {
    const noteDescriptions = notePreviews
      .map((note) => {
        return `### ${note.path}\n(Semantic similarity: ${note.embeddingScore}%)\n\n${note.preview}`;
      })
      .join('\n\n---\n\n');

    return `Please score the relevance of the following ${notePreviews.length} notes to the learning goal.

Note: These notes were pre-filtered using semantic similarity. The similarity scores are provided as additional context but you should make your own assessment based on the content.

${noteDescriptions}`;
  }

  /**
   * Parse LLM response to extract scores.
   */
  private parseLLMResponse(response: string): Map<string, { score: number; reason: string }> {
    const scores = new Map<string, { score: number; reason: string }>();

    // Look for JSON code block
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      return scores;
    }

    try {
      const parsed = JSON.parse(jsonMatch[1]);

      if (!Array.isArray(parsed)) {
        return scores;
      }

      for (const item of parsed) {
        if (
          typeof item === 'object' &&
          item !== null &&
          typeof item.notePath === 'string' &&
          typeof item.score === 'number' &&
          typeof item.reason === 'string'
        ) {
          scores.set(item.notePath, {
            score: Math.max(0, Math.min(100, item.score)),
            reason: item.reason,
          });
        }
      }
    } catch (error) {
      console.error('Failed to parse LLM note scores:', error);
    }

    return scores;
  }

  /**
   * Merge embedding scores with LLM scores.
   * LLM scores take precedence when available.
   */
  private mergeScores(
    candidates: Array<{ notePath: string; similarity: number }>,
    notePreviews: Array<{ path: string; preview: string; embeddingScore: number }>,
    llmScores: Map<string, { score: number; reason: string }>,
  ): ScoredNote[] {
    const results: ScoredNote[] = [];

    for (const candidate of candidates) {
      const preview = notePreviews.find((n) => n.path === candidate.notePath);
      const llmScore = llmScores.get(candidate.notePath);

      if (llmScore) {
        // Use LLM score and reason
        results.push({
          path: candidate.notePath,
          score: llmScore.score,
          reason: llmScore.reason,
          preview: preview?.preview,
        });
      } else {
        // Fall back to embedding score
        results.push({
          path: candidate.notePath,
          score: similarityToRelevanceScore(candidate.similarity),
          reason: 'Semantically similar to goal description',
          preview: preview?.preview,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Create a preview of note content (first 500 characters).
   */
  private createPreview(content: string): string {
    const preview = content.substring(0, 500).trim();
    if (content.length > 500) {
      return `${preview}...`;
    }
    return preview;
  }
}
