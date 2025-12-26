import type { FileInfo } from '@/ports/IVaultProvider';
import { createCluster, type Cluster, type ClusteringConfig } from './types';

/**
 * Language detection result
 */
export type Language = 'en' | 'zh' | 'ja' | 'ko' | 'mixed';

/**
 * Groups notes within a cluster by title keywords
 * Uses TF-IDF for English and Intl.Segmenter for CJK languages
 *
 * @param clusters - Array of clusters to refine
 * @param files - File info map (path -> FileInfo)
 * @param config - Clustering configuration
 * @returns Refined array of clusters
 */
export function groupByTitleKeywords(
  clusters: Cluster[],
  files: Map<string, FileInfo>,
  config: ClusteringConfig
): Cluster[] {
  const result: Cluster[] = [];

  for (const cluster of clusters) {
    // Extract titles and keywords
    const noteTitles = new Map<string, string>();
    for (const noteId of cluster.noteIds) {
      const file = files.get(noteId);
      if (file) {
        noteTitles.set(noteId, file.basename);
      }
    }

    // Extract keywords for each note
    const noteKeywords = new Map<string, string[]>();
    for (const [noteId, title] of noteTitles) {
      const keywords = extractTitleKeywords(title);
      noteKeywords.set(noteId, keywords);
    }

    // Calculate TF-IDF scores for keywords
    const keywordScores = calculateKeywordScores(noteKeywords);

    // Group notes by their most significant keyword
    const groups = groupByTopKeyword(cluster.noteIds, noteKeywords, keywordScores);

    // Filter groups by minimum size
    const significantGroups = Array.from(groups.entries()).filter(
      ([, noteIds]) => noteIds.length >= config.minClusterSize
    );

    // If we have multiple significant groups, split
    if (significantGroups.length > 1) {
      for (const [keyword, noteIds] of significantGroups) {
        result.push(
          createCluster({
            noteIds,
            folderPath: cluster.folderPath,
            dominantTags: cluster.dominantTags,
            candidateNames: [...cluster.candidateNames, formatKeywordAsName(keyword)],
          })
        );
      }

      // Handle orphans
      const groupedNotes = new Set(significantGroups.flatMap(([, ids]) => ids));
      const orphans = cluster.noteIds.filter((id) => !groupedNotes.has(id));
      if (orphans.length > 0) {
        result.push(
          createCluster({
            noteIds: orphans,
            folderPath: cluster.folderPath,
            dominantTags: cluster.dominantTags,
            candidateNames: [...cluster.candidateNames, 'Other'],
          })
        );
      }
    } else {
      // Keep original cluster
      result.push(cluster);
    }
  }

  return result;
}

/**
 * Extract keywords from a title
 * Uses Intl.Segmenter for CJK, simple tokenization for English
 */
export function extractTitleKeywords(title: string): string[] {
  const lang = detectLanguage(title);

  if (isCJK(lang)) {
    return segmentCJK(title, lang);
  }

  return extractEnglishKeywords(title);
}

/**
 * Detect the primary language of a string
 */
export function detectLanguage(text: string): Language {
  // Count characters by type
  let cjkCount = 0;
  let latinCount = 0;

  for (const char of text) {
    if (isCJKCharacter(char)) {
      cjkCount++;
    } else if (/[a-zA-Z]/.test(char)) {
      latinCount++;
    }
  }

  const total = cjkCount + latinCount;
  if (total === 0) return 'en';

  const cjkRatio = cjkCount / total;

  if (cjkRatio > 0.5) {
    // Determine which CJK language
    return detectCJKLanguage(text);
  }

  if (latinCount > 0 && cjkCount > 0) {
    return 'mixed';
  }

  return 'en';
}

/**
 * Check if a character is a CJK character
 */
function isCJKCharacter(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    // CJK Unified Ideographs
    (code >= 0x4e00 && code <= 0x9fff) ||
    // CJK Extension A
    (code >= 0x3400 && code <= 0x4dbf) ||
    // Hiragana
    (code >= 0x3040 && code <= 0x309f) ||
    // Katakana
    (code >= 0x30a0 && code <= 0x30ff) ||
    // Korean Hangul
    (code >= 0xac00 && code <= 0xd7af) ||
    // Korean Jamo
    (code >= 0x1100 && code <= 0x11ff)
  );
}

/**
 * Detect which CJK language based on character distribution
 */
function detectCJKLanguage(text: string): Language {
  let hiraganaKatakana = 0;
  let hangul = 0;

  for (const char of text) {
    const code = char.charCodeAt(0);
    if (
      (code >= 0x3040 && code <= 0x309f) || // Hiragana
      (code >= 0x30a0 && code <= 0x30ff) // Katakana
    ) {
      hiraganaKatakana++;
    } else if (
      (code >= 0xac00 && code <= 0xd7af) || // Hangul Syllables
      (code >= 0x1100 && code <= 0x11ff) // Hangul Jamo
    ) {
      hangul++;
    }
  }

  if (hiraganaKatakana > 0) return 'ja';
  if (hangul > 0) return 'ko';
  return 'zh';
}

/**
 * Check if language is CJK
 */
export function isCJK(lang: Language): boolean {
  return lang === 'zh' || lang === 'ja' || lang === 'ko';
}

/**
 * Segment CJK text using Intl.Segmenter
 */
export function segmentCJK(text: string, lang: Language): string[] {
  const locale = lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja' : 'ko';

  try {
    const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
    const segments = segmenter.segment(text);

    const words: string[] = [];
    for (const segment of segments) {
      // Filter out whitespace and punctuation
      const word = segment.segment.trim();
      if (word.length > 0 && !isPunctuation(word)) {
        words.push(word.toLowerCase());
      }
    }

    return words;
  } catch {
    // Fallback: character-based segmentation for very old environments
    return fallbackCJKSegmentation(text);
  }
}

/**
 * Fallback CJK segmentation (character-based)
 */
function fallbackCJKSegmentation(text: string): string[] {
  const words: string[] = [];
  let current = '';

  for (const char of text) {
    if (isCJKCharacter(char)) {
      // For CJK, each character can be a word (simplified approach)
      if (current.length > 0) {
        words.push(current.toLowerCase());
        current = '';
      }
      words.push(char);
    } else if (/[a-zA-Z0-9]/.test(char)) {
      current += char;
    } else if (current.length > 0) {
      words.push(current.toLowerCase());
      current = '';
    }
  }

  if (current.length > 0) {
    words.push(current.toLowerCase());
  }

  return words;
}

/**
 * Check if a string is punctuation
 */
function isPunctuation(str: string): boolean {
  return /^[\s\p{P}]+$/u.test(str);
}

/**
 * Extract English keywords from a title
 */
export function extractEnglishKeywords(title: string): string[] {
  // Common English stop words
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his',
    'her', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
    'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why',
  ]);

  return (
    title
      .toLowerCase()
      // Split on non-alphanumeric characters
      .split(/[^a-z0-9]+/)
      // Filter stop words and short words
      .filter((word) => word.length > 2 && !stopWords.has(word))
  );
}

/**
 * Calculate scores for keywords based on their potential to form clusters
 * A good cluster keyword should:
 * - Appear in multiple documents (not unique to one doc)
 * - Not appear in all documents (some distinctiveness)
 * Returns map of keyword -> score
 */
export function calculateKeywordScores(
  noteKeywords: Map<string, string[]>
): Map<string, number> {
  // Count document frequency for each keyword
  const documentFrequency = new Map<string, number>();
  const totalDocs = noteKeywords.size;

  for (const keywords of noteKeywords.values()) {
    const uniqueKeywords = new Set(keywords);
    for (const keyword of uniqueKeywords) {
      documentFrequency.set(keyword, (documentFrequency.get(keyword) || 0) + 1);
    }
  }

  // Calculate scores favoring keywords that can form clusters
  const scores = new Map<string, number>();
  for (const [keyword, df] of documentFrequency) {
    // Skip keywords that only appear once (can't form a cluster)
    if (df < 2) {
      scores.set(keyword, 0);
      continue;
    }

    // Favor keywords that appear in moderate number of docs
    // Peak score at around 30-50% of docs
    const ratio = df / totalDocs;

    // Score formula: higher when keyword appears in 20-60% of docs
    // df^0.5 rewards keywords that appear multiple times
    // (1 - ratio) prevents keywords that are too common
    const score = Math.sqrt(df) * (1 - Math.abs(ratio - 0.4));

    scores.set(keyword, score);
  }

  return scores;
}

/**
 * Group notes by their most significant keyword
 */
function groupByTopKeyword(
  noteIds: string[],
  noteKeywords: Map<string, string[]>,
  keywordScores: Map<string, number>
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const noteId of noteIds) {
    const keywords = noteKeywords.get(noteId) || [];

    // Find the keyword with the highest score
    let topKeyword = '';
    let topScore = 0;

    for (const keyword of keywords) {
      const score = keywordScores.get(keyword) || 0;
      if (score > topScore) {
        topScore = score;
        topKeyword = keyword;
      }
    }

    if (topKeyword) {
      const group = groups.get(topKeyword) || [];
      group.push(noteId);
      groups.set(topKeyword, group);
    }
  }

  return groups;
}

/**
 * Format a keyword as a cluster name
 */
function formatKeywordAsName(keyword: string): string {
  return keyword.charAt(0).toUpperCase() + keyword.slice(1);
}
