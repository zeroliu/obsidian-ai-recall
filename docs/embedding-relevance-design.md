# Technical Design: Embedding-Based Note Relevance

> Replaces LLM-based note scoring with embedding-based approach for 100k+ note scalability

## Problem Statement

The current `NoteRelevanceService` sends all vault notes to an LLM for relevance scoring. This approach:

- **Does not scale**: Context window limits to ~50-100 notes per request
- **Is expensive**: Full LLM call for each scoring operation
- **Is slow**: Sequential processing, no caching

For vaults with 100,000+ notes, we need a scalable approach.

## Solution Overview

Use **vector embeddings** with **cosine similarity** for initial candidate retrieval, then **LLM reranking** for top candidates to provide explanations.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Note Assignment Flow                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ Vault Notes  │───>│ Embed Notes  │───>│ Embedding Cache      │   │
│  │  (100k+)     │    │ (Voyage AI)  │    │ (.ignite/embeddings) │   │
│  └──────────────┘    └──────────────┘    └──────────────────────┘   │
│                                                   │                  │
│  ┌──────────────┐    ┌──────────────┐             │                  │
│  │ Goal Draft   │───>│ Embed Query  │             │                  │
│  │              │    │              │             │                  │
│  └──────────────┘    └──────────────┘             │                  │
│                             │                     │                  │
│                             v                     v                  │
│                      ┌─────────────────────────────────┐            │
│                      │     Cosine Similarity Search     │            │
│                      │         (Top 40 results)         │            │
│                      └─────────────────────────────────┘            │
│                                      │                               │
│                                      v                               │
│                      ┌─────────────────────────────────┐            │
│                      │      LLM Rerank & Explain        │            │
│                      │        (Claude API)              │            │
│                      └─────────────────────────────────┘            │
│                                      │                               │
│                                      v                               │
│                      ┌─────────────────────────────────┐            │
│                      │        ScoredNote[]              │            │
│                      │   (path, score, reason, preview) │            │
│                      └─────────────────────────────────┘            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Design Decisions

### 1. Embedding Provider: Voyage AI

| Provider | Model | Dimensions | Cost/1M tokens | Max tokens |
|----------|-------|------------|----------------|------------|
| **Voyage** | voyage-3-lite | 512 | $0.02 | 16,000 |
| OpenAI | text-embedding-3-small | 1,536 | $0.02 | 8,191 |

**Choice**: Voyage AI `voyage-3-lite`
- Lower dimensionality = smaller cache size
- Higher max tokens = better for long notes
- Comparable cost

### 2. Indexing Strategy: On-Demand with Caching

**Options considered**:
- Background on startup: Slows plugin load for large vaults
- Manual trigger: Extra user action required
- **On-demand**: Compute when needed, cache for reuse

**Choice**: On-demand indexing
- First note assignment: embeds all notes (~30-60 seconds for 10k notes)
- Subsequent assignments: instant (cache hit)
- Changed notes: re-embedded automatically (content hash validation)

### 3. Top-K Candidates: 40

- Too few (10-20): May miss relevant notes
- Too many (100+): LLM context overflow, higher cost
- **40**: Good balance, fits in 4k token LLM response

### 4. LLM Reranking: Required

Embeddings provide similarity scores but not explanations. LLM reranking:
- Refines scores based on semantic understanding
- Generates human-readable explanations
- Only processes top 40 candidates (cost-effective)

## Existing Infrastructure

The following components already exist and will be reused:

### Embedding Providers

```
src/ports/IEmbeddingProvider.ts         # Interface
src/adapters/voyage/VoyageEmbeddingAdapter.ts   # Voyage implementation
src/adapters/openai/OpenAIEmbeddingAdapter.ts   # OpenAI implementation
```

### Embedding Cache

```
src/domain/embedding/cache.ts           # EmbeddingCacheManager
  - Chunked storage (1000 embeddings per chunk)
  - Content-hash validation (re-embed changed notes)
  - Persists to .ignite/embeddings/ via IStorageAdapter
```

### Embedding Orchestrator

```
src/domain/embedding/embedBatch.ts      # EmbeddingOrchestrator
  - Batch processing with configurable batch size
  - Progress callbacks
  - Automatic caching integration
  - Text preparation (strip frontmatter, summarize code)
```

### Storage

```
src/ports/IStorageAdapter.ts            # Interface
src/adapters/obsidian/ObsidianStorageAdapter.ts  # Vault storage
  - Stores JSON in .ignite/ folder
```

## Implementation Plan

### Phase 1: Settings

**File**: `src/settings.ts`

Add Voyage API key configuration:

```typescript
export interface IgniteSettings {
  anthropicApiKey: string;
  voyageApiKey: string;  // NEW
  includePaths: string[];
  excludePaths: string[];
}
```

Add validation function:

```typescript
export function validateVoyageApiKey(apiKey: string): ApiKeyValidationResult {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'Voyage API key is required for note relevance' };
  }
  // Voyage keys typically start with 'pa-'
  if (apiKey.trim().length < 10) {
    return { valid: false, error: 'API key appears to be too short' };
  }
  return { valid: true };
}
```

Add settings UI similar to Anthropic API key.

### Phase 2: Cosine Similarity Utility

**New file**: `src/domain/embedding/similarity.ts`

```typescript
/**
 * Compute cosine similarity between two vectors.
 * Voyage embeddings are unit-normalized, so this equals dot product.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }
  return dotProduct;
}

export interface SimilarityResult {
  notePath: string;
  similarity: number;  // -1 to 1
}

/**
 * Find top-k most similar notes to a query embedding.
 */
export function findTopKSimilar(
  queryEmbedding: number[],
  noteEmbeddings: Map<string, number[]>,
  k: number
): SimilarityResult[] {
  const results: SimilarityResult[] = [];

  for (const [notePath, embedding] of noteEmbeddings) {
    results.push({
      notePath,
      similarity: cosineSimilarity(queryEmbedding, embedding),
    });
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, k);
}

/**
 * Convert similarity (-1 to 1) to relevance score (0 to 100).
 */
export function similarityToRelevanceScore(similarity: number): number {
  return Math.round(((similarity + 1) / 2) * 100);
}
```

### Phase 3: EmbeddingRelevanceService

**New file**: `src/domain/goal/EmbeddingRelevanceService.ts`

```typescript
export type RelevanceProgressCallback = (
  phase: 'indexing' | 'ranking' | 'explaining',
  current: number,
  total: number,
  message?: string
) => void;

export interface EmbeddingRelevanceConfig {
  topK: number;  // Default: 40
  useLLMExplanations: boolean;  // Default: true
}

export class EmbeddingRelevanceService {
  private orchestrator: EmbeddingOrchestrator;
  private config: EmbeddingRelevanceConfig;

  constructor(
    private vaultProvider: IVaultProvider,
    private embeddingProvider: IEmbeddingProvider,
    private llmProvider: ILLMProvider,
    private storageAdapter: IStorageAdapter,
    config?: Partial<EmbeddingRelevanceConfig>
  ) {
    const cache = new EmbeddingCacheManager(storageAdapter);
    this.orchestrator = new EmbeddingOrchestrator(embeddingProvider, cache);
    this.config = { topK: 40, useLLMExplanations: true, ...config };
  }

  async scoreNotes(
    goalDraft: GoalDraft,
    includePatterns: string[],
    excludePatterns: string[],
    onProgress?: RelevanceProgressCallback
  ): Promise<ScoredNote[]> {
    // 1. Get filtered file list
    // 2. Read note contents
    // 3. Embed all notes (with caching)
    // 4. Embed goal as query
    // 5. Find top-K similar
    // 6. LLM rerank and explain
    // 7. Return ScoredNote[]
  }
}
```

**Algorithm details**:

1. **Filter files**: Apply include/exclude patterns, exclude `ignite/` folder
2. **Read contents**: Parallel file reads
3. **Embed notes**: Use `EmbeddingOrchestrator.embedNotes()` - handles caching automatically
4. **Embed query**: Combine goal name, description, milestones into query text
5. **Similarity search**: `findTopKSimilar()` returns top 40
6. **LLM rerank**: Send top 40 previews to Claude for scoring and explanations
7. **Return**: Same `ScoredNote[]` interface for UI compatibility

### Phase 4: UI Integration

**File**: `src/ui/screens/NoteAssignmentScreen.tsx`

Replace service instantiation:

```typescript
// Before
const noteRelevanceService = new NoteRelevanceService(vaultProvider, llmProvider);

// After
const embeddingProvider = new VoyageEmbeddingAdapter({
  apiKey: settings.voyageApiKey,
});
const embeddingRelevanceService = new EmbeddingRelevanceService(
  vaultProvider,
  embeddingProvider,
  llmProvider,
  storageAdapter
);
```

Add progress UI:

```typescript
interface ProgressState {
  phase: 'indexing' | 'ranking' | 'explaining';
  current: number;
  total: number;
  message: string;
}

// In loading state, show:
<ProgressBar
  value={progress.current}
  max={progress.total}
  label={getPhaseLabel(progress.phase)}
/>
<p>{progress.message}</p>
```

## File Changes Summary

| Action | File | Description |
|--------|------|-------------|
| Modify | `src/settings.ts` | Add `voyageApiKey`, validation, UI |
| Create | `src/domain/embedding/similarity.ts` | Cosine similarity utilities |
| Create | `src/domain/embedding/__tests__/similarity.test.ts` | Unit tests |
| Create | `src/domain/goal/EmbeddingRelevanceService.ts` | Main service |
| Create | `src/domain/goal/__tests__/EmbeddingRelevanceService.test.ts` | Unit tests |
| Modify | `src/domain/embedding/index.ts` | Export similarity functions |
| Modify | `src/ui/screens/NoteAssignmentScreen.tsx` | Use new service, add progress |

## Performance Characteristics

### First Run (Cold Cache)

| Vault Size | Embed Time | Cost | Cache Size |
|------------|------------|------|------------|
| 1,000 notes | ~10 sec | ~$0.10 | ~2 MB |
| 10,000 notes | ~60 sec | ~$1.00 | ~20 MB |
| 100,000 notes | ~10 min | ~$10.00 | ~200 MB |

### Subsequent Runs (Warm Cache)

| Operation | Time |
|-----------|------|
| Load embeddings from cache | ~100ms |
| Cosine similarity (100k notes) | ~50ms |
| LLM rerank (40 candidates) | ~2-3 sec |
| **Total** | **~3 sec** |

### Cache Invalidation

- Content hash tracks note changes
- Only changed notes are re-embedded
- Automatic on next note assignment

## Testing Strategy

### Unit Tests

1. **Cosine similarity**: Vector math correctness
2. **Top-K search**: Ranking correctness, edge cases
3. **Score conversion**: Mapping accuracy

### Integration Tests

1. **EmbeddingRelevanceService**: Mock providers, verify flow
2. **Caching**: Verify cache hits/misses
3. **Progress callbacks**: Verify invocation

### Manual Testing

1. Test with small vault (10 notes)
2. Test with medium vault (1000 notes)
3. Test with large vault (10k+ notes)
4. Verify cache persistence across plugin restarts

## Future Enhancements

1. **Incremental indexing**: Index new/changed notes in background
2. **Hybrid search**: Combine keyword and semantic search
3. **Provider selection**: Allow user to choose Voyage vs OpenAI
4. **Cancellation**: Add AbortController for long operations
