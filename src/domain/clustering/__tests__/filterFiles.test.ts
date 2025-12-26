import { createFileInfo } from '@/test/fixtures/types';
import { describe, expect, it } from 'vitest';
import { filterExcludedPaths, matchGlob } from '../filterFiles';
import { DEFAULT_CLUSTERING_CONFIG } from '../types';

describe('matchGlob', () => {
	it('should match exact file names', () => {
		expect(matchGlob('CLAUDE.md', 'CLAUDE.md')).toBe(true);
		expect(matchGlob('CLAUDE.md', 'README.md')).toBe(false);
	});

	it('should match with * wildcard (matches anything except /)', () => {
		expect(matchGlob('*.md', 'notes.md')).toBe(true);
		expect(matchGlob('*.md', 'folder/notes.md')).toBe(false);
		expect(matchGlob('journal/*.md', 'journal/2024-01-01.md')).toBe(true);
		expect(matchGlob('journal/*.md', 'journal/sub/note.md')).toBe(false);
	});

	it('should match with ** wildcard (matches anything including /)', () => {
		expect(matchGlob('journal/**', 'journal/2024-01-01.md')).toBe(true);
		expect(matchGlob('journal/**', 'journal/2024/01/01.md')).toBe(true);
		expect(matchGlob('**/*.md', 'folder/notes.md')).toBe(true);
		expect(matchGlob('**/*.md', 'deep/nested/folder/notes.md')).toBe(true);
	});

	it('should match with ? wildcard (single character)', () => {
		expect(matchGlob('note?.md', 'note1.md')).toBe(true);
		expect(matchGlob('note?.md', 'note12.md')).toBe(false);
	});

	it('should handle patterns without wildcards as prefix match', () => {
		expect(matchGlob('journal/', 'journal/note.md')).toBe(true);
		expect(matchGlob('journal/', 'other/note.md')).toBe(false);
	});

	it('should handle complex patterns', () => {
		expect(matchGlob('**/journal/**/*.md', 'projects/journal/2024/note.md')).toBe(true);
		expect(matchGlob('src/**/*.test.ts', 'src/domain/clustering/test.test.ts')).toBe(true);
	});
});

describe('filterExcludedPaths', () => {
	const files = [
		createFileInfo('notes/work.md'),
		createFileInfo('journal/2024-01-01.md'),
		createFileInfo('journal/2024-01-02.md'),
		createFileInfo('CLAUDE.md'),
		createFileInfo('projects/idea.md'),
		createFileInfo('projects/journal/log.md'),
	];

	it('should return all files when excludePaths is empty', () => {
		const config = { ...DEFAULT_CLUSTERING_CONFIG, excludePaths: [] };
		const result = filterExcludedPaths(files, config);
		expect(result).toHaveLength(files.length);
	});

	it('should exclude files matching exact name', () => {
		const config = { ...DEFAULT_CLUSTERING_CONFIG, excludePaths: ['CLAUDE.md'] };
		const result = filterExcludedPaths(files, config);
		expect(result).toHaveLength(files.length - 1);
		expect(result.find((f) => f.path === 'CLAUDE.md')).toBeUndefined();
	});

	it('should exclude files matching folder pattern', () => {
		const config = { ...DEFAULT_CLUSTERING_CONFIG, excludePaths: ['journal/**'] };
		const result = filterExcludedPaths(files, config);
		expect(result).toHaveLength(4);
		expect(result.every((f) => !f.path.startsWith('journal/'))).toBe(true);
	});

	it('should exclude files matching multiple patterns', () => {
		const config = {
			...DEFAULT_CLUSTERING_CONFIG,
			excludePaths: ['journal/**', 'CLAUDE.md'],
		};
		const result = filterExcludedPaths(files, config);
		expect(result).toHaveLength(3);
		expect(result.map((f) => f.path).sort()).toEqual([
			'notes/work.md',
			'projects/idea.md',
			'projects/journal/log.md',
		]);
	});

	it('should handle nested journal folder pattern', () => {
		const config = { ...DEFAULT_CLUSTERING_CONFIG, excludePaths: ['**/journal/**'] };
		const result = filterExcludedPaths(files, config);
		// Should exclude both journal/* and projects/journal/*
		expect(result).toHaveLength(3);
		expect(result.every((f) => !f.path.includes('journal/'))).toBe(true);
	});

	it('should handle empty files array', () => {
		const config = { ...DEFAULT_CLUSTERING_CONFIG, excludePaths: ['**'] };
		const result = filterExcludedPaths([], config);
		expect(result).toHaveLength(0);
	});
});
