import { describe, it, expect } from 'vitest';
import {
  groupByTitleKeywords,
  extractTitleKeywords,
  detectLanguage,
  isCJK,
  segmentCJK,
  extractEnglishKeywords,
  calculateKeywordScores,
  filterCJKStopWords,
} from '../groupByTitleKeywords';
import { createCluster, DEFAULT_CLUSTERING_CONFIG, type ClusteringConfig } from '../types';
import type { FileInfo } from '@/ports/IVaultProvider';
import { createFileInfo } from '@/test/fixtures/types';

describe('groupByTitleKeywords', () => {
  const config: ClusteringConfig = {
    ...DEFAULT_CLUSTERING_CONFIG,
    minClusterSize: 2,
  };

  function createFileMap(files: FileInfo[]): Map<string, FileInfo> {
    return new Map(files.map((f) => [f.path, f]));
  }

  it('should group notes by common keywords', () => {
    // Need enough notes per keyword to exceed minClusterSize
    const clusters = [
      createCluster({
        noteIds: [
          'react-basics.md',
          'react-hooks.md',
          'react-patterns.md',
          'react-testing.md',
          'python-basics.md',
          'python-advanced.md',
          'python-ml.md',
          'python-data.md',
        ],
        folderPath: 'code',
      }),
    ];

    const files = createFileMap([
      createFileInfo('react-basics.md', { basename: 'React Basics Guide' }),
      createFileInfo('react-hooks.md', { basename: 'React Custom Hooks' }),
      createFileInfo('react-patterns.md', { basename: 'React Design Patterns' }),
      createFileInfo('react-testing.md', { basename: 'React Testing Library' }),
      createFileInfo('python-basics.md', { basename: 'Python Getting Started' }),
      createFileInfo('python-advanced.md', { basename: 'Python Advanced Topics' }),
      createFileInfo('python-ml.md', { basename: 'Python Machine Learning' }),
      createFileInfo('python-data.md', { basename: 'Python Data Science' }),
    ]);

    const result = groupByTitleKeywords(clusters, files, config);

    // Should split - both react and python have 4 notes each (>= minClusterSize of 2)
    expect(result.length).toBeGreaterThan(1);

    // Check that we have distinct groups
    const allNoteIds = result.flatMap((c) => c.noteIds);
    expect(allNoteIds).toHaveLength(8);
  });

  it('should handle single cluster that cannot be split', () => {
    const clusters = [
      createCluster({
        noteIds: ['note1.md', 'note2.md'],
        folderPath: 'misc',
      }),
    ];

    const files = createFileMap([
      createFileInfo('note1.md', { basename: 'Random Note' }),
      createFileInfo('note2.md', { basename: 'Another Note' }),
    ]);

    const result = groupByTitleKeywords(clusters, files, config);

    // Should keep as single cluster
    expect(result).toHaveLength(1);
  });

  it('should handle empty clusters array', () => {
    const result = groupByTitleKeywords([], new Map(), config);
    expect(result).toHaveLength(0);
  });
});

describe('detectLanguage', () => {
  it('should detect English text', () => {
    expect(detectLanguage('Hello World')).toBe('en');
    expect(detectLanguage('React Hooks Tutorial')).toBe('en');
  });

  it('should detect Chinese text', () => {
    expect(detectLanguage('你好世界')).toBe('zh');
    expect(detectLanguage('学习笔记')).toBe('zh');
  });

  it('should detect Japanese text', () => {
    expect(detectLanguage('こんにちは')).toBe('ja');
    expect(detectLanguage('日本語テスト')).toBe('ja');
    expect(detectLanguage('プログラミング入門')).toBe('ja');
  });

  it('should detect Korean text', () => {
    expect(detectLanguage('안녕하세요')).toBe('ko');
    expect(detectLanguage('한국어 테스트')).toBe('ko');
  });

  it('should detect mixed text', () => {
    expect(detectLanguage('Hello 世界')).toBe('mixed');
    expect(detectLanguage('React 入门教程')).toBe('mixed');
  });

  it('should handle empty string', () => {
    expect(detectLanguage('')).toBe('en');
  });

  it('should handle numbers and symbols only', () => {
    expect(detectLanguage('123 !@#')).toBe('en');
  });
});

describe('isCJK', () => {
  it('should return true for CJK languages', () => {
    expect(isCJK('zh')).toBe(true);
    expect(isCJK('ja')).toBe(true);
    expect(isCJK('ko')).toBe(true);
  });

  it('should return false for non-CJK languages', () => {
    expect(isCJK('en')).toBe(false);
    expect(isCJK('mixed')).toBe(false);
  });
});

describe('segmentCJK', () => {
  it('should segment Chinese text', () => {
    const words = segmentCJK('学习笔记', 'zh');
    expect(words.length).toBeGreaterThan(0);
  });

  it('should segment Japanese text', () => {
    const words = segmentCJK('プログラミング入門', 'ja');
    expect(words.length).toBeGreaterThan(0);
  });

  it('should segment Korean text', () => {
    const words = segmentCJK('한국어 테스트', 'ko');
    expect(words.length).toBeGreaterThan(0);
  });

  it('should filter punctuation', () => {
    const words = segmentCJK('你好！世界？', 'zh');
    expect(words.every((w) => !/[！？]/.test(w))).toBe(true);
  });

  it('should handle mixed text', () => {
    const words = segmentCJK('React 入门', 'zh');
    expect(words.length).toBeGreaterThan(0);
  });
});

describe('extractEnglishKeywords', () => {
  it('should extract meaningful words', () => {
    const keywords = extractEnglishKeywords('React Hooks Tutorial');
    expect(keywords).toContain('react');
    expect(keywords).toContain('hooks');
    expect(keywords).toContain('tutorial');
  });

  it('should filter stop words', () => {
    const keywords = extractEnglishKeywords('The Art of Programming');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('of');
    expect(keywords).toContain('art');
    expect(keywords).toContain('programming');
  });

  it('should filter short words', () => {
    const keywords = extractEnglishKeywords('Go is a language');
    expect(keywords).not.toContain('go');
    expect(keywords).not.toContain('is');
    expect(keywords).toContain('language');
  });

  it('should lowercase keywords', () => {
    const keywords = extractEnglishKeywords('REACT HOOKS');
    expect(keywords).toContain('react');
    expect(keywords).toContain('hooks');
  });

  it('should split on punctuation', () => {
    const keywords = extractEnglishKeywords('React-Hooks: A Tutorial');
    expect(keywords).toContain('react');
    expect(keywords).toContain('hooks');
    expect(keywords).toContain('tutorial');
  });
});

describe('extractTitleKeywords', () => {
  it('should use English extraction for English titles', () => {
    const keywords = extractTitleKeywords('React Basics');
    expect(keywords).toContain('react');
    expect(keywords).toContain('basics');
  });

  it('should use CJK segmentation for Chinese titles', () => {
    const keywords = extractTitleKeywords('学习笔记');
    expect(keywords.length).toBeGreaterThan(0);
  });

  it('should use CJK segmentation for Japanese titles', () => {
    const keywords = extractTitleKeywords('プログラミング入門');
    expect(keywords.length).toBeGreaterThan(0);
  });

  it('should use CJK segmentation for Korean titles', () => {
    const keywords = extractTitleKeywords('한국어 학습');
    expect(keywords.length).toBeGreaterThan(0);
  });
});

describe('calculateKeywordScores', () => {
  it('should give higher scores to keywords that appear multiple times', () => {
    const noteKeywords = new Map([
      ['a.md', ['react', 'hooks', 'tutorial']],
      ['b.md', ['react', 'basics']],
      ['c.md', ['react', 'tutorial']],
      ['d.md', ['python', 'tutorial']],
    ]);

    const scores = calculateKeywordScores(noteKeywords);

    // 'react' appears in 3/4 docs - good for clustering
    // 'python' appears in 1/4 docs - too rare to form cluster
    expect(scores.get('react')).toBeGreaterThan(0);
    expect(scores.get('python')).toBe(0); // Only 1 occurrence
  });

  it('should give zero score to unique keywords', () => {
    const noteKeywords = new Map([
      ['a.md', ['react', 'unique1']],
      ['b.md', ['react', 'unique2']],
    ]);

    const scores = calculateKeywordScores(noteKeywords);

    expect(scores.get('unique1')).toBe(0);
    expect(scores.get('unique2')).toBe(0);
    expect(scores.get('react')).toBeGreaterThan(0);
  });

  it('should handle empty input', () => {
    const scores = calculateKeywordScores(new Map());
    expect(scores.size).toBe(0);
  });

  it('should handle single document', () => {
    const noteKeywords = new Map([['a.md', ['react', 'hooks']]]);
    const scores = calculateKeywordScores(noteKeywords);
    // All keywords appear only once, so scores are 0
    expect(scores.get('react')).toBe(0);
    expect(scores.get('hooks')).toBe(0);
  });
});

describe('filterCJKStopWords', () => {
  it('should filter Chinese stop words', () => {
    const words = ['我', '的', '学习', '笔记', '是', '很', '好'];
    const filtered = filterCJKStopWords(words, 'zh');
    expect(filtered).toContain('学习');
    expect(filtered).toContain('笔记');
    expect(filtered).toContain('好');
    expect(filtered).not.toContain('的');
    expect(filtered).not.toContain('是');
    expect(filtered).not.toContain('我');
    expect(filtered).not.toContain('很');
  });

  it('should filter Japanese stop words', () => {
    const words = ['の', 'は', 'プログラミング', '入門', 'です'];
    const filtered = filterCJKStopWords(words, 'ja');
    expect(filtered).toContain('プログラミング');
    expect(filtered).toContain('入門');
    expect(filtered).not.toContain('の');
    expect(filtered).not.toContain('は');
    expect(filtered).not.toContain('です');
  });

  it('should filter Korean stop words', () => {
    const words = ['은', '한국어', '가', '테스트', '를'];
    const filtered = filterCJKStopWords(words, 'ko');
    expect(filtered).toContain('한국어');
    expect(filtered).toContain('테스트');
    expect(filtered).not.toContain('은');
    expect(filtered).not.toContain('가');
    expect(filtered).not.toContain('를');
  });

  it('should return words unchanged for non-CJK languages', () => {
    const words = ['hello', 'world'];
    expect(filterCJKStopWords(words, 'en')).toEqual(words);
    expect(filterCJKStopWords(words, 'mixed')).toEqual(words);
  });

  it('should handle empty array', () => {
    expect(filterCJKStopWords([], 'zh')).toEqual([]);
  });
});

describe('extractTitleKeywords - mixed language', () => {
  it('should extract both English and CJK keywords from mixed titles', () => {
    const keywords = extractTitleKeywords('Python机器学习');
    expect(keywords).toContain('python');
    // Should have CJK keywords from segmentation
    expect(keywords.some((k) => /[\u4e00-\u9fff]/.test(k))).toBe(true);
  });

  it('should extract keywords from "React 入门教程"', () => {
    const keywords = extractTitleKeywords('React 入门教程');
    expect(keywords).toContain('react');
    // Should have CJK keywords
    expect(keywords.some((k) => /[\u4e00-\u9fff]/.test(k))).toBe(true);
  });

  it('should filter stop words from mixed language titles', () => {
    // "我的Python笔记" = "My Python notes"
    const keywords = extractTitleKeywords('我的Python笔记');
    expect(keywords).toContain('python');
    // Should not contain stop words like 的
    expect(keywords).not.toContain('的');
  });
});

describe('extractTitleKeywords - CJK stop word filtering', () => {
  it('should filter stop words from Chinese titles', () => {
    // "我的笔记是很好的" = "My notes are very good"
    const keywords = extractTitleKeywords('学习的笔记');
    expect(keywords).not.toContain('的');
  });

  it('should keep meaningful words after filtering', () => {
    const keywords = extractTitleKeywords('学习笔记');
    expect(keywords.length).toBeGreaterThan(0);
  });
});
