import type {
  BatchEmbeddingResult,
  EmbeddingInput,
  EmbeddingResult as EmbeddingProviderResult,
  IEmbeddingProvider,
  ILLMProvider,
  IStorageAdapter,
  IVaultProvider,
  LLMStreamCallbacks,
} from '@/ports';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoalDraft } from '../BrainstormService';
import { EmbeddingRelevanceService } from '../EmbeddingRelevanceService';

describe('EmbeddingRelevanceService', () => {
  let service: EmbeddingRelevanceService;
  let mockVaultProvider: IVaultProvider;
  let mockEmbeddingProvider: IEmbeddingProvider;
  let mockLLMProvider: ILLMProvider;
  let mockStorageAdapter: IStorageAdapter;
  let storedFiles: Map<string, string>;
  let storedData: Map<string, unknown>;

  // Helper to create unit-normalized embeddings
  function createEmbedding(values: number[]): number[] {
    const magnitude = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
    return values.map((v) => v / magnitude);
  }

  beforeEach(() => {
    storedFiles = new Map();
    storedData = new Map();

    // Add mock notes with different content
    storedFiles.set(
      'notes/typescript.md',
      '# TypeScript\n\nTypeScript is a typed superset of JavaScript. It adds static types to the language.',
    );
    storedFiles.set(
      'notes/react.md',
      '# React\n\nReact is a JavaScript library for building user interfaces. It uses a component model.',
    );
    storedFiles.set(
      'notes/python.md',
      '# Python\n\nPython is a high-level programming language. It emphasizes code readability.',
    );
    storedFiles.set(
      'notes/cooking.md',
      '# Cooking Recipes\n\nThis note contains various cooking recipes. Pasta, soup, and more.',
    );

    mockVaultProvider = {
      listMarkdownFiles: vi.fn(async () => {
        return Array.from(storedFiles.keys()).map((path) => ({
          path,
          basename: path.split('/').pop()?.replace('.md', '') ?? '',
          folder: path.split('/').slice(0, -1).join('/'),
          modifiedAt: Date.now(),
          createdAt: Date.now(),
        }));
      }),
      readFile: vi.fn(async (path: string) => {
        const content = storedFiles.get(path);
        if (!content) throw new Error(`File not found: ${path}`);
        return content;
      }),
      exists: vi.fn(async (path: string) => storedFiles.has(path)),
      getBasename: vi.fn((path: string) => path.split('/').pop()?.replace('.md', '') ?? ''),
      getFolder: vi.fn((path: string) => path.split('/').slice(0, -1).join('/')),
      createFile: vi.fn(async () => {}),
      modifyFile: vi.fn(async () => {}),
      createFolder: vi.fn(async () => {}),
      deleteFile: vi.fn(async () => {}),
      deleteFolder: vi.fn(async () => {}),
    };

    // Mock embedding provider that returns embeddings based on content
    const embeddingMap: Record<string, number[]> = {
      'notes/typescript.md': createEmbedding([0.9, 0.8, 0.1]), // Programming related
      'notes/react.md': createEmbedding([0.8, 0.9, 0.1]), // Programming related
      'notes/python.md': createEmbedding([0.85, 0.75, 0.1]), // Programming related
      'notes/cooking.md': createEmbedding([0.1, 0.1, 0.9]), // Cooking related
      __query__: createEmbedding([0.95, 0.85, 0.05]), // Query about TypeScript
    };

    mockEmbeddingProvider = {
      embedBatch: vi.fn(async (inputs: EmbeddingInput[]): Promise<BatchEmbeddingResult> => {
        const embeddings: EmbeddingProviderResult[] = inputs.map((input) => ({
          notePath: input.notePath,
          embedding: embeddingMap[input.notePath] ?? createEmbedding([0.1, 0.1, 0.1]),
          tokenCount: Math.ceil(input.text.length / 4),
        }));
        return {
          embeddings,
          totalTokens: embeddings.reduce((sum, e) => sum + e.tokenCount, 0),
          usage: {
            totalTokens: 100,
            apiCalls: 1,
            estimatedCost: 0.001,
          },
        };
      }),
      embed: vi.fn(async (notePath: string, text: string): Promise<EmbeddingProviderResult> => {
        return {
          notePath,
          embedding: embeddingMap[notePath] ?? createEmbedding([0.95, 0.85, 0.05]),
          tokenCount: Math.ceil(text.length / 4),
        };
      }),
      getDimensions: vi.fn(() => 3),
      getProviderName: vi.fn(() => 'MockEmbedding'),
      getModelName: vi.fn(() => 'mock-model'),
      estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
      getConfig: vi.fn(() => ({
        model: 'mock-model',
        maxTokensPerText: 8000,
        batchSize: 100,
        maxRetries: 3,
        retryBaseDelay: 1000,
      })),
      updateConfig: vi.fn(),
    };

    mockLLMProvider = {
      chat: vi.fn(async () => ({
        content: `\`\`\`json
[
  {"notePath": "notes/typescript.md", "score": 95, "reason": "Directly covers TypeScript concepts"},
  {"notePath": "notes/react.md", "score": 80, "reason": "Related JavaScript library"},
  {"notePath": "notes/python.md", "score": 60, "reason": "Different programming language"},
  {"notePath": "notes/cooking.md", "score": 5, "reason": "Unrelated to programming"}
]
\`\`\``,
        usage: { inputTokens: 500, outputTokens: 200 },
      })),
      streamChat: vi.fn(
        async (_messages: unknown, callbacks: LLMStreamCallbacks): Promise<void> => {
          callbacks.onComplete({
            content: 'streamed response',
            usage: { inputTokens: 100, outputTokens: 200 },
          });
        },
      ),
      getProviderName: vi.fn(() => 'MockLLM'),
      getModelName: vi.fn(() => 'mock-llm'),
      getMaxTokens: vi.fn(() => 100000),
      estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
    };

    mockStorageAdapter = {
      read: vi.fn().mockImplementation(async (key: string) => storedData.get(key) ?? null),
      write: vi.fn().mockImplementation(async (key: string, data: unknown) => {
        storedData.set(key, data);
      }),
      exists: vi.fn().mockImplementation(async (key: string) => storedData.has(key)),
      delete: vi.fn().mockImplementation(async (key: string) => {
        storedData.delete(key);
      }),
      keys: vi.fn().mockImplementation(async () => Array.from(storedData.keys())),
      clear: vi.fn().mockImplementation(async () => {
        storedData.clear();
      }),
    } as IStorageAdapter;

    service = new EmbeddingRelevanceService(
      mockVaultProvider,
      mockEmbeddingProvider,
      mockLLMProvider,
      mockStorageAdapter,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('scoreNotes', () => {
    const goalDraft: GoalDraft = {
      name: 'Learn TypeScript',
      description: 'Master TypeScript for better JavaScript development',
      deadline: '2025-12-31',
      milestones: ['Learn type basics', 'Understand generics'],
    };

    it('should score notes and return sorted results', async () => {
      const scores = await service.scoreNotes(goalDraft, [], []);

      expect(scores.length).toBe(4);
      // Should be sorted by score descending
      expect(scores[0].path).toBe('notes/typescript.md');
      expect(scores[0].score).toBe(95);
      expect(scores[scores.length - 1].path).toBe('notes/cooking.md');
      expect(scores[scores.length - 1].score).toBe(5);
    });

    it('should include reasons from LLM', async () => {
      const scores = await service.scoreNotes(goalDraft, [], []);

      expect(scores[0].reason).toBe('Directly covers TypeScript concepts');
      expect(scores[3].reason).toBe('Unrelated to programming');
    });

    it('should include previews for each note', async () => {
      const scores = await service.scoreNotes(goalDraft, [], []);

      expect(scores[0].preview).toContain('TypeScript');
      expect(scores[3].preview).toContain('Cooking');
    });

    it('should filter notes by include patterns', async () => {
      // Only include typescript notes
      const scores = await service.scoreNotes(goalDraft, ['notes/typescript.md'], []);

      expect(scores.length).toBe(1);
      expect(scores[0].path).toBe('notes/typescript.md');
    });

    it('should filter notes by exclude patterns', async () => {
      // Exclude cooking notes
      const scores = await service.scoreNotes(goalDraft, [], ['notes/cooking.md']);

      expect(scores.length).toBe(3);
      expect(scores.find((s) => s.path === 'notes/cooking.md')).toBeUndefined();
    });

    it('should exclude ignite folder by default', async () => {
      // Add an ignite folder note
      storedFiles.set('ignite/goal1.md', '# Goal 1\n\nGoal content');

      const scores = await service.scoreNotes(goalDraft, [], []);

      expect(scores.find((s) => s.path.startsWith('ignite/'))).toBeUndefined();
    });

    it('should return empty array when no notes match filters', async () => {
      const scores = await service.scoreNotes(goalDraft, ['nonexistent/**'], []);

      expect(scores).toEqual([]);
    });

    it('should call embedding provider for notes', async () => {
      await service.scoreNotes(goalDraft, [], []);

      expect(mockEmbeddingProvider.embedBatch).toHaveBeenCalled();
      expect(mockEmbeddingProvider.embed).toHaveBeenCalled();
    });

    it('should call LLM for explanations', async () => {
      await service.scoreNotes(goalDraft, [], []);

      expect(mockLLMProvider.chat).toHaveBeenCalled();
    });

    it('should report progress during scoring', async () => {
      const progressUpdates: Array<{
        phase: string;
        current: number;
        total: number;
        message?: string;
      }> = [];

      await service.scoreNotes(goalDraft, [], [], (phase, current, total, message) => {
        progressUpdates.push({ phase, current, total, message });
      });

      // Should have indexing, searching, and explaining phases
      expect(progressUpdates.some((p) => p.phase === 'indexing')).toBe(true);
      expect(progressUpdates.some((p) => p.phase === 'searching')).toBe(true);
      expect(progressUpdates.some((p) => p.phase === 'explaining')).toBe(true);
    });
  });

  describe('without LLM explanations', () => {
    it('should return embedding scores when LLM explanations disabled', async () => {
      const serviceWithoutLLM = new EmbeddingRelevanceService(
        mockVaultProvider,
        mockEmbeddingProvider,
        mockLLMProvider,
        mockStorageAdapter,
        { useLLMExplanations: false, topK: 40 },
      );

      const goalDraft: GoalDraft = {
        name: 'Learn TypeScript',
        description: 'Master TypeScript',
        deadline: '2025-12-31',
        milestones: [],
      };

      const scores = await serviceWithoutLLM.scoreNotes(goalDraft, [], []);

      // Should still return scores
      expect(scores.length).toBeGreaterThan(0);

      // LLM should not be called
      expect(mockLLMProvider.chat).not.toHaveBeenCalled();

      // Should have generic reason
      expect(scores[0].reason).toBe('Semantically similar to goal description');
    });
  });

  describe('LLM response parsing', () => {
    it('should handle malformed LLM response', async () => {
      mockLLMProvider.chat = vi.fn(async () => ({
        content: 'This is not JSON',
        usage: { inputTokens: 100, outputTokens: 50 },
      }));

      const goalDraft: GoalDraft = {
        name: 'Learn TypeScript',
        description: 'Master TypeScript',
        deadline: '2025-12-31',
        milestones: [],
      };

      // Should not throw, should fall back to embedding scores
      const scores = await service.scoreNotes(goalDraft, [], []);

      expect(scores.length).toBeGreaterThan(0);
      // Should have fallback reason
      expect(scores[0].reason).toBe('Semantically similar to goal description');
    });

    it('should handle partial LLM response', async () => {
      // Only return scores for some notes
      mockLLMProvider.chat = vi.fn(async () => ({
        content: `\`\`\`json
[
  {"notePath": "notes/typescript.md", "score": 95, "reason": "Covers TypeScript"}
]
\`\`\``,
        usage: { inputTokens: 100, outputTokens: 50 },
      }));

      const goalDraft: GoalDraft = {
        name: 'Learn TypeScript',
        description: 'Master TypeScript',
        deadline: '2025-12-31',
        milestones: [],
      };

      const scores = await service.scoreNotes(goalDraft, [], []);

      // TypeScript note should have LLM score
      const tsScore = scores.find((s) => s.path === 'notes/typescript.md');
      expect(tsScore?.score).toBe(95);
      expect(tsScore?.reason).toBe('Covers TypeScript');

      // Other notes should have embedding-based scores
      const otherScore = scores.find((s) => s.path !== 'notes/typescript.md');
      expect(otherScore?.reason).toBe('Semantically similar to goal description');
    });
  });

  describe('topK configuration', () => {
    it('should respect topK limit', async () => {
      const serviceWithLowK = new EmbeddingRelevanceService(
        mockVaultProvider,
        mockEmbeddingProvider,
        mockLLMProvider,
        mockStorageAdapter,
        { topK: 2, useLLMExplanations: true },
      );

      const goalDraft: GoalDraft = {
        name: 'Learn TypeScript',
        description: 'Master TypeScript',
        deadline: '2025-12-31',
        milestones: [],
      };

      const scores = await serviceWithLowK.scoreNotes(goalDraft, [], []);

      // Should only return top 2 candidates
      expect(scores.length).toBe(2);
    });
  });
});
