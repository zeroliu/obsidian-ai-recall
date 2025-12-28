import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSystemVaultAdapter } from '../FileSystemVaultAdapter';

describe('FileSystemVaultAdapter', () => {
  let adapter: FileSystemVaultAdapter;
  let testVaultDir: string;

  beforeEach(() => {
    testVaultDir = join(
      tmpdir(),
      `vault-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testVaultDir, { recursive: true });
    adapter = new FileSystemVaultAdapter(testVaultDir);
  });

  afterEach(() => {
    if (existsSync(testVaultDir)) {
      rmSync(testVaultDir, { recursive: true, force: true });
    }
  });

  function createFile(relativePath: string, content: string): void {
    const fullPath = join(testVaultDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(fullPath, content);
  }

  describe('listMarkdownFiles', () => {
    it('should list all markdown files', async () => {
      createFile('note1.md', '# Note 1');
      createFile('note2.md', '# Note 2');

      const files = await adapter.listMarkdownFiles();
      expect(files).toHaveLength(2);
      expect(files.map((f) => f.path)).toContain('note1.md');
      expect(files.map((f) => f.path)).toContain('note2.md');
    });

    it('should include files in subdirectories', async () => {
      createFile('root.md', '# Root');
      createFile('folder/nested.md', '# Nested');
      createFile('folder/deep/deeper.md', '# Deeper');

      const files = await adapter.listMarkdownFiles();
      expect(files).toHaveLength(3);
      expect(files.map((f) => f.path)).toContain('root.md');
      expect(files.map((f) => f.path)).toContain('folder/nested.md');
      expect(files.map((f) => f.path)).toContain('folder/deep/deeper.md');
    });

    it('should ignore hidden directories', async () => {
      createFile('visible.md', '# Visible');
      createFile('.hidden/secret.md', '# Secret');

      const files = await adapter.listMarkdownFiles();
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('visible.md');
    });

    it('should ignore non-markdown files', async () => {
      createFile('note.md', '# Note');
      createFile('image.png', 'binary');
      createFile('data.json', '{}');

      const files = await adapter.listMarkdownFiles();
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('note.md');
    });

    it('should return FileInfo with correct properties', async () => {
      createFile('folder/note.md', '# Note');

      const files = await adapter.listMarkdownFiles();
      expect(files).toHaveLength(1);

      const file = files[0];
      expect(file.path).toBe('folder/note.md');
      expect(file.basename).toBe('note');
      expect(file.folder).toBe('folder');
      expect(file.modifiedAt).toBeGreaterThan(0);
      expect(file.createdAt).toBeGreaterThan(0);
    });

    it('should return empty folder for root files', async () => {
      createFile('root.md', '# Root');

      const files = await adapter.listMarkdownFiles();
      expect(files[0].folder).toBe('');
    });

    it('should return empty array for empty vault', async () => {
      const files = await adapter.listMarkdownFiles();
      expect(files).toHaveLength(0);
    });
  });

  describe('readFile', () => {
    it('should read file content', async () => {
      createFile('note.md', '# Hello World\n\nThis is content.');

      const content = await adapter.readFile('note.md');
      expect(content).toBe('# Hello World\n\nThis is content.');
    });

    it('should read file in subdirectory', async () => {
      createFile('folder/note.md', 'Nested content');

      const content = await adapter.readFile('folder/note.md');
      expect(content).toBe('Nested content');
    });

    it('should throw for non-existent file', async () => {
      await expect(adapter.readFile('non-existent.md')).rejects.toThrow('File not found');
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      createFile('note.md', '# Note');

      const exists = await adapter.exists('note.md');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const exists = await adapter.exists('non-existent.md');
      expect(exists).toBe(false);
    });
  });

  describe('getBasename', () => {
    it('should return filename without extension', () => {
      expect(adapter.getBasename('note.md')).toBe('note');
      expect(adapter.getBasename('folder/note.md')).toBe('note');
      expect(adapter.getBasename('folder/deep/note.md')).toBe('note');
    });

    it('should handle files with multiple dots', () => {
      expect(adapter.getBasename('my.note.md')).toBe('my.note');
    });
  });

  describe('getFolder', () => {
    it('should return folder path', () => {
      expect(adapter.getFolder('folder/note.md')).toBe('folder');
      expect(adapter.getFolder('folder/deep/note.md')).toBe('folder/deep');
    });

    it('should return empty string for root files', () => {
      expect(adapter.getFolder('note.md')).toBe('');
    });
  });
});
