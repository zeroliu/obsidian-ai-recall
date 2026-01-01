import type { ILLMProvider, IVaultProvider, LLMStreamCallbacks } from '@/ports';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationService } from '../../ConversationService';
import { GoalService } from '../../GoalService';
import type { Goal } from '../../types';

/**
 * Integration tests for conversation auto-save functionality:
 * 1. Create a conversation
 * 2. Send messages (auto-saved after each)
 * 3. Resume conversation
 * 4. Verify message persistence
 */
describe('Conversation Auto-Save Flow', () => {
  let conversationService: ConversationService;
  let goalService: GoalService;
  let mockVaultProvider: IVaultProvider;
  let mockLLMProvider: ILLMProvider;
  let storedFiles: Map<string, string>;
  let testGoal: Goal;

  beforeEach(async () => {
    storedFiles = new Map();

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

    mockLLMProvider = {
      chat: vi.fn(async () => ({
        content: 'This is a response about TypeScript.',
        usage: { inputTokens: 100, outputTokens: 50 },
      })),
      streamChat: vi.fn(
        async (_messages: unknown, callbacks: LLMStreamCallbacks): Promise<void> => {
          const content = 'This is a streamed response about TypeScript.';
          // Simulate token-by-token streaming
          for (const char of content) {
            callbacks.onToken(char);
          }
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
    conversationService = new ConversationService(mockVaultProvider, mockLLMProvider);

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

  describe('Conversation creation and persistence', () => {
    it('should create a new conversation', async () => {
      const conversation = await conversationService.createConversation(testGoal.id);

      expect(conversation.id).toMatch(/^conv-/);
      expect(conversation.goalId).toBe(testGoal.id);
      expect(conversation.topic).toBe('New Discussion');
      expect(conversation.messages).toHaveLength(0);
    });

    it('should add messages and auto-save', async () => {
      const conversation = await conversationService.createConversation(testGoal.id);

      // Add first user message
      const afterFirstMessage = await conversationService.addMessage(testGoal.id, conversation.id, {
        role: 'user',
        content: 'What is TypeScript?',
      });

      expect(afterFirstMessage.messages).toHaveLength(1);
      expect(afterFirstMessage.messages[0].role).toBe('user');
      expect(afterFirstMessage.messages[0].content).toBe('What is TypeScript?');

      // Verify file was created/updated
      expect(mockVaultProvider.createFile).toHaveBeenCalled();

      // Add assistant response
      const afterSecondMessage = await conversationService.addMessage(
        testGoal.id,
        conversation.id,
        {
          role: 'assistant',
          content: 'TypeScript is a typed superset of JavaScript.',
          sources: ['notes/typescript.md'],
        },
      );

      expect(afterSecondMessage.messages).toHaveLength(2);
      expect(afterSecondMessage.messages[1].role).toBe('assistant');
      expect(afterSecondMessage.messages[1].sources).toContain('notes/typescript.md');
    });

    it('should resume a previous conversation', async () => {
      // Create and populate a conversation
      const conversation = await conversationService.createConversation(testGoal.id);

      await conversationService.addMessage(testGoal.id, conversation.id, {
        role: 'user',
        content: 'Question 1',
      });

      await conversationService.addMessage(testGoal.id, conversation.id, {
        role: 'assistant',
        content: 'Answer 1',
      });

      await conversationService.addMessage(testGoal.id, conversation.id, {
        role: 'user',
        content: 'Question 2',
      });

      // Retrieve the conversation (simulating page reload)
      const retrieved = await conversationService.getConversationById(testGoal.id, conversation.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.messages).toHaveLength(3);
      expect(retrieved?.messages[0].content).toBe('Question 1');
      expect(retrieved?.messages[1].content).toBe('Answer 1');
      expect(retrieved?.messages[2].content).toBe('Question 2');
    });

    it('should list all conversations for a goal', async () => {
      // Create multiple conversations
      await conversationService.createConversation(testGoal.id);
      await conversationService.createConversation(testGoal.id);
      await conversationService.createConversation(testGoal.id);

      const conversations = await conversationService.getConversationsForGoal(testGoal.id);

      expect(conversations).toHaveLength(3);
    });

    it('should update conversation topic', async () => {
      const conversation = await conversationService.createConversation(testGoal.id);

      await conversationService.addMessage(testGoal.id, conversation.id, {
        role: 'user',
        content: 'Tell me about TypeScript generics',
      });

      // Update topic based on first message
      const updated = await conversationService.updateTopic(
        testGoal.id,
        conversation.id,
        'TypeScript generics discussion',
      );

      expect(updated.topic).toBe('TypeScript generics discussion');

      // Verify it persists
      const retrieved = await conversationService.getConversationById(testGoal.id, conversation.id);
      expect(retrieved?.topic).toBe('TypeScript generics discussion');
    });
  });

  describe('Conversation recovery', () => {
    it('should recover from corrupted conversation file', async () => {
      const conversation = await conversationService.createConversation(testGoal.id);

      await conversationService.addMessage(testGoal.id, conversation.id, {
        role: 'user',
        content: 'Test message',
      });

      // Corrupt the file by manually setting invalid content
      const conversationPath = `ignite/${testGoal.id}/conversations/${conversation.id}.md`;

      // Simulate corrupted frontmatter but valid messages
      const corruptedContent = `---
id: ${conversation.id}
goalId: ${testGoal.id}
topic: Corrupted Topic
createdAt: invalid-date
---

# Conversation

## User - 2025-01-01T00:00:00.000Z

Test message from corrupted file`;

      storedFiles.set(conversationPath, corruptedContent);

      // Attempt recovery
      const recovered = await conversationService.recoverConversation(testGoal.id, conversation.id);

      expect(recovered).toBeDefined();
      expect(recovered?.id).toBe(conversation.id);
      expect(recovered?.messages.length).toBeGreaterThanOrEqual(0);
    });

    it('should reset conversation if recovery fails', async () => {
      const conversation = await conversationService.createConversation(testGoal.id);

      // Reset to empty state
      const reset = await conversationService.resetConversation(testGoal.id, conversation.id);

      expect(reset.id).toBe(conversation.id);
      expect(reset.messages).toHaveLength(0);
      expect(reset.topic).toBe('Recovered Discussion');
    });
  });

  describe('Source extraction', () => {
    it('should extract sources from response text', () => {
      const response =
        'Based on notes/typescript.md, TypeScript is great. Also see notes/react.md.';
      const availableNotes = ['notes/typescript.md', 'notes/react.md', 'notes/node.md'];

      const sources = conversationService.extractSources(response, availableNotes);

      expect(sources).toContain('notes/typescript.md');
      expect(sources).toContain('notes/react.md');
      expect(sources).not.toContain('notes/node.md');
    });

    it('should extract sources by note name', () => {
      const response = 'The typescript guide explains this well.';
      const availableNotes = ['notes/typescript.md', 'notes/react.md'];

      const sources = conversationService.extractSources(response, availableNotes);

      expect(sources).toContain('notes/typescript.md');
    });
  });

  describe('Topic generation', () => {
    it('should generate topic from first user message', async () => {
      const conversation = await conversationService.createConversation(testGoal.id);

      await conversationService.addMessage(testGoal.id, conversation.id, {
        role: 'user',
        content: 'How do I use generics in TypeScript?',
      });

      const topic = await conversationService.generateTopic({
        ...conversation,
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'How do I use generics in TypeScript?',
            timestamp: new Date().toISOString(),
          },
        ],
      });

      expect(topic).toBe('How do I use generics in TypeScript?');
    });

    it('should truncate long topics', async () => {
      const longMessage =
        'This is a very long question about TypeScript that goes on and on and exceeds fifty characters';

      const topic = await conversationService.generateTopic({
        id: 'conv-1',
        goalId: testGoal.id,
        topic: 'New Discussion',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: longMessage,
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
      });

      expect(topic.length).toBeLessThanOrEqual(54); // 50 chars + "..."
      expect(topic.endsWith('...')).toBe(true);
    });
  });
});
