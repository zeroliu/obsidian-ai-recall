import type { FileInfo } from '@/ports/IVaultProvider';
import { createFileInfo } from '@/test/fixtures/types';
import { describe, expect, it } from 'vitest';
import { clusterByFolder, getFoldersByDepth, isSubfolderOf } from '../clusterByFolder';
import { DEFAULT_CLUSTERING_CONFIG } from '../types';

describe('clusterByFolder', () => {
	const config = DEFAULT_CLUSTERING_CONFIG;

	describe('basic clustering', () => {
		it('should group files by folder', () => {
			const files: FileInfo[] = [
				createFileInfo('react/React Basics.md'),
				createFileInfo('react/React Hooks.md'),
				createFileInfo('golf/Golf Swing.md'),
				createFileInfo('golf/Putting.md'),
			];

			const clusters = clusterByFolder(files, config);

			expect(clusters).toHaveLength(2);

			const reactCluster = clusters.find((c) => c.folderPath === 'react');
			expect(reactCluster?.noteIds).toHaveLength(2);
			expect(reactCluster?.noteIds).toContain('react/React Basics.md');

			const golfCluster = clusters.find((c) => c.folderPath === 'golf');
			expect(golfCluster?.noteIds).toHaveLength(2);
			expect(golfCluster?.noteIds).toContain('golf/Golf Swing.md');
		});

		it('should handle root-level files', () => {
			const files: FileInfo[] = [
				createFileInfo('Root Note.md'),
				createFileInfo('Another Root.md'),
				createFileInfo('folder/Nested.md'),
			];

			const clusters = clusterByFolder(files, config);

			expect(clusters).toHaveLength(2);

			const rootCluster = clusters.find((c) => c.folderPath === '');
			expect(rootCluster?.noteIds).toHaveLength(2);
			expect(rootCluster?.noteIds).toContain('Root Note.md');
		});

		it('should handle nested folders', () => {
			const files: FileInfo[] = [
				createFileInfo('a/Note1.md'),
				createFileInfo('a/b/Note2.md'),
				createFileInfo('a/b/c/Note3.md'),
			];

			const clusters = clusterByFolder(files, config);

			expect(clusters).toHaveLength(3);
			expect(clusters.map((c) => c.folderPath).sort()).toEqual(['a', 'a/b', 'a/b/c']);
		});

		it('should handle empty input', () => {
			const clusters = clusterByFolder([], config);
			expect(clusters).toHaveLength(0);
		});

		it('should handle single file', () => {
			const files: FileInfo[] = [createFileInfo('only/One.md')];

			const clusters = clusterByFolder(files, config);

			expect(clusters).toHaveLength(1);
			expect(clusters[0].noteIds).toHaveLength(1);
		});
	});

	describe('candidate names', () => {
		it('should generate candidate names from folder path', () => {
			const files: FileInfo[] = [createFileInfo('my-notes/Note.md')];

			const clusters = clusterByFolder(files, config);

			expect(clusters[0].candidateNames).toContain('My Notes');
		});

		it('should generate candidate names for nested folders', () => {
			const files: FileInfo[] = [createFileInfo('work/projects/Note.md')];

			const clusters = clusterByFolder(files, config);

			const names = clusters[0].candidateNames;
			expect(names).toContain('Projects');
			expect(names.some((n) => n.includes('Work'))).toBe(true);
		});

		it('should handle root folder', () => {
			const files: FileInfo[] = [createFileInfo('Note.md')];

			const clusters = clusterByFolder(files, config);

			const names = clusters[0].candidateNames;
			expect(names).toContain('Root');
		});

		it('should handle underscores and dashes', () => {
			const files: FileInfo[] = [createFileInfo('my_folder-name/Note.md')];

			const clusters = clusterByFolder(files, config);

			expect(clusters[0].candidateNames).toContain('My Folder Name');
		});
	});

	describe('cluster properties', () => {
		it('should set correct folderPath', () => {
			const files: FileInfo[] = [createFileInfo('path/to/folder/Note.md')];

			const clusters = clusterByFolder(files, config);

			expect(clusters[0].folderPath).toBe('path/to/folder');
		});

		it('should initialize with zero link density', () => {
			const files: FileInfo[] = [createFileInfo('folder/Note.md')];

			const clusters = clusterByFolder(files, config);

			expect(clusters[0].internalLinkDensity).toBe(0);
		});

		it('should have unique cluster IDs', () => {
			const files: FileInfo[] = [
				createFileInfo('a/Note.md'),
				createFileInfo('b/Note.md'),
				createFileInfo('c/Note.md'),
			];

			const clusters = clusterByFolder(files, config);
			const ids = clusters.map((c) => c.id);
			const uniqueIds = new Set(ids);

			expect(uniqueIds.size).toBe(ids.length);
		});
	});
});

describe('getFoldersByDepth', () => {
	it('should return folders sorted by depth (deepest first)', () => {
		const files: FileInfo[] = [
			createFileInfo('a/Note.md'),
			createFileInfo('a/b/Note.md'),
			createFileInfo('a/b/c/Note.md'),
			createFileInfo('x/Note.md'),
		];

		const folders = getFoldersByDepth(files);

		expect(folders[0]).toBe('a/b/c');
		expect(folders[folders.length - 1].split('/').length).toBeLessThanOrEqual(
			folders[0].split('/').length,
		);
	});

	it('should handle empty input', () => {
		const folders = getFoldersByDepth([]);
		expect(folders).toHaveLength(0);
	});

	it('should not include root files', () => {
		const files: FileInfo[] = [createFileInfo('Root.md'), createFileInfo('folder/Nested.md')];

		const folders = getFoldersByDepth(files);

		expect(folders).toEqual(['folder']);
	});
});

describe('isSubfolderOf', () => {
	it('should return true for direct subfolder', () => {
		expect(isSubfolderOf('a/b', 'a')).toBe(true);
	});

	it('should return true for deeply nested subfolder', () => {
		expect(isSubfolderOf('a/b/c/d', 'a')).toBe(true);
		expect(isSubfolderOf('a/b/c/d', 'a/b')).toBe(true);
	});

	it('should return false for non-subfolder', () => {
		expect(isSubfolderOf('a', 'b')).toBe(false);
		expect(isSubfolderOf('abc', 'ab')).toBe(false);
	});

	it('should return false for same folder', () => {
		expect(isSubfolderOf('a', 'a')).toBe(false);
	});

	it('should handle root parent', () => {
		expect(isSubfolderOf('a', '')).toBe(true);
		expect(isSubfolderOf('a', '/')).toBe(true);
		expect(isSubfolderOf('', '/')).toBe(false);
	});
});
