# Ignite MVP Development Plan

> Created: 2024-12-30

## MVP Scope

### Features to Build

| Feature | Scope |
|---------|-------|
| **Goal Creation** | Brainstorm agent, AI-suggested milestones, folder structure |
| **Note Assignment** | AI scan + relevance scoring, user confirms |
| **Goal Detail** | Milestones (editable), deadline, Notes list, Conversations list |
| **Discuss** | Explore mode only, auto-save, resume previous, source attribution |
| **Q&A** | Multiple choice + open-ended, session saves, view history |
| **Home** | Active goals list, create CTA |
| **Completion** | Simple "Mark Complete" |
| **Settings** | Extend existing tab: `includePaths`, `excludePaths` (glob patterns) |

### Cut from MVP

- Research Action
- Draft Action
- Discuss modes (Teach Me, Challenge)
- Archived goals view
- Onboarding/Welcome screen

---

## Architecture

### Data Flow

```
React UI (Contexts + Hooks)
    ↓
Domain Services (GoalService, ConversationService, QAService)
    ↓
Ports (IVaultProvider, IStorageAdapter, ILLMProvider)
    ↓
Adapters (Obsidian, Anthropic)
```

### State Management

- **AppContext**: Injects adapters from IgniteView
- **GoalContext**: Goal state + operations
- **LLMContext**: LLM provider + streaming

### Navigation

Simple state-based router (no React Router):

```typescript
type Screen =
  | { type: 'home' }
  | { type: 'brainstorm' }
  | { type: 'goal-detail'; goalId: string }
  | { type: 'discuss'; goalId: string; conversationId?: string }
  | { type: 'qa'; goalId: string };
```

---

## File Structure

### New Files to Create

```
src/
├── domain/goal/
│   ├── types.ts                 # Goal, Milestone, Conversation, QASession types
│   ├── GoalService.ts           # Goal CRUD operations
│   ├── ConversationService.ts   # Chat message handling
│   ├── QAService.ts             # Question generation, scoring
│   ├── BrainstormService.ts     # Goal creation chat logic
│   ├── NoteRelevanceService.ts  # AI-based note scoring
│   └── __tests__/
├── ports/
│   └── ILLMProvider.ts          # LLM abstraction
├── adapters/anthropic/
│   ├── AnthropicLLMAdapter.ts   # Claude API implementation
│   └── prompts/                 # System prompts
│       ├── brainstorm.ts
│       ├── discuss.ts
│       ├── noteRelevance.ts
│       └── qaGeneration.ts
├── ui/
│   ├── Router.tsx               # Screen navigation
│   ├── contexts/
│   │   ├── AppContext.tsx
│   │   ├── GoalContext.tsx
│   │   └── LLMContext.tsx
│   ├── hooks/
│   │   ├── useGoals.ts
│   │   ├── useConversation.ts
│   │   └── useQASession.ts
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── BrainstormScreen.tsx
│   │   ├── NoteAssignmentScreen.tsx
│   │   ├── GoalDetailScreen.tsx
│   │   ├── DiscussScreen.tsx
│   │   └── QAScreen.tsx
│   └── components/
│       ├── shared/              # Button, Card, Input, ProgressBar
│       ├── goal/                # GoalCard, MilestoneList, ActionCard
│       ├── chat/                # ChatInterface, ChatMessage, SourcesCard
│       ├── notes/               # NoteCard, NoteList
│       └── qa/                  # QuestionCard, AnswerOption, SessionSummary
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/settings.ts` | Add `includePaths: string[]`, `excludePaths: string[]` |
| `src/adapters/obsidian/IgniteView.tsx` | Pass adapters + settings to IgniteApp |
| `src/ui/IgniteApp.tsx` | Add context providers and router |
| `src/main.ts` | Pass plugin reference to IgniteView |
| `styles.css` | Add component styles |

---

## Data Models

```typescript
// src/domain/goal/types.ts

interface Goal {
  id: string;
  name: string;
  description: string;
  deadline: string;           // ISO date
  milestones: Milestone[];
  notesPaths: string[];
  status: 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
}

interface Milestone {
  id: string;
  content: string;
  completed: boolean;
  order: number;
}

interface Conversation {
  id: string;
  goalId: string;
  topic: string;              // AI-generated
  messages: ChatMessage[];
  createdAt: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];         // Note paths used
  timestamp: string;
}

interface QASession {
  id: string;
  goalId: string;
  questions: Question[];
  answers: Answer[];
  score: number;
  createdAt: string;
  completedAt?: string;
}

// Use discriminated unions for type safety
type Question =
  | {
      id: string;
      type: 'multiple-choice';
      text: string;
      sourceNotePath: string;
      options: string[];        // Required for multiple-choice
      correctAnswer: number;    // Required for multiple-choice
    }
  | {
      id: string;
      type: 'open-ended';
      text: string;
      sourceNotePath: string;
      // No options/correctAnswer for open-ended
    };

type Answer =
  | {
      questionId: string;
      type: 'multiple-choice';
      userAnswer: number;
      isCorrect: boolean;
      explanation: string;
    }
  | {
      questionId: string;
      type: 'open-ended';
      userAnswer: string;
      isCorrect: boolean;
      explanation: string;
    };
```

---

## Storage Structure

**Markdown-only approach**: All data stored in vault as markdown files with frontmatter. No hidden JSON files.

```
ignite/                       # All storage in vault (user-visible)
└── {goal-id}/                # Use goal ID to prevent name conflicts
    ├── goal.md               # Goal metadata in frontmatter
    ├── conversations/
    │   └── {topic}.md        # Auto-saved discussions (frontmatter + chat history)
    └── qa-sessions/
        └── {sessionId}.md    # Q&A session (frontmatter + questions/answers)
```

### Goal Metadata (goal.md)

```markdown
---
id: goal-abc123
name: Learn React
description: Master React fundamentals
deadline: 2025-02-01
status: active
createdAt: 2024-12-30T10:00:00Z
updatedAt: 2024-12-30T12:00:00Z
notesPaths:
  - notes/react-basics.md
  - notes/hooks.md
milestones:
  - id: m1
    content: Understand components
    completed: true
    order: 1
  - id: m2
    content: Master hooks
    completed: false
    order: 2
---

# Learn React

This goal focuses on mastering React fundamentals...
```

### Conversation Format (conversations/{topic}.md)

```markdown
---
id: conv-456
goalId: goal-abc123
topic: React patterns
createdAt: 2024-12-30T11:00:00Z
---

**User** (11:00 AM)
What React patterns should I use?

**Assistant** (11:00 AM)
Based on your notes...

[Sources: [[React Best Practices]]]
```

### Q&A Session Format (qa-sessions/{sessionId}.md)

```markdown
---
id: session-789
goalId: goal-abc123
score: 80
createdAt: 2024-12-30T14:00:00Z
completedAt: 2024-12-30T14:15:00Z
questions:
  - id: q1
    type: multiple-choice
    text: What is a React Hook?
    sourceNotePath: notes/hooks.md
    options:
      - A function component
      - A state management tool
      - A lifecycle method
    correctAnswer: 1
  - id: q2
    type: open-ended
    text: Explain the useState hook
    sourceNotePath: notes/hooks.md
answers:
  - questionId: q1
    type: multiple-choice
    userAnswer: 1
    isCorrect: true
    explanation: Correct! Hooks are state management tools.
  - questionId: q2
    type: open-ended
    userAnswer: useState allows functional components to have state...
    isCorrect: true
    explanation: Good explanation of useState.
---

# Q&A Session - 2024-12-30

Score: 4/5 (80%)

## Question 1
**What is a React Hook?**
- [ ] A function component
- [x] A state management tool ✓
- [ ] A lifecycle method

## Question 2 (Open-ended)
**Explain the useState hook**

Your answer: useState allows functional components to have state...

✓ Correct! Good explanation of useState.
```

### Storage Migration Strategy

When upgrading from any future storage format changes:
1. Detect old format by checking for `.ignite/` directory
2. Read all JSON files and convert to markdown
3. Write new markdown files with frontmatter
4. Archive old `.ignite/` directory to `.ignite.backup/`
5. Log migration summary to console

---

## Settings

**Extends existing** `src/settings.ts` `IgniteSettings` interface:

```typescript
// Add to existing interface in src/settings.ts
export interface IgniteSettings {
  anthropicApiKey: string;    // Already exists
  includePaths: string[];     // NEW: Glob patterns (e.g., "notes/**", "projects/*.md")
  excludePaths: string[];     // NEW: Glob patterns (e.g., "templates/**", "archive/**")
}

// Update DEFAULT_SETTINGS
export const DEFAULT_SETTINGS: IgniteSettings = {
  anthropicApiKey: '',
  includePaths: [],           // NEW
  excludePaths: [],           // NEW
};
```

### Path Filtering Logic

**Reuse existing** `src/domain/pipeline/pathFilter.ts` utilities:

```typescript
import { filterExcludedPaths } from '@/domain/pipeline/pathFilter';
import micromatch from 'micromatch';

// New utility to add for include patterns
export function filterByIncludePatterns<T extends { path: string }>(
  files: T[],
  patterns: string[],
): T[] {
  if (patterns.length === 0) return files;
  return files.filter(f =>
    micromatch.isMatch(f.path, patterns, { dot: true })
  );
}

// Combined filtering logic
export function filterNotesBySettings<T extends { path: string }>(
  notes: T[],
  settings: IgniteSettings,
): T[] {
  let filtered = notes;

  // Apply include patterns first
  if (settings.includePaths.length > 0) {
    filtered = filterByIncludePatterns(filtered, settings.includePaths);
  }

  // Then apply exclude patterns
  if (settings.excludePaths.length > 0) {
    const result = filterExcludedPaths(filtered, settings.excludePaths);
    filtered = result.included;
  }

  return filtered;
}
```

### Glob Pattern Validation

Add validation in settings UI to prevent invalid patterns:

```typescript
// In IgniteSettingsTab.display()
function validateGlobPattern(pattern: string): string | null {
  try {
    micromatch('test/path.md', pattern);
    return null; // Valid
  } catch (e) {
    return `Invalid glob pattern: ${e.message}`;
  }
}
```

---

## Build Order

### Phase 1: Foundation

1. Data models (`src/domain/goal/types.ts`) with discriminated unions
2. Extend ILLMProvider port (already exists per CLAUDE.md) + enhance AnthropicLLMAdapter
3. GoalService (CRUD with markdown+frontmatter storage)
4. Add `filterByIncludePatterns()` to `src/domain/pipeline/pathFilter.ts`
5. React contexts (App, Goal, LLM)
6. Router component

### Phase 2: Core UI

1. Shared components (Button, Card, Input, ProgressBar)
2. HomeScreen (empty + populated states)
3. GoalDetailScreen (milestones, actions, notes)
4. Settings update (includePaths, excludePaths)

### Phase 3: Goal Creation

1. ChatInterface component (reusable)
2. BrainstormService + prompts
3. BrainstormScreen with GoalPreview
4. NoteRelevanceService
5. NoteAssignmentScreen

### Phase 4: Actions

1. Discuss action + ConversationService
2. Conversation auto-save to markdown
3. Resume conversation UI
4. Q&A action + QAService
5. Q&A session persistence + history

### Phase 5: Polish

1. Goal completion flow
2. Error handling
3. Testing

---

## Implementation Details

### Adapter Injection

```typescript
// IgniteView.tsx
this.root.render(
  <IgniteApp
    vaultProvider={new ObsidianVaultAdapter(this.app)}
    storageAdapter={new ObsidianStorageAdapter(this.app)}
    metadataProvider={new ObsidianMetadataAdapter(this.app)}
    settings={this.plugin.settings}
  />
);
```

### Goal Folder Creation

When creating a goal, GoalService must:

1. Generate unique goal ID (e.g., `goal-abc123`)
2. Create `ignite/{goal-id}/` folder in vault (prevents name conflicts)
3. Create `goal.md` with frontmatter metadata (see Storage Structure section)
4. Create `conversations/` and `qa-sessions/` subdirectories

### Conversation Recovery

If auto-save markdown files are corrupted:
1. Parse frontmatter first to extract metadata
2. If frontmatter is valid but body is corrupted, show error in UI
3. Allow user to "Reset conversation" which archives corrupted file to `conversations/.archive/`
4. Log all parsing errors to console for debugging

### Data Access Layer

GoalService loads data by:
1. Listing all `ignite/*/goal.md` files
2. Parsing frontmatter from each file
3. Caching parsed goals in memory
4. Re-parsing on file change (using Obsidian's vault events)

---

## ILLMProvider Port

**Note**: Per CLAUDE.md line 34, `ILLMProvider` already exists for question generation. This section extends it for goal-oriented features.

```typescript
// src/ports/ILLMProvider.ts

interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface LLMResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

interface LLMChatOptions {
  temperature?: number;        // 0.0 to 1.0, controls randomness
  maxTokens?: number;          // Max tokens to generate
  stopSequences?: string[];    // Stop generation at these strings
}

interface LLMStreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (response: LLMResponse) => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;        // Allow cancellation
}

interface ILLMProvider {
  // Core methods
  chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse>;
  streamChat(messages: LLMMessage[], callbacks: LLMStreamCallbacks, options?: LLMChatOptions): Promise<void>;

  // Model info
  getProviderName(): string;
  getModelName(): string;
  getMaxTokens(): number;               // Context window size

  // Token estimation (for cost control)
  estimateTokens(text: string): number;
}
```

### Token Usage Tracking

For cost monitoring, track cumulative usage:

```typescript
interface TokenUsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUSD: number;  // Based on current Anthropic pricing
  lastUpdated: string;
}

// Store in plugin settings or separate file
```

### API Key Validation

Before saving API key in settings, validate it:

```typescript
async function validateAnthropicApiKey(key: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });
    return response.ok || response.status === 400; // 400 = valid key, invalid request
  } catch {
    return false;
  }
}
```

---

## Security Considerations

### Input Sanitization

1. **Goal Names as Folder Names**: Sanitize user-generated goal names before using as folder paths
   ```typescript
   function sanitizeGoalName(name: string): string {
     return name
       .replace(/[<>:"/\\|?*]/g, '') // Remove invalid path chars
       .replace(/\.\./g, '')          // Prevent directory traversal
       .trim()
       .slice(0, 100);                // Limit length
   }
   ```

2. **Markdown Rendering**: Use Obsidian's built-in markdown renderer to prevent XSS in chat messages
   - Never use `dangerouslySetInnerHTML`
   - Sanitize any user input before rendering

### Rate Limiting

Implement client-side rate limiting to control costs:

```typescript
interface RateLimiter {
  maxRequestsPerMinute: number;
  maxTokensPerDay: number;
}

// Track usage and reject requests if limits exceeded
// Store daily usage in plugin settings
```

### API Key Security

- ✅ Store as password type in settings (already implemented in `settings.ts:55`)
- ✅ Set `autocomplete="off"` (already implemented)
- Add validation before saving (see API Key Validation section above)
- Never log API key to console
- Clear from memory when plugin unloads

### Data Privacy

- All data stored locally in vault (no cloud sync by default)
- Users control data through Obsidian's sync settings
- No telemetry or analytics sent to external servers

---

## Test Coverage

### Unit Tests

1. **Domain Layer** (`src/domain/goal/`)
   - GoalService CRUD operations with mock storage
   - ConversationService message handling
   - QAService question generation and scoring
   - NoteRelevanceService scoring algorithm

2. **Path Filtering** (`src/domain/pipeline/pathFilter.ts`)
   - Test new `filterByIncludePatterns()` function
   - Test combined include/exclude logic
   - Test edge cases (empty patterns, invalid globs)

3. **LLM Adapter** (`src/adapters/anthropic/`)
   - Mock Anthropic API responses
   - Test streaming vs. non-streaming
   - Test error handling (network errors, rate limits, invalid responses)
   - Test token estimation accuracy

### Integration Tests

1. **Goal Creation Flow**
   - End-to-end: Create goal → assign notes → verify storage
   - Test folder creation, frontmatter writing
   - Test with special characters in goal names

2. **Conversation Auto-Save**
   - Send messages → verify markdown file created
   - Resume conversation → verify messages loaded
   - Test recovery from corrupted files

3. **Q&A Session Flow**
   - Generate questions → answer → save → load history
   - Test both multiple-choice and open-ended questions
   - Verify score calculation

### E2E Tests (Manual Testing Checklist)

- [ ] Create goal with brainstorm agent
- [ ] Assign notes to goal with AI relevance scoring
- [ ] Start discussion, send 10+ messages, verify auto-save
- [ ] Resume previous discussion
- [ ] Start Q&A session, answer 5 questions, verify scoring
- [ ] View Q&A history
- [ ] Mark goal as complete
- [ ] Test with large vault (1000+ notes)
- [ ] Test with empty vault
- [ ] Test path filtering with complex glob patterns

### Mocking Strategy

- **Anthropic API**: Use MSW (Mock Service Worker) or simple fetch mocks
- **Obsidian API**: Continue using existing `src/test/mocks/obsidian.ts`
- **File system**: Use in-memory vault for tests (existing mock adapters)

### Performance Tests

1. **Note Relevance Scoring**: Test with 1000+ notes
   - Should complete within 30 seconds
   - Should show progress indicator

2. **Goal Loading**: Test with 50+ goals
   - Should load all goals within 2 seconds
   - Should cache parsed frontmatter

3. **Conversation Rendering**: Test with 100+ messages
   - Should render without lag
   - Should virtualize list if needed
