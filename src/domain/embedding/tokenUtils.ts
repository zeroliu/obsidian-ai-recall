/**
 * CJK character pattern for Chinese, Japanese, and Korean detection
 * - \u4e00-\u9fff: CJK Unified Ideographs
 * - \u3400-\u4dbf: CJK Unified Ideographs Extension A
 * - \uac00-\ud7af: Hangul Syllables (Korean)
 * - \u3040-\u309f: Hiragana (Japanese)
 * - \u30a0-\u30ff: Katakana (Japanese)
 */
const CJK_PATTERN = /[\u4e00-\u9fff\u3400-\u4dbf\uac00-\ud7af\u3040-\u309f\u30a0-\u30ff]/g;

/**
 * Estimate the number of tokens in a text
 *
 * Uses a simple approximation based on character counts:
 * - English/Latin text: ~4 characters per token (cl100k_base average)
 * - CJK text: ~1.5 characters per token (each CJK char is ~0.67 tokens)
 *
 * This is an approximation and may differ from actual tokenizer output,
 * but is sufficient for batching and cost estimation purposes.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
	if (!text) return 0;

	// Count CJK characters
	const cjkMatches = text.match(CJK_PATTERN);
	const cjkCount = cjkMatches?.length ?? 0;

	// Non-CJK text: roughly 4 chars per token
	// CJK text: roughly 1.5 chars per token
	const nonCjkLength = text.length - cjkCount;
	const nonCjkTokens = Math.ceil(nonCjkLength / 4);
	const cjkTokens = Math.ceil(cjkCount / 1.5);

	return nonCjkTokens + cjkTokens;
}
