import type { FileInfo } from '@/ports/IVaultProvider';
import type { ClusteringConfig } from './types';

/**
 * Filters out files that match any of the exclude path patterns
 *
 * @param files - Array of files to filter
 * @param config - Clustering configuration with excludePaths
 * @returns Filtered array of files
 */
export function filterExcludedPaths(files: FileInfo[], config: ClusteringConfig): FileInfo[] {
	if (config.excludePaths.length === 0) {
		return files;
	}

	return files.filter((file) => {
		for (const pattern of config.excludePaths) {
			if (matchGlob(pattern, file.path)) {
				return false;
			}
		}
		return true;
	});
}

/**
 * Simple glob pattern matching
 * Supports:
 * - * matches any characters except /
 * - ** matches any characters including /
 * - ? matches single character
 *
 * @param pattern - Glob pattern
 * @param path - File path to match
 * @returns True if path matches pattern
 */
export function matchGlob(pattern: string, path: string): boolean {
	// Handle trailing slash as prefix match (e.g., "journal/" matches "journal/note.md")
	if (pattern.endsWith('/')) {
		return path.startsWith(pattern) || path === pattern.slice(0, -1);
	}

	// Step 1: Handle glob patterns BEFORE escaping regex chars
	let regexStr = pattern
		// Replace **/ at start with placeholder
		.replace(/^\*\*\//, '\x00STARGLOB\x00')
		// Replace /**/ in middle with placeholder
		.replace(/\/\*\*\//g, '\x00MIDGLOB\x00')
		// Replace /** at end with placeholder
		.replace(/\/\*\*$/, '\x00ENDGLOB\x00')
		// Replace remaining ** with placeholder
		.replace(/\*\*/g, '\x00ANYGLOB\x00')
		// Replace single * with placeholder
		.replace(/\*/g, '\x00STAR\x00')
		// Replace ? with placeholder
		.replace(/\?/g, '\x00QUESTION\x00');

	// Step 2: Escape regex special chars
	regexStr = regexStr.replace(/[.+^${}()|[\]\\]/g, '\\$&');

	// Step 3: Replace placeholders with regex patterns
	// Using null byte (\x00) as placeholder delimiter since it can't appear in file paths
	// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional use of null byte as delimiter
	const STARGLOB_RE = /\x00STARGLOB\x00/g;
	// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional use of null byte as delimiter
	const MIDGLOB_RE = /\x00MIDGLOB\x00/g;
	// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional use of null byte as delimiter
	const ENDGLOB_RE = /\x00ENDGLOB\x00/g;
	// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional use of null byte as delimiter
	const ANYGLOB_RE = /\x00ANYGLOB\x00/g;
	// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional use of null byte as delimiter
	const STAR_RE = /\x00STAR\x00/g;
	// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional use of null byte as delimiter
	const QUESTION_RE = /\x00QUESTION\x00/g;

	regexStr = regexStr
		.replace(STARGLOB_RE, '(?:.*\\/)?')
		.replace(MIDGLOB_RE, '\\/(?:.*\\/)?')
		.replace(ENDGLOB_RE, '(?:\\/.*)?')
		.replace(ANYGLOB_RE, '.*')
		.replace(STAR_RE, '[^/]*')
		.replace(QUESTION_RE, '[^/]');

	const regex = new RegExp(`^${regexStr}$`);
	return regex.test(path);
}
