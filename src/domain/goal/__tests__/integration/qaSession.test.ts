import type { ILLMProvider, IVaultProvider, LLMStreamCallbacks } from '@/ports';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalService } from '../../GoalService';
import { QAService } from '../../QAService';
import type { Goal } from '../../types';

/**
 * Integration tests for Q&A session flow:
 * 1. Generate questions from notes
 * 2. User answers questions
 * 3. AI evaluates answers
 * 4. Session is saved with score
 */
describe('Q&A Session Flow', () => {
  let qaService: QAService;
  let goalService: GoalService;
  let mockVaultProvider: IVaultProvider;
  let mockLLMProvider: ILLMProvider;
  let storedFiles: Map<string, string>;
  let testGoal: Goal;

  beforeEach(async () => {
    storedFiles = new Map();

    // Add some mock notes for the Q&A
    storedFiles.set(
      'notes/typescript.md',
      `# TypeScript

TypeScript is a typed superset of JavaScript.

## Key Features
- Static typing
- Interfaces
- Generics
- Enums

## Benefits
TypeScript helps catch errors at compile time rather than runtime.`,
    );

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
      exists: vi.fn(async (path: string) => {
        // Check exact match first
        if (storedFiles.has(path)) return true;
        // Check if it's a folder that contains files
        const pathPrefix = path.endsWith('/') ? path : `${path}/`;
        return Array.from(storedFiles.keys()).some((key) => key.startsWith(pathPrefix));
      }),
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

    // Mock LLM for question generation and evaluation
    const questionJson = JSON.stringify({
      questions: [
        {
          type: 'multiple-choice',
          text: 'What is TypeScript?',
          options: [
            'A typed superset of JavaScript',
            'A database',
            'An operating system',
            'A web browser',
          ],
          correctAnswer: 0,
          sourceNotePath: 'notes/typescript.md',
        },
        {
          type: 'open-ended',
          text: 'Explain the benefits of static typing in TypeScript.',
          sourceNotePath: 'notes/typescript.md',
        },
      ],
    });
    mockLLMProvider = {
      chat: vi.fn(async () => ({
        content: `\`\`\`json\n${questionJson}\n\`\`\``,
        usage: { inputTokens: 200, outputTokens: 300 },
      })),
      streamChat: vi.fn(
        async (_messages: unknown, callbacks: LLMStreamCallbacks): Promise<void> => {
          const content = JSON.stringify({
            isCorrect: true,
            explanation: 'Good answer! You correctly identified the key benefits.',
          });
          callbacks.onToken(content);
          callbacks.onComplete({
            content,
            usage: { inputTokens: 100, outputTokens: 50 },
          });
        },
      ),
      getProviderName: vi.fn(() => 'MockProvider'),
      getModelName: vi.fn(() => 'mock-model'),
      getMaxTokens: vi.fn(() => 100000),
      estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
    };

    goalService = new GoalService(mockVaultProvider);
    qaService = new QAService(mockVaultProvider, mockLLMProvider);

    // Create a test goal first
    testGoal = await goalService.createGoal({
      name: 'Learn TypeScript',
      description: 'Master TypeScript fundamentals',
      deadline: '2025-12-31',
      milestones: [{ id: 'm1', content: 'Learn basics', completed: false, order: 0 }],
      notesPaths: ['notes/typescript.md'],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Q&A Session creation', () => {
    it('should create a new Q&A session with questions', async () => {
      const noteContents = [
        { path: 'notes/typescript.md', content: storedFiles.get('notes/typescript.md') ?? '' },
      ];

      const session = await qaService.createSession(testGoal, noteContents);

      expect(session.id).toMatch(/^qa-/);
      expect(session.goalId).toBe(testGoal.id);
      expect(session.questions).toHaveLength(2);
      expect(session.answers).toHaveLength(0);
      expect(session.score).toBe(0);
    });

    it('should generate multiple choice and open-ended questions', async () => {
      const noteContents = [
        { path: 'notes/typescript.md', content: storedFiles.get('notes/typescript.md') ?? '' },
      ];

      const session = await qaService.createSession(testGoal, noteContents);

      const mcQuestions = session.questions.filter((q) => q.type === 'multiple-choice');
      const oeQuestions = session.questions.filter((q) => q.type === 'open-ended');

      expect(mcQuestions).toHaveLength(1);
      expect(oeQuestions).toHaveLength(1);

      // Multiple choice should have 4 options
      const mcQuestion = mcQuestions[0];
      if (mcQuestion.type === 'multiple-choice') {
        expect(mcQuestion.options).toHaveLength(4);
        expect(mcQuestion.correctAnswer).toBeDefined();
      }
    });
  });

  describe('Answer submission and scoring', () => {
    it('should record correct multiple-choice answers', async () => {
      const noteContents = [
        { path: 'notes/typescript.md', content: storedFiles.get('notes/typescript.md') ?? '' },
      ];

      const session = await qaService.createSession(testGoal, noteContents);

      // Reload session to get the parsed question IDs (they change when loaded from storage)
      const loadedSession = await qaService.getSessionById(testGoal.id, session.id);
      if (!loadedSession) {
        throw new Error('Session not found after creation');
      }

      const mcQuestion = loadedSession.questions.find((q) => q.type === 'multiple-choice');

      if (!mcQuestion) {
        throw new Error('No multiple choice question found');
      }

      // Submit correct answer
      const result = await qaService.submitAnswer(
        testGoal.id,
        session.id,
        mcQuestion.id,
        0, // Correct answer is index 0
        noteContents,
      );

      expect(result.answer.isCorrect).toBe(true);
      expect(result.session.answers).toHaveLength(1);
    });

    it('should record incorrect multiple-choice answers', async () => {
      const noteContents = [
        { path: 'notes/typescript.md', content: storedFiles.get('notes/typescript.md') ?? '' },
      ];

      const session = await qaService.createSession(testGoal, noteContents);

      // Reload session to get the parsed question IDs (they change when loaded from storage)
      const loadedSession = await qaService.getSessionById(testGoal.id, session.id);
      if (!loadedSession) {
        throw new Error('Session not found after creation');
      }

      const mcQuestion = loadedSession.questions.find((q) => q.type === 'multiple-choice');

      if (!mcQuestion) {
        throw new Error('No multiple choice question found');
      }

      // Submit incorrect answer
      const result = await qaService.submitAnswer(
        testGoal.id,
        session.id,
        mcQuestion.id,
        2, // Wrong answer
        noteContents,
      );

      expect(result.answer.isCorrect).toBe(false);
    });

    it('should evaluate open-ended answers using LLM', async () => {
      // Mock LLM to return evaluation response
      const oqJson = JSON.stringify({
        questions: [
          {
            type: 'open-ended',
            text: 'Explain static typing.',
            sourceNotePath: 'notes/typescript.md',
          },
        ],
      });
      const evalJson = JSON.stringify({
        isCorrect: true,
        explanation: 'Good explanation of static typing benefits.',
      });
      vi.mocked(mockLLMProvider.chat)
        .mockResolvedValueOnce({
          content: `\`\`\`json\n${oqJson}\n\`\`\``,
          usage: { inputTokens: 100, outputTokens: 200 },
        })
        .mockResolvedValueOnce({
          content: `\`\`\`json\n${evalJson}\n\`\`\``,
          usage: { inputTokens: 50, outputTokens: 100 },
        });

      const noteContents = [
        { path: 'notes/typescript.md', content: storedFiles.get('notes/typescript.md') ?? '' },
      ];

      const session = await qaService.createSession(testGoal, noteContents);

      // Reload session to get the parsed question IDs (they change when loaded from storage)
      const loadedSession = await qaService.getSessionById(testGoal.id, session.id);
      if (!loadedSession) {
        throw new Error('Session not found after creation');
      }

      const oeQuestion = loadedSession.questions.find((q) => q.type === 'open-ended');

      if (!oeQuestion) {
        throw new Error('No open-ended question found');
      }

      const result = await qaService.submitAnswer(
        testGoal.id,
        session.id,
        oeQuestion.id,
        'Static typing catches errors at compile time.',
        noteContents,
      );

      expect(result.answer.type).toBe('open-ended');
      expect(result.answer.explanation).toBeDefined();
    });
  });

  describe('Session persistence', () => {
    it('should persist session and retrieve it', async () => {
      const noteContents = [
        { path: 'notes/typescript.md', content: storedFiles.get('notes/typescript.md') ?? '' },
      ];

      const session = await qaService.createSession(testGoal, noteContents);

      // Retrieve session
      const retrieved = await qaService.getSessionById(testGoal.id, session.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
      expect(retrieved?.questions).toHaveLength(2);
    });

    it('should list all sessions for a goal', async () => {
      const noteContents = [
        { path: 'notes/typescript.md', content: storedFiles.get('notes/typescript.md') ?? '' },
      ];

      await qaService.createSession(testGoal, noteContents);
      await qaService.createSession(testGoal, noteContents);
      await qaService.createSession(testGoal, noteContents);

      const sessions = await qaService.getSessionsForGoal(testGoal.id);

      expect(sessions).toHaveLength(3);
    });

    it('should delete a session', async () => {
      const noteContents = [
        { path: 'notes/typescript.md', content: storedFiles.get('notes/typescript.md') ?? '' },
      ];

      const session = await qaService.createSession(testGoal, noteContents);

      await qaService.deleteSession(testGoal.id, session.id);

      const retrieved = await qaService.getSessionById(testGoal.id, session.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Score calculation', () => {
    it('should calculate score based on correct answers', async () => {
      const noteContents = [
        { path: 'notes/typescript.md', content: storedFiles.get('notes/typescript.md') ?? '' },
      ];

      const session = await qaService.createSession(testGoal, noteContents);

      // Reload session to get the parsed question IDs (they change when loaded from storage)
      const loadedSession = await qaService.getSessionById(testGoal.id, session.id);
      if (!loadedSession) {
        throw new Error('Session not found after creation');
      }

      // Answer first question correctly
      const q1 = loadedSession.questions[0];
      await qaService.submitAnswer(testGoal.id, session.id, q1.id, 0, noteContents);

      // Get updated session
      const afterFirst = await qaService.getSessionById(testGoal.id, session.id);
      expect(afterFirst?.score).toBe(50); // 1/2 = 50%

      // Answer second question correctly
      const perfectEvalJson = JSON.stringify({
        isCorrect: true,
        explanation: 'Perfect answer!',
      });
      vi.mocked(mockLLMProvider.chat).mockResolvedValueOnce({
        content: `\`\`\`json\n${perfectEvalJson}\n\`\`\``,
        usage: { inputTokens: 50, outputTokens: 100 },
      });

      // Reload again to get updated session with first answer
      const sessionAfterFirst = await qaService.getSessionById(testGoal.id, session.id);
      if (!sessionAfterFirst) {
        throw new Error('Session not found after first answer');
      }

      const q2 = sessionAfterFirst.questions[1];
      await qaService.submitAnswer(
        testGoal.id,
        session.id,
        q2.id,
        'TypeScript catches errors at compile time.',
        noteContents,
      );

      // Get final session
      const afterSecond = await qaService.getSessionById(testGoal.id, session.id);
      expect(afterSecond?.score).toBe(100); // 2/2 = 100%
      expect(afterSecond?.completedAt).toBeDefined(); // Session should be completed
    });
  });
});
