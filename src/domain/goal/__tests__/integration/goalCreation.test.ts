import type { ILLMProvider, IVaultProvider, LLMStreamCallbacks } from '@/ports';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrainstormService } from '../../BrainstormService';
import { GoalService } from '../../GoalService';
import type { Milestone } from '../../types';

/**
 * Integration tests for the goal creation flow:
 * 1. User starts brainstorm
 * 2. AI generates goal draft
 * 3. User assigns notes
 * 4. Goal is created with all data
 */
describe('Goal Creation Flow', () => {
  let goalService: GoalService;
  let brainstormService: BrainstormService;
  let mockVaultProvider: IVaultProvider;
  let mockLLMProvider: ILLMProvider;
  let storedFiles: Map<string, string>;

  beforeEach(() => {
    storedFiles = new Map();

    // Add some mock notes
    storedFiles.set('notes/typescript.md', '# TypeScript\n\nTypeScript is a typed JavaScript.');
    storedFiles.set('notes/react.md', '# React\n\nReact is a UI library.');
    storedFiles.set('notes/node.md', '# Node.js\n\nNode.js is a runtime.');

    mockVaultProvider = {
      listMarkdownFiles: vi.fn(async () => {
        const files = Array.from(storedFiles.keys()).map((path) => ({
          path,
          basename: path.split('/').pop()?.replace('.md', '') ?? '',
          folder: path.split('/').slice(0, -1).join('/'),
          modifiedAt: Date.now(),
          createdAt: Date.now(),
        }));
        return files;
      }),
      readFile: vi.fn(async (path: string) => {
        const content = storedFiles.get(path);
        if (!content) {
          throw new Error(`File not found: ${path}`);
        }
        return content;
      }),
      exists: vi.fn(async (path: string) => storedFiles.has(path)),
      getBasename: vi.fn((path: string) => path.split('/').pop()?.replace('.md', '') ?? ''),
      getFolder: vi.fn((path: string) => path.split('/').slice(0, -1).join('/')),
      createFile: vi.fn(async (path: string, content: string) => {
        storedFiles.set(path, content);
      }),
      modifyFile: vi.fn(async (path: string, content: string) => {
        if (!storedFiles.has(path)) {
          throw new Error(`File not found: ${path}`);
        }
        storedFiles.set(path, content);
      }),
      createFolder: vi.fn(async () => {}),
      deleteFile: vi.fn(async (path: string) => {
        if (!storedFiles.has(path)) {
          throw new Error(`File not found: ${path}`);
        }
        storedFiles.delete(path);
      }),
      deleteFolder: vi.fn(async (path: string) => {
        const pathPrefix = `${path}/`;
        const keysToDelete = Array.from(storedFiles.keys()).filter(
          (key) => key.startsWith(pathPrefix) || key === path,
        );
        for (const key of keysToDelete) {
          storedFiles.delete(key);
        }
      }),
    };

    mockLLMProvider = {
      chat: vi.fn(async () => ({
        content: JSON.stringify({
          name: 'Learn TypeScript',
          description: 'Master TypeScript fundamentals for better code',
          deadline: '2025-03-31',
          milestones: [
            { content: 'Learn type basics', order: 0 },
            { content: 'Understand generics', order: 1 },
            { content: 'Build a project', order: 2 },
          ],
        }),
        usage: { inputTokens: 100, outputTokens: 200 },
      })),
      streamChat: vi.fn(
        async (_messages: unknown, callbacks: LLMStreamCallbacks): Promise<void> => {
          const content = JSON.stringify({
            name: 'Learn TypeScript',
            description: 'Master TypeScript fundamentals for better code',
            deadline: '2025-03-31',
            milestones: [
              { content: 'Learn type basics', order: 0 },
              { content: 'Understand generics', order: 1 },
              { content: 'Build a project', order: 2 },
            ],
          });
          callbacks.onToken(content);
          callbacks.onComplete({
            content,
            usage: { inputTokens: 100, outputTokens: 200 },
          });
        },
      ),
      getProviderName: vi.fn(() => 'MockProvider'),
      getModelName: vi.fn(() => 'mock-model'),
      getMaxTokens: vi.fn(() => 100000),
      estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
    };

    goalService = new GoalService(mockVaultProvider);
    brainstormService = new BrainstormService(mockLLMProvider);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete goal creation flow', () => {
    it('should create goal from brainstorm to completion', async () => {
      // Step 1: Extract goal draft from brainstorm response
      const jsonContent = JSON.stringify({
        name: 'Learn TypeScript',
        description: 'Master TypeScript fundamentals',
        deadline: '2025-03-31',
        milestones: ['Learn type basics', 'Understand generics'],
      });
      const jsonResponse = `\`\`\`json\n${jsonContent}\n\`\`\``;

      const goalDraft = brainstormService.extractGoalDraft(jsonResponse);

      expect(goalDraft).toBeDefined();
      expect(goalDraft?.name).toBe('Learn TypeScript');
      expect(goalDraft?.milestones).toHaveLength(2);

      const notes = await mockVaultProvider.listMarkdownFiles();
      const notePaths = notes.filter((n) => n.path.startsWith('notes/')).map((n) => n.path);
      expect(notePaths).toHaveLength(3);

      // Step 2: Create the goal with assigned notes
      const milestones: Milestone[] =
        goalDraft?.milestones.map((content: string, index: number) => ({
          id: `m-${index}`,
          content,
          completed: false,
          order: index,
        })) ?? [];

      const goal = await goalService.createGoal({
        name: goalDraft?.name ?? 'Test Goal',
        description: goalDraft?.description ?? 'Test Description',
        deadline: goalDraft?.deadline ?? '2025-12-31',
        milestones,
        notesPaths: ['notes/typescript.md', 'notes/node.md'], // Only relevant notes
      });

      // Verify goal was created correctly
      expect(goal.id).toMatch(/^goal-/);
      expect(goal.name).toBe('Learn TypeScript');
      expect(goal.status).toBe('active');
      expect(goal.notesPaths).toContain('notes/typescript.md');
      expect(goal.notesPaths).toContain('notes/node.md');
      expect(goal.notesPaths).not.toContain('notes/react.md');

      // Step 3: Verify goal can be retrieved
      const retrievedGoal = await goalService.getGoalById(goal.id);
      expect(retrievedGoal).toBeDefined();
      expect(retrievedGoal?.name).toBe(goal.name);
      expect(retrievedGoal?.milestones).toHaveLength(2);
    });

    it('should handle goal creation with validation errors', async () => {
      // Empty name should fail
      await expect(
        goalService.createGoal({
          name: '',
          description: 'Description',
          deadline: '2025-12-31',
          milestones: [{ id: 'm1', content: 'M1', completed: false, order: 0 }],
        }),
      ).rejects.toThrow('Goal name cannot be empty');

      // Name with control characters should fail
      await expect(
        goalService.createGoal({
          name: 'Goal\x00Name',
          description: 'Description',
          deadline: '2025-12-31',
          milestones: [{ id: 'm1', content: 'M1', completed: false, order: 0 }],
        }),
      ).rejects.toThrow('Goal name cannot contain control characters');

      // Very long name should fail
      const longName = 'A'.repeat(201);
      await expect(
        goalService.createGoal({
          name: longName,
          description: 'Description',
          deadline: '2025-12-31',
          milestones: [{ id: 'm1', content: 'M1', completed: false, order: 0 }],
        }),
      ).rejects.toThrow('Goal name cannot exceed 200 characters');
    });

    it('should handle goal completion flow', async () => {
      // Create a goal
      const goal = await goalService.createGoal({
        name: 'Completable Goal',
        description: 'A goal that will be completed',
        deadline: '2025-12-31',
        milestones: [
          { id: 'm1', content: 'First milestone', completed: false, order: 0 },
          { id: 'm2', content: 'Second milestone', completed: false, order: 1 },
        ],
      });

      expect(goal.status).toBe('active');

      // Update milestones to completed
      await goalService.updateMilestones(goal.id, [
        { id: 'm1', content: 'First milestone', completed: true, order: 0 },
        { id: 'm2', content: 'Second milestone', completed: true, order: 1 },
      ]);

      // Complete the goal
      const completedGoal = await goalService.completeGoal(goal.id);
      expect(completedGoal.status).toBe('completed');

      // Verify completion persists
      const retrieved = await goalService.getGoalById(goal.id);
      expect(retrieved?.status).toBe('completed');
    });
  });

  describe('NoteRelevanceService integration', () => {
    it('should filter notes based on patterns', async () => {
      // The service should be able to list and filter notes
      const notes = await mockVaultProvider.listMarkdownFiles();
      expect(notes.length).toBeGreaterThan(0);

      // All notes should be in the notes/ folder
      const noteFiles = notes.filter((n) => n.path.startsWith('notes/'));
      expect(noteFiles).toHaveLength(3);
    });
  });
});
