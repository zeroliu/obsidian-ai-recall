---
created: 2025-12-28
updated: 2025-12-28
---

# Question Generation - Development Plan

This document provides detailed implementation guidance for Part 2 (Question Generation) of the technical design document.

## Overview

The Question Generation pipeline transforms concepts (from Part 1) into quiz questions:

```
TrackedConcept with 1,000 notes
     ↓  (Score each note)
1,000 scored notes
     ↓  (Stratified sampling)
15 selected notes
     ↓  (Check question cache)
10 cached + 5 need generation
     ↓  (Batch LLM call)
30-45 candidate questions
     ↓  (Select by format + difficulty)
10 final questions
```

---

## 1. Types (`src/domain/question/types.ts`)

### 1.1 Question Types

```typescript
/**
 * Question format types
 */
export type QuestionFormat = 'multiple_choice' | 'true_false' | 'fill_blank' | 'free_form';

/**
 * Difficulty levels
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * A generated quiz question
 */
export interface Question {
  /** Unique question identifier */
  id: string;
  /** Question format type */
  format: QuestionFormat;
  /** Difficulty rating */
  difficulty: Difficulty;
  /** The question text */
  question: string;
  /** Source note path */
  sourceNoteId: string;
  /** LLM-assigned quality score (0-1) */
  qualityScore: number;
  /** Options for multiple choice (4 items) */
  options?: string[];
  /** Correct answer - index for MC, string for others */
  correctAnswer: string | number;
  /** Optional explanation */
  explanation?: string;
  /** Generation timestamp */
  generatedAt: number;
}

/**
 * Generate a unique question ID
 */
export function generateQuestionId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
```

### 1.2 Cache Types

```typescript
/**
 * Question cache entry (stored per note)
 */
export interface QuestionCacheEntry {
  /** Schema version for migrations */
  version: number;
  /** Note file path */
  notePath: string;
  /** Content hash for invalidation */
  contentHash: string;
  /** Hash of relevant history state when generated */
  historyFingerprint: string;
  /** When questions were generated */
  generatedAt: number;
  /** Cached questions for this note */
  questions: Question[];
}

/** Current cache schema version */
export const QUESTION_CACHE_VERSION = 1;
```

### 1.3 Question History Types

```typescript
/**
 * Status of a question from the user's perspective
 */
export type QuestionStatus = 'answered' | 'skipped' | 'mastered';

/**
 * Record of a single interaction with a question
 */
export interface QuestionInteraction {
  /** When the interaction occurred */
  timestamp: number;
  /** Was the answer correct (null if skipped) */
  correct: boolean | null;
  /** User's response (for free-form, optional) */
  userAnswer?: string;
}

/**
 * History for a single question
 */
export interface QuestionHistoryEntry {
  /** Question ID (from Question.id) */
  questionId: string;
  /** The question text (for LLM context) */
  questionText: string;
  /** Source note path */
  sourceNoteId: string;
  /** Current status */
  status: QuestionStatus;
  /** All interactions with this question */
  interactions: QuestionInteraction[];
  /** Number of times answered correctly */
  correctCount: number;
  /** Number of times answered incorrectly */
  incorrectCount: number;
  /** Current correct streak */
  correctStreak: number;
  /** When first generated */
  firstSeen: number;
  /** When last interacted with */
  lastInteraction: number | null;
}

/**
 * Complete question history for a note
 * Stored per note for efficient lookup
 */
export interface NoteQuestionHistory {
  /** Schema version for migrations */
  version: number;
  /** Note file path this history belongs to */
  noteId: string;
  /** Map of questionId -> QuestionHistoryEntry */
  questions: Record<string, QuestionHistoryEntry>;
  /** Last time this history was updated */
  lastUpdated: number;
}

/** Current history schema version */
export const QUESTION_HISTORY_VERSION = 1;

/**
 * Summary of question history for LLM context
 * Lightweight version sent to LLM prompt
 */
export interface QuestionHistorySummary {
  /** Questions the user has mastered (don't regenerate) */
  masteredQuestions: string[];
  /** Questions answered correctly multiple times (lower priority) */
  wellKnownQuestions: string[];
  /** Questions user struggles with (may want variations) */
  strugglingQuestions: string[];
  /** Recently shown questions (avoid immediate repetition) */
  recentlyShownQuestions: string[];
}

/**
 * Derived note-level stats from question history
 * Replaces the old NoteQuizHistory type
 */
export interface DerivedNoteStats {
  lastQuizzed: number | null;
  quizCount: number;
  correctCount: number;
  correctStreak: number;
}

/**
 * Empty derived stats for cold-start mode
 */
export const EMPTY_DERIVED_STATS: DerivedNoteStats = {
  lastQuizzed: null,
  quizCount: 0,
  correctCount: 0,
  correctStreak: 0,
};
```

### 1.4 Note Scoring Types

```typescript
/**
 * Input for note scoring
 */
export interface NoteSelectionInput {
  noteId: string;
  wordCount: number;
  headingCount: number;
  modifiedAt: number;
  incomingLinkCount: number;
}

/**
 * Scored note with factor breakdown
 */
export interface NoteScore {
  noteId: string;
  totalScore: number;
  factors: {
    spacedRepScore: number;
    richnessScore: number;
    recencyScore: number;
    varietyScore: number;
    struggleScore: number;
  };
  isNeverQuizzed: boolean;
}
```

### 1.5 Pipeline Types

```typescript
/**
 * Request for question generation batch
 */
export interface QuestionGenerationRequest {
  notes: Array<{
    noteId: string;
    title: string;
    content: string;
  }>;
}

/**
 * Response from question generation
 */
export interface QuestionGenerationResponse {
  questions: Question[];
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * Configuration for question generation
 */
export interface QuestionGenerationConfig {
  /** Notes per LLM batch (default: 5) */
  notesPerBatch: number;
  /** Target questions per note (default: 3) */
  questionsPerNote: number;
  /** Final question count target (default: 10) */
  targetQuestionCount: number;
  /** Cache expiry in days (default: 7) */
  cacheMaxAgeDays: number;
  /** Format distribution for final selection */
  targetDistribution: Record<QuestionFormat, number>;
}

export const DEFAULT_QUESTION_CONFIG: QuestionGenerationConfig = {
  notesPerBatch: 5,
  questionsPerNote: 3,
  targetQuestionCount: 10,
  cacheMaxAgeDays: 7,
  targetDistribution: {
    multiple_choice: 4,
    true_false: 2,
    fill_blank: 2,
    free_form: 2,
  },
};
```

---

## 2. Note Selection (`src/domain/question/noteSelection.ts`)

### 2.1 Scoring Weights

```typescript
const WEIGHTS = {
  spacedRep: 0.35,
  richness: 0.20,
  recency: 0.15,
  variety: 0.15,
  struggle: 0.15,
};
```

### 2.2 Note Quizzability Check

```typescript
/**
 * Check if a note should be quizzed based on derived history stats
 *
 * NOTE: Content filtering (tags, word count) is NOT done here.
 * Concepts are pre-vetted by the LLM naming stage (quizzabilityScore >= 0.4).
 * When a concept is passed to question generation, all its notes are trusted.
 *
 * Rules:
 * 1. Not mastered (correctStreak > 5 && daysSinceQuiz < 14)
 * 2. Not quizzed too recently (daysSinceQuiz >= 1)
 */
export function shouldQuizNote(stats: DerivedNoteStats): boolean {
  // History-based checks (skip for never-quizzed notes)
  if (stats.lastQuizzed !== null) {
    const daysSinceQuiz = (Date.now() - stats.lastQuizzed) / (1000 * 60 * 60 * 24);

    // Mastered: high streak + recently quizzed
    if (stats.correctStreak > 5 && daysSinceQuiz < 14) return false;

    // Too recent
    if (daysSinceQuiz < 1) return false;
  }

  return true;
}
```

### 2.3 Scoring Functions

```typescript
/**
 * Spaced repetition intervals (days)
 * Based on SM-2 algorithm
 */
const SPACED_REP_INTERVALS = [1, 3, 7, 14, 30, 60, 120];

/**
 * Calculate spaced repetition score (35% weight)
 *
 * Never quizzed = 1.0 (highest priority)
 * Very overdue (>30 days past due) = 0.95
 * Moderately overdue (>7 days) = 0.85
 * Slightly overdue (>0 days) = 0.70
 * Coming due soon (<3 days) = 0.50
 * Not due yet = 0.20
 */
export function calculateSpacedRepScore(stats: DerivedNoteStats): number {
  if (stats.lastQuizzed === null) return 1.0;

  const daysSinceQuiz = (Date.now() - stats.lastQuizzed) / (1000 * 60 * 60 * 24);
  const targetInterval = SPACED_REP_INTERVALS[Math.min(stats.correctStreak, 6)];
  const daysSinceDue = daysSinceQuiz - targetInterval;

  if (daysSinceDue > 30) return 0.95;
  if (daysSinceDue > 7) return 0.85;
  if (daysSinceDue > 0) return 0.70;
  if (daysSinceDue > -3) return 0.50;
  return 0.20;
}

/**
 * Calculate richness score (20% weight)
 * Notes with more structure are more quizzable
 */
export function calculateRichnessScore(headingCount: number, wordCount: number): number {
  const headingScore = Math.min(1, headingCount * 0.15);
  const lengthScore = Math.min(1, wordCount / 1000);
  return headingScore * 0.6 + lengthScore * 0.4;
}

/**
 * Calculate recency score (15% weight)
 * Recently modified notes are more relevant
 */
export function calculateRecencyScore(modifiedAt: number, now: number = Date.now()): number {
  const daysSince = (now - modifiedAt) / (1000 * 60 * 60 * 24);
  if (daysSince < 7) return 1.0;
  if (daysSince < 30) return 0.7;
  if (daysSince < 90) return 0.5;
  return 0.1;
}

/**
 * Calculate variety score (15% weight)
 * Avoid over-quizzing the same notes
 *
 * Note: Since we now derive stats from question history, we use quizCount
 * as a proxy for variety (how often the note has been quizzed overall)
 */
export function calculateVarietyScore(stats: DerivedNoteStats): number {
  if (stats.quizCount === 0) return 1.0;
  if (stats.quizCount <= 2) return 0.9;
  if (stats.quizCount <= 5) return 0.7;
  if (stats.quizCount <= 10) return 0.5;
  return 0.2;
}

/**
 * Calculate struggle score (15% weight)
 * Prioritize notes the user struggles with
 */
export function calculateStruggleScore(stats: DerivedNoteStats): number {
  if (stats.quizCount === 0) return 0.5; // Neutral for never-quizzed

  const accuracy = stats.correctCount / stats.quizCount;
  if (accuracy < 0.3) return 1.0;  // Struggling
  if (accuracy < 0.5) return 0.8;
  if (accuracy < 0.7) return 0.5;
  return 0.1;  // Mastered
}
```

### 2.4 Cold-Start Scoring

```typescript
/**
 * Calculate score for never-quizzed notes
 * Uses content-based signals instead of history
 */
export function calculateColdStartScore(
  note: NoteSelectionInput,
  now: number = Date.now()
): number {
  const structureScore = Math.min(1, note.headingCount * 0.15);
  const linkPopularity = Math.min(1, note.incomingLinkCount / 10);
  const recency = calculateRecencyScore(note.modifiedAt, now);
  const jitter = Math.random() * 0.2; // Add randomness for variety

  return 0.25 * structureScore + 0.25 * linkPopularity + 0.3 * recency + 0.2 * jitter;
}
```

### 2.5 Main Scoring Function

```typescript
/**
 * Score a single note based on all factors
 */
export function scoreNote(
  note: NoteSelectionInput,
  stats: DerivedNoteStats
): NoteScore {
  const isNeverQuizzed = stats.quizCount === 0;

  const factors = {
    spacedRepScore: calculateSpacedRepScore(stats),
    richnessScore: calculateRichnessScore(note.headingCount, note.wordCount),
    recencyScore: calculateRecencyScore(note.modifiedAt),
    varietyScore: calculateVarietyScore(stats),
    struggleScore: calculateStruggleScore(stats),
  };

  // Use cold-start scoring for never-quizzed notes
  const totalScore = isNeverQuizzed
    ? calculateColdStartScore(note)
    : (
        WEIGHTS.spacedRep * factors.spacedRepScore +
        WEIGHTS.richness * factors.richnessScore +
        WEIGHTS.recency * factors.recencyScore +
        WEIGHTS.variety * factors.varietyScore +
        WEIGHTS.struggle * factors.struggleScore
      );

  return { noteId: note.noteId, totalScore, factors, isNeverQuizzed };
}
```

### 2.6 Stratified Sampling

```typescript
/**
 * Weighted random sample from array
 */
function weightedSample<T extends { totalScore: number }>(
  items: T[],
  count: number
): T[] {
  if (items.length <= count) return items;

  const result: T[] = [];
  const remaining = [...items];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, item) => sum + item.totalScore, 0);
    let random = Math.random() * totalWeight;

    for (let j = 0; j < remaining.length; j++) {
      random -= remaining[j].totalScore;
      if (random <= 0) {
        result.push(remaining[j]);
        remaining.splice(j, 1);
        break;
      }
    }
  }

  return result;
}

/**
 * Select notes using stratified sampling
 *
 * Distribution:
 * - 40% from top 20% (high priority)
 * - 35% from middle 40% (medium priority)
 * - 25% from never-quizzed (fresh notes)
 */
export function selectNotes(
  scoredNotes: NoteScore[],
  targetCount: number = 15
): string[] {
  // Sort by score descending
  const sorted = [...scoredNotes].sort((a, b) => b.totalScore - a.totalScore);

  const topCount = Math.ceil(targetCount * 0.4);
  const midCount = Math.ceil(targetCount * 0.35);
  const freshCount = Math.ceil(targetCount * 0.25);

  // Top 20% of scored notes
  const topPool = sorted.slice(0, Math.ceil(sorted.length * 0.2));
  const topSelected = weightedSample(topPool, topCount);

  // Middle 40% (20% to 60%)
  const midPool = sorted.slice(
    Math.ceil(sorted.length * 0.2),
    Math.ceil(sorted.length * 0.6)
  );
  const midSelected = weightedSample(midPool, midCount);

  // Never-quizzed notes
  const freshPool = sorted.filter(n => n.isNeverQuizzed);
  const freshSelected = weightedSample(freshPool, freshCount);

  // Combine and dedupe
  const allSelected = [...topSelected, ...midSelected, ...freshSelected];
  const uniqueIds = [...new Set(allSelected.map(n => n.noteId))];

  return uniqueIds.slice(0, targetCount);
}
```

---

## 3. Question Cache (`src/domain/question/cache.ts`)

### 3.1 Path Hashing

```typescript
import type { IStorageAdapter } from '@/ports/IStorageAdapter';
import type { Question, QuestionCacheEntry, QuestionGenerationConfig, QUESTION_CACHE_VERSION } from './types';
import { hashString } from '@/domain/embedding/prepareText';

const CACHE_KEY_PREFIX = 'cache/questions';

/**
 * Get storage key for question cache
 * Reuses existing hashString utility from prepareText.ts
 */
export function getQuestionCacheKey(notePath: string): string {
  const normalized = notePath.toLowerCase().replace(/\\/g, '/');
  return `${CACHE_KEY_PREFIX}/${hashString(normalized).slice(0, 8)}`;
}
```

### 3.2 Cache Manager

```typescript
export class QuestionCacheManager {
  private storage: IStorageAdapter;
  private maxAgeDays: number;

  constructor(
    storage: IStorageAdapter,
    config: Partial<QuestionGenerationConfig> = {}
  ) {
    this.storage = storage;
    this.maxAgeDays = config.cacheMaxAgeDays ?? 7;
  }

  /**
   * Get cached questions for a note if valid
   *
   * Cache is invalidated when:
   * 1. Content has changed (contentHash mismatch)
   * 2. Question history has changed significantly (historyFingerprint mismatch)
   * 3. Cache has expired (age > maxAgeDays)
   */
  async get(
    notePath: string,
    contentHash: string,
    historyFingerprint: string
  ): Promise<Question[] | null> {
    const key = getQuestionCacheKey(notePath);
    const entry = await this.storage.read<QuestionCacheEntry>(key);

    if (!entry) return null;
    if (entry.version !== QUESTION_CACHE_VERSION) return null;
    if (entry.contentHash !== contentHash) return null;
    if (entry.historyFingerprint !== historyFingerprint) return null;
    if (this.isExpired(entry.generatedAt)) return null;

    return entry.questions;
  }

  /**
   * Check if cache is valid without returning questions
   */
  async isValid(
    notePath: string,
    contentHash: string,
    historyFingerprint: string
  ): Promise<boolean> {
    const questions = await this.get(notePath, contentHash, historyFingerprint);
    return questions !== null;
  }

  /**
   * Store questions for a note
   */
  async set(
    notePath: string,
    contentHash: string,
    historyFingerprint: string,
    questions: Question[]
  ): Promise<void> {
    const key = getQuestionCacheKey(notePath);
    const entry: QuestionCacheEntry = {
      version: QUESTION_CACHE_VERSION,
      notePath,
      contentHash,
      historyFingerprint,
      generatedAt: Date.now(),
      questions,
    };
    await this.storage.write(key, entry);
  }

  /**
   * Invalidate cache for a note
   */
  async invalidate(notePath: string): Promise<void> {
    const key = getQuestionCacheKey(notePath);
    await this.storage.delete(key);
  }

  /**
   * Check if entry is expired
   */
  private isExpired(generatedAt: number): boolean {
    const ageMs = Date.now() - generatedAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays > this.maxAgeDays;
  }

  /**
   * Get all cached note paths
   */
  async getAllCachedPaths(): Promise<string[]> {
    const keys = await this.storage.keys();
    return keys
      .filter(key => key.startsWith(CACHE_KEY_PREFIX))
      .map(key => key.replace(`${CACHE_KEY_PREFIX}/`, ''));
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<{ removed: number }> {
    const keys = await this.storage.keys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));

    let removed = 0;
    for (const key of cacheKeys) {
      const entry = await this.storage.read<QuestionCacheEntry>(key);
      if (entry && this.isExpired(entry.generatedAt)) {
        await this.storage.delete(key);
        removed++;
      }
    }

    return { removed };
  }
}
```

---

## 3.5 Question History Manager (`src/domain/question/historyManager.ts`)

This module manages question-level history for tracking user interactions with questions.

### 3.5.1 Storage Keys

```typescript
import type { IStorageAdapter } from '@/ports/IStorageAdapter';
import { hashString } from '@/domain/embedding/prepareText';
import type {
  NoteQuestionHistory,
  QuestionHistoryEntry,
  QuestionHistorySummary,
  QuestionInteraction,
  QuestionStatus,
  DerivedNoteStats,
  QUESTION_HISTORY_VERSION,
} from './types';

const HISTORY_KEY_PREFIX = 'history/questions';

/**
 * Get storage key for note question history
 */
export function getQuestionHistoryKey(noteId: string): string {
  const normalized = noteId.toLowerCase().replace(/\\/g, '/');
  return `${HISTORY_KEY_PREFIX}/${hashString(normalized).slice(0, 8)}`;
}
```

### 3.5.2 History Manager

```typescript
/**
 * Manages question-level history for spaced repetition
 */
export class QuestionHistoryManager {
  constructor(private storage: IStorageAdapter) {}

  /**
   * Get history for a note
   */
  async getNoteHistory(noteId: string): Promise<NoteQuestionHistory | null> {
    const key = getQuestionHistoryKey(noteId);
    const history = await this.storage.read<NoteQuestionHistory>(key);

    if (!history || history.version !== QUESTION_HISTORY_VERSION) {
      return null;
    }

    return history;
  }

  /**
   * Record an interaction with a question
   */
  async recordInteraction(
    noteId: string,
    questionId: string,
    questionText: string,
    correct: boolean | null,
    userAnswer?: string
  ): Promise<void> {
    let history = await this.getNoteHistory(noteId);

    if (!history) {
      history = this.createEmptyHistory(noteId);
    }

    const existing = history.questions[questionId];
    const interaction: QuestionInteraction = {
      timestamp: Date.now(),
      correct,
      userAnswer,
    };

    if (existing) {
      existing.interactions.push(interaction);
      existing.lastInteraction = interaction.timestamp;

      if (correct === true) {
        existing.correctCount++;
        existing.correctStreak++;
      } else if (correct === false) {
        existing.incorrectCount++;
        existing.correctStreak = 0;
      }
      // correct === null means skipped, don't update streak
    } else {
      history.questions[questionId] = {
        questionId,
        questionText,
        sourceNoteId: noteId,
        status: 'answered',
        interactions: [interaction],
        correctCount: correct === true ? 1 : 0,
        incorrectCount: correct === false ? 1 : 0,
        correctStreak: correct === true ? 1 : 0,
        firstSeen: Date.now(),
        lastInteraction: interaction.timestamp,
      };
    }

    history.lastUpdated = Date.now();
    await this.saveHistory(noteId, history);
  }

  /**
   * Mark a question as mastered
   */
  async markMastered(noteId: string, questionId: string): Promise<void> {
    const history = await this.getNoteHistory(noteId);
    if (!history) return;

    const entry = history.questions[questionId];
    if (entry) {
      entry.status = 'mastered';
      history.lastUpdated = Date.now();
      await this.saveHistory(noteId, history);
    }
  }

  /**
   * Mark a question as skipped
   */
  async markSkipped(
    noteId: string,
    questionId: string,
    questionText: string
  ): Promise<void> {
    await this.recordInteraction(noteId, questionId, questionText, null);

    const history = await this.getNoteHistory(noteId);
    if (history) {
      const entry = history.questions[questionId];
      if (entry) {
        entry.status = 'skipped';
        await this.saveHistory(noteId, history);
      }
    }
  }

  /**
   * Build a summary for LLM context from multiple notes
   */
  async buildHistorySummaryForNotes(noteIds: string[]): Promise<QuestionHistorySummary> {
    const summary: QuestionHistorySummary = {
      masteredQuestions: [],
      wellKnownQuestions: [],
      strugglingQuestions: [],
      recentlyShownQuestions: [],
    };

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const wellKnownThreshold = 3;
    const strugglingThreshold = 0.5;

    for (const noteId of noteIds) {
      const history = await this.getNoteHistory(noteId);
      if (!history) continue;

      for (const entry of Object.values(history.questions)) {
        // Mastered questions
        if (entry.status === 'mastered') {
          summary.masteredQuestions.push(entry.questionText);
          continue;
        }

        // Recently shown (within 24 hours)
        if (entry.lastInteraction && entry.lastInteraction > oneDayAgo) {
          summary.recentlyShownQuestions.push(entry.questionText);
        }

        // Calculate accuracy
        const totalAttempts = entry.correctCount + entry.incorrectCount;
        if (totalAttempts > 0) {
          const accuracy = entry.correctCount / totalAttempts;

          if (accuracy < strugglingThreshold && totalAttempts >= 2) {
            summary.strugglingQuestions.push(entry.questionText);
          } else if (entry.correctCount >= wellKnownThreshold) {
            summary.wellKnownQuestions.push(entry.questionText);
          }
        }
      }
    }

    return summary;
  }

  /**
   * Generate a fingerprint for cache invalidation
   * Only includes mastered + struggling as these affect question generation
   */
  generateFingerprint(summary: QuestionHistorySummary): string {
    const relevantState = [
      ...summary.masteredQuestions.sort(),
      '|',
      ...summary.strugglingQuestions.sort(),
    ].join(',');
    return hashString(relevantState);
  }

  /**
   * Derive note-level stats from question history
   */
  async deriveNoteStats(noteId: string): Promise<DerivedNoteStats> {
    const history = await this.getNoteHistory(noteId);

    if (!history || Object.keys(history.questions).length === 0) {
      return {
        lastQuizzed: null,
        quizCount: 0,
        correctCount: 0,
        correctStreak: 0,
      };
    }

    const allInteractions = Object.values(history.questions)
      .flatMap(q => q.interactions)
      .filter(i => i.correct !== null); // Only count actual attempts

    if (allInteractions.length === 0) {
      return {
        lastQuizzed: null,
        quizCount: 0,
        correctCount: 0,
        correctStreak: 0,
      };
    }

    // Calculate aggregate stats
    const sortedByTime = allInteractions.sort((a, b) => b.timestamp - a.timestamp);
    const lastQuizzed = sortedByTime[0].timestamp;
    const quizCount = allInteractions.length;
    const correctCount = allInteractions.filter(i => i.correct === true).length;

    // Calculate streak from most recent consecutive correct answers
    let correctStreak = 0;
    for (const interaction of sortedByTime) {
      if (interaction.correct === true) {
        correctStreak++;
      } else {
        break;
      }
    }

    return { lastQuizzed, quizCount, correctCount, correctStreak };
  }

  private createEmptyHistory(noteId: string): NoteQuestionHistory {
    return {
      version: QUESTION_HISTORY_VERSION,
      noteId,
      questions: {},
      lastUpdated: Date.now(),
    };
  }

  private async saveHistory(
    noteId: string,
    history: NoteQuestionHistory
  ): Promise<void> {
    const key = getQuestionHistoryKey(noteId);
    await this.storage.write(key, history);
  }
}
```

---

## 4. LLM Prompts (`src/domain/question/prompts.ts`)

### 4.1 System Prompt

```typescript
export const QUESTION_GENERATION_SYSTEM_PROMPT = `You are an expert quiz generator for a spaced repetition learning system.
Your task is to generate high-quality quiz questions from personal knowledge notes.

Guidelines:
1. Generate 2-3 questions per note
2. Vary formats: multiple_choice, true_false, fill_blank, free_form
3. Test understanding, not trivia or memorization of exact wording
4. Include difficulty ratings (easy/medium/hard)
5. Each question should be self-contained (answerable without the note)
6. Avoid questions about dates, names, or trivial details
7. IMPORTANT: Review previously generated questions and avoid duplicates
8. For questions the user struggles with, consider generating related questions that test the same concept differently

Question Format Guidelines:
- multiple_choice: 4 options, one correct. Good for definitions, comparisons
- true_false: One statement to evaluate. Good for common misconceptions
- fill_blank: One key term missing. Good for terminology, syntax
- free_form: Open-ended, 1-2 sentence answer. Good for explanations, "why" questions

Quality Scoring (0-1):
- 0.9-1.0: Tests deep understanding, generalizable knowledge
- 0.7-0.9: Tests important concepts, clear and unambiguous
- 0.5-0.7: Tests useful but narrow knowledge
- <0.5: Trivia, ambiguous, or too easy

Return JSON only, no additional text.`;
```

### 4.2 User Prompt Builder

```typescript
import type { QuestionGenerationRequest, Question, QuestionHistorySummary } from './types';

/**
 * Build user prompt for question generation
 * Includes optional history context to avoid generating duplicate questions
 */
export function buildQuestionGenerationPrompt(
  request: QuestionGenerationRequest,
  history?: QuestionHistorySummary
): string {
  const noteDescriptions = request.notes
    .map((note, i) => `
<note_${i + 1}>
Title: ${note.title}
Path: ${note.noteId}
Content:
${note.content.slice(0, 1500)}${note.content.length > 1500 ? '...' : ''}
</note_${i + 1}>`)
    .join('\n');

  // Build history context section
  let historyContext = '';
  if (history) {
    const sections: string[] = [];

    if (history.masteredQuestions.length > 0) {
      sections.push(`## Mastered Questions (DO NOT regenerate these)
${history.masteredQuestions.map(q => `- ${q}`).join('\n')}`);
    }

    if (history.wellKnownQuestions.length > 0) {
      sections.push(`## Well-Known Questions (avoid similar questions)
${history.wellKnownQuestions.map(q => `- ${q}`).join('\n')}`);
    }

    if (history.strugglingQuestions.length > 0) {
      sections.push(`## Questions User Struggles With (consider variations)
${history.strugglingQuestions.map(q => `- ${q}`).join('\n')}`);
    }

    if (history.recentlyShownQuestions.length > 0) {
      sections.push(`## Recently Shown (avoid immediate repetition)
${history.recentlyShownQuestions.map(q => `- ${q}`).join('\n')}`);
    }

    if (sections.length > 0) {
      historyContext = `
<previous_questions>
${sections.join('\n\n')}
</previous_questions>
`;
    }
  }

  return `Generate quiz questions for these ${request.notes.length} notes:
${noteDescriptions}
${historyContext}
Return JSON array:
[
  {
    "sourceNoteId": "path/to/note.md",
    "format": "multiple_choice",
    "difficulty": "medium",
    "question": "What is...",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": 0,
    "qualityScore": 0.85,
    "explanation": "Brief explanation why this is correct"
  },
  ...
]

Requirements:
- Generate 2-3 questions per note
- Vary formats across questions
- Ensure each question has a clear, unambiguous correct answer
- Rate your own question quality honestly
- For fill_blank, use ___ to mark the blank in the question
- AVOID generating questions similar to those listed in <previous_questions>`;
}
```

### 4.3 Response Parser

```typescript
import { generateQuestionId } from './types';

/**
 * Extract JSON from LLM response
 */
function extractJSON(response: string): string {
  let cleaned = response.trim();

  // Try to extract from ```json ... ``` blocks
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim();
  }

  // Find array start
  const arrayStart = cleaned.indexOf('[');
  if (arrayStart === -1) {
    throw new Error('No JSON array found in response');
  }

  // Find matching end
  let depth = 0;
  let end = arrayStart;

  for (let i = arrayStart; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (char === '[' || char === '{') depth++;
    else if (char === ']' || char === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  return cleaned.slice(arrayStart, end);
}

/**
 * Validate question format
 */
const VALID_FORMATS = ['multiple_choice', 'true_false', 'fill_blank', 'free_form'];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

function validateQuestion(item: Record<string, unknown>): boolean {
  if (typeof item.sourceNoteId !== 'string') return false;
  if (typeof item.question !== 'string') return false;
  if (!VALID_FORMATS.includes(item.format as string)) return false;
  if (!VALID_DIFFICULTIES.includes(item.difficulty as string)) return false;

  // Format-specific validation
  if (item.format === 'multiple_choice') {
    if (!Array.isArray(item.options) || item.options.length !== 4) return false;
    if (typeof item.correctAnswer !== 'number') return false;
  }

  return true;
}

/**
 * Parse LLM response into questions
 */
export function parseQuestionResponse(response: string): Question[] {
  const json = extractJSON(response);
  const parsed = JSON.parse(json);

  if (!Array.isArray(parsed)) {
    throw new Error('Expected array of questions');
  }

  const questions: Question[] = [];

  for (const item of parsed) {
    if (!validateQuestion(item as Record<string, unknown>)) {
      console.warn('Skipping invalid question:', item);
      continue;
    }

    questions.push({
      id: generateQuestionId(),
      format: item.format as Question['format'],
      difficulty: item.difficulty as Question['difficulty'],
      question: item.question,
      sourceNoteId: item.sourceNoteId,
      qualityScore: typeof item.qualityScore === 'number'
        ? Math.max(0, Math.min(1, item.qualityScore))
        : 0.5,
      options: item.format === 'multiple_choice' ? item.options : undefined,
      correctAnswer: item.correctAnswer,
      explanation: typeof item.explanation === 'string' ? item.explanation : undefined,
      generatedAt: Date.now(),
    });
  }

  return questions;
}
```

---

## 5. ILLMProvider Extension

Update `src/ports/ILLMProvider.ts`:

```typescript
import type { ConceptNamingRequest, ConceptNamingResponse, LLMConfig } from '@/domain/llm/types';
import type { QuestionGenerationRequest, QuestionGenerationResponse } from '@/domain/question/types';

export interface ILLMProvider {
  /** Existing: name concepts from clusters */
  nameConceptsBatch(request: ConceptNamingRequest): Promise<ConceptNamingResponse>;

  /** New: generate questions from notes */
  generateQuestionsBatch(request: QuestionGenerationRequest): Promise<QuestionGenerationResponse>;

  getConfig(): LLMConfig;
  updateConfig(config: Partial<LLMConfig>): void;
}
```

---

## 6. Pipeline (`src/domain/question/pipeline.ts`)

### 6.1 Pipeline Types

```typescript
import type { ILLMProvider } from '@/ports/ILLMProvider';
import type { IStorageAdapter } from '@/ports/IStorageAdapter';
import type { TrackedConcept } from '@/domain/llm/types';
import type {
  Question,
  QuestionGenerationConfig,
  NoteSelectionInput,
  DerivedNoteStats,
  DEFAULT_QUESTION_CONFIG,
  EMPTY_DERIVED_STATS,
} from './types';

export interface QuestionPipelineInput {
  /** Concept to generate questions for */
  concept: TrackedConcept;
  /** LLM provider for question generation */
  llmProvider: ILLMProvider;
  /** Storage adapter for caching and history */
  storageAdapter: IStorageAdapter;
  /** Function to read note content */
  readNote: (noteId: string) => Promise<{ content: string; title: string } | null>;
  /** Function to get note metadata */
  getNoteMetadata: (noteId: string) => Promise<NoteSelectionInput | null>;
  /** Function to compute content hash */
  getContentHash: (content: string) => string;
  /** Configuration overrides */
  config?: Partial<QuestionGenerationConfig>;
}

export interface QuestionPipelineResult {
  questions: Question[];
  stats: {
    notesInConcept: number;
    notesQuizzable: number;
    notesSelected: number;
    cacheHits: number;
    cacheMisses: number;
    questionsGenerated: number;
    questionsFromCache: number;
    llmBatches: number;
    tokenUsage: { inputTokens: number; outputTokens: number };
  };
}
```

### 6.2 Main Pipeline

```typescript
import { QuestionCacheManager } from './cache';
import { QuestionHistoryManager } from './historyManager';
import { scoreNote, selectNotes, shouldQuizNote } from './noteSelection';
import { buildQuestionGenerationPrompt, parseQuestionResponse, QUESTION_GENERATION_SYSTEM_PROMPT } from './prompts';

export async function runQuestionPipeline(
  input: QuestionPipelineInput
): Promise<QuestionPipelineResult> {
  const config = { ...DEFAULT_QUESTION_CONFIG, ...input.config };
  const cache = new QuestionCacheManager(input.storageAdapter, config);
  const historyManager = new QuestionHistoryManager(input.storageAdapter);

  const stats = {
    notesInConcept: input.concept.noteIds.length,
    notesQuizzable: 0,
    notesSelected: 0,
    cacheHits: 0,
    cacheMisses: 0,
    questionsGenerated: 0,
    questionsFromCache: 0,
    llmBatches: 0,
    tokenUsage: { inputTokens: 0, outputTokens: 0 },
  };

  // 1. Get metadata and filter quizzable notes using derived stats
  const quizzableNotes: Array<{ input: NoteSelectionInput; stats: DerivedNoteStats }> = [];

  for (const noteId of input.concept.noteIds) {
    const metadata = await input.getNoteMetadata(noteId);
    if (!metadata) continue;

    const derivedStats = await historyManager.deriveNoteStats(noteId);
    if (shouldQuizNote(derivedStats)) {
      quizzableNotes.push({ input: metadata, stats: derivedStats });
    }
  }

  stats.notesQuizzable = quizzableNotes.length;

  if (quizzableNotes.length === 0) {
    return { questions: [], stats };
  }

  // 2. Score notes using derived stats
  const scoredNotes = quizzableNotes.map(({ input, stats: noteStats }) =>
    scoreNote(input, noteStats)
  );

  // 3. Select notes via stratified sampling
  const targetNotes = Math.min(
    config.targetQuestionCount * 2,
    quizzableNotes.length
  );
  const selectedNoteIds = selectNotes(scoredNotes, targetNotes);
  stats.notesSelected = selectedNoteIds.length;

  // 4. Build history summary for LLM context and cache fingerprint
  const historySummary = await historyManager.buildHistorySummaryForNotes(selectedNoteIds);
  const historyFingerprint = historyManager.generateFingerprint(historySummary);

  // 5. Check cache and partition
  const cachedQuestions: Question[] = [];
  const needsGeneration: Array<{ noteId: string; title: string; content: string; contentHash: string }> = [];

  for (const noteId of selectedNoteIds) {
    const noteData = await input.readNote(noteId);
    if (!noteData) continue;

    const contentHash = input.getContentHash(noteData.content);
    const cached = await cache.get(noteId, contentHash, historyFingerprint);

    if (cached) {
      cachedQuestions.push(...cached);
      stats.cacheHits++;
      stats.questionsFromCache += cached.length;
    } else {
      needsGeneration.push({
        noteId,
        title: noteData.title,
        content: noteData.content,
        contentHash,
      });
      stats.cacheMisses++;
    }
  }

  // 6. Generate questions in batches with history context
  const generatedQuestions: Question[] = [];

  for (let i = 0; i < needsGeneration.length; i += config.notesPerBatch) {
    const batch = needsGeneration.slice(i, i + config.notesPerBatch);
    stats.llmBatches++;

    // Build prompt with history context to avoid duplicate questions
    const prompt = buildQuestionGenerationPrompt(
      { notes: batch.map(n => ({ noteId: n.noteId, title: n.title, content: n.content })) },
      historySummary
    );

    const response = await input.llmProvider.generateQuestionsBatch({
      notes: batch.map(n => ({
        noteId: n.noteId,
        title: n.title,
        content: n.content,
      })),
    });

    if (response.usage) {
      stats.tokenUsage.inputTokens += response.usage.inputTokens;
      stats.tokenUsage.outputTokens += response.usage.outputTokens;
    }

    // Cache questions by source note
    const questionsByNote = new Map<string, Question[]>();
    for (const q of response.questions) {
      const existing = questionsByNote.get(q.sourceNoteId) ?? [];
      existing.push(q);
      questionsByNote.set(q.sourceNoteId, existing);
    }

    for (const note of batch) {
      const questions = questionsByNote.get(note.noteId) ?? [];
      if (questions.length > 0) {
        await cache.set(note.noteId, note.contentHash, historyFingerprint, questions);
      }
    }

    generatedQuestions.push(...response.questions);
    stats.questionsGenerated += response.questions.length;
  }

  // 7. Combine and select final questions
  const allCandidates = [...cachedQuestions, ...generatedQuestions];
  const finalQuestions = selectFinalQuestions(allCandidates, config);

  return { questions: finalQuestions, stats };
}
```

### 6.3 Question Selection

```typescript
/**
 * Select final questions by format distribution
 */
export function selectFinalQuestions(
  candidates: Question[],
  config: QuestionGenerationConfig
): Question[] {
  const selected: Question[] = [];

  for (const [format, count] of Object.entries(config.targetDistribution)) {
    const bucket = candidates
      .filter(q => q.format === format)
      .sort((a, b) => b.qualityScore - a.qualityScore);
    selected.push(...bucket.slice(0, count));
  }

  // If we didn't get enough, fill from remaining high-quality questions
  if (selected.length < config.targetQuestionCount) {
    const selectedIds = new Set(selected.map(q => q.id));
    const remaining = candidates
      .filter(q => !selectedIds.has(q.id))
      .sort((a, b) => b.qualityScore - a.qualityScore);

    const needed = config.targetQuestionCount - selected.length;
    selected.push(...remaining.slice(0, needed));
  }

  return selected;
}
```

---

## 7. AnthropicLLMAdapter Update

Add to `src/adapters/anthropic/AnthropicLLMAdapter.ts`:

```typescript
import type { QuestionGenerationRequest, QuestionGenerationResponse } from '@/domain/question/types';
import { QUESTION_GENERATION_SYSTEM_PROMPT, buildQuestionGenerationPrompt, parseQuestionResponse } from '@/domain/question/prompts';

// In AnthropicLLMAdapter class:

async generateQuestionsBatch(
  request: QuestionGenerationRequest
): Promise<QuestionGenerationResponse> {
  const prompt = buildQuestionGenerationPrompt(request);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: QUESTION_GENERATION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
        .map(block => block.text)
        .join('');

      const questions = parseQuestionResponse(text);

      return {
        questions,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (error) {
      lastError = error as Error;

      if (!this.isRetryable(error) || attempt >= this.config.maxRetries) {
        throw new LLMApiError(
          `Question generation failed: ${(error as Error).message}`,
          this.isRetryable(error)
        );
      }

      await this.sleep(this.config.retryBaseDelay * Math.pow(2, attempt));
    }
  }

  throw lastError;
}
```

---

## 8. MockLLMAdapter Update

Add to `src/adapters/mock/MockLLMAdapter.ts`:

```typescript
import type { QuestionGenerationRequest, QuestionGenerationResponse, Question } from '@/domain/question/types';
import { generateQuestionId } from '@/domain/question/types';

// In MockLLMAdapter class:

async generateQuestionsBatch(
  request: QuestionGenerationRequest
): Promise<QuestionGenerationResponse> {
  const questions: Question[] = [];

  for (const note of request.notes) {
    // Generate deterministic mock questions
    questions.push(
      {
        id: generateQuestionId(),
        format: 'multiple_choice',
        difficulty: 'medium',
        question: `What is the main concept in "${note.title}"?`,
        options: ['Concept A', 'Concept B', 'Concept C', 'Concept D'],
        correctAnswer: 0,
        qualityScore: 0.8,
        sourceNoteId: note.noteId,
        generatedAt: Date.now(),
      },
      {
        id: generateQuestionId(),
        format: 'true_false',
        difficulty: 'easy',
        question: `The note "${note.title}" covers important concepts.`,
        correctAnswer: 'true',
        qualityScore: 0.7,
        sourceNoteId: note.noteId,
        generatedAt: Date.now(),
      },
      {
        id: generateQuestionId(),
        format: 'free_form',
        difficulty: 'hard',
        question: `Explain the key takeaways from "${note.title}".`,
        correctAnswer: 'The key takeaways include...',
        qualityScore: 0.85,
        sourceNoteId: note.noteId,
        generatedAt: Date.now(),
      }
    );
  }

  return {
    questions,
    usage: {
      inputTokens: request.notes.length * 500,
      outputTokens: questions.length * 100,
    },
  };
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

Create `src/domain/question/__tests__/`:

- `noteSelection.test.ts` - Test all scoring functions
- `cache.test.ts` - Test QuestionCacheManager
- `prompts.test.ts` - Test prompt building and parsing
- `historyManager.test.ts` - Test QuestionHistoryManager
- `pipeline.test.ts` - Test full pipeline with mocks

### 9.2 Test Patterns

```typescript
// Example: noteSelection.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateSpacedRepScore,
  calculateRichnessScore,
  shouldQuizNote,
  selectNotes,
} from '../noteSelection';
import { EMPTY_DERIVED_STATS } from '../types';

describe('calculateSpacedRepScore', () => {
  it('returns 1.0 for never-quizzed notes', () => {
    expect(calculateSpacedRepScore(EMPTY_DERIVED_STATS)).toBe(1.0);
  });

  it('returns high score for overdue notes', () => {
    const stats = {
      ...EMPTY_DERIVED_STATS,
      lastQuizzed: Date.now() - 40 * 24 * 60 * 60 * 1000, // 40 days ago
      quizCount: 1,
      correctStreak: 0,
    };
    expect(calculateSpacedRepScore(stats)).toBe(0.95);
  });
});

describe('shouldQuizNote', () => {
  it('returns true for never-quizzed notes', () => {
    expect(shouldQuizNote(EMPTY_DERIVED_STATS)).toBe(true);
  });

  it('returns false for mastered notes', () => {
    const stats = {
      lastQuizzed: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
      quizCount: 10,
      correctCount: 10,
      correctStreak: 6, // > 5
    };
    expect(shouldQuizNote(stats)).toBe(false);
  });
});
```

---

## 10. Verification Script

See `scripts/run-question-generation.ts` for the standalone verification script that:

1. Loads concepts from `outputs/full-pipeline-run.json`
2. Reads note content from vault (TEST_VAULT_PATH)
3. Runs question generation pipeline
4. Outputs results to `outputs/question-generation-run.json`

Usage:
```bash
npx tsx scripts/run-question-generation.ts --limit 3
```

---

## Implementation Checklist

- [ ] Create `src/domain/question/types.ts`
- [ ] Create `src/domain/question/noteSelection.ts`
- [ ] Create `src/domain/question/__tests__/noteSelection.test.ts`
- [ ] Create `src/domain/question/cache.ts`
- [ ] Create `src/domain/question/__tests__/cache.test.ts`
- [ ] Create `src/domain/question/historyManager.ts`
- [ ] Create `src/domain/question/__tests__/historyManager.test.ts`
- [ ] Create `src/domain/question/prompts.ts`
- [ ] Create `src/domain/question/__tests__/prompts.test.ts`
- [ ] Update `src/ports/ILLMProvider.ts`
- [ ] Update `src/adapters/mock/MockLLMAdapter.ts`
- [ ] Create `src/domain/question/pipeline.ts`
- [ ] Create `src/domain/question/__tests__/pipeline.test.ts`
- [ ] Update `src/adapters/anthropic/AnthropicLLMAdapter.ts`
- [ ] Create `src/domain/question/index.ts`
- [ ] Create `scripts/run-question-generation.ts`
- [ ] Run all tests and verify
