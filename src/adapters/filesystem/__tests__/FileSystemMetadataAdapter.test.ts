import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSystemMetadataAdapter } from '../FileSystemMetadataAdapter';

describe('FileSystemMetadataAdapter', () => {
  let adapter: FileSystemMetadataAdapter;
  let testVaultDir: string;

  beforeEach(() => {
    testVaultDir = join(
      tmpdir(),
      `metadata-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testVaultDir, { recursive: true });
    adapter = new FileSystemMetadataAdapter(testVaultDir);
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

  describe('getFileMetadata', () => {
    it('should extract frontmatter tags', async () => {
      createFile(
        'note.md',
        `---
tags: [javascript, typescript]
---
# Note`,
      );

      const metadata = await adapter.getFileMetadata('note.md');
      expect(metadata?.tags).toContain('#javascript');
      expect(metadata?.tags).toContain('#typescript');
    });

    it('should extract inline tags', async () => {
      createFile('note.md', '# Note\n\nThis has #inline and #tags in it.');

      const metadata = await adapter.getFileMetadata('note.md');
      expect(metadata?.tags).toContain('#inline');
      expect(metadata?.tags).toContain('#tags');
    });

    it('should not extract tags from code blocks', async () => {
      createFile(
        'note.md',
        `# Note

\`\`\`javascript
const tag = '#not-a-tag';
\`\`\`

But #this-is a tag.`,
      );

      const metadata = await adapter.getFileMetadata('note.md');
      expect(metadata?.tags).not.toContain('#not-a-tag');
      expect(metadata?.tags).toContain('#this-is');
    });

    it('should extract wiki links', async () => {
      createFile('note.md', '# Note\n\nLink to [[Other Note]] and [[Folder/Another]].');

      const metadata = await adapter.getFileMetadata('note.md');
      expect(metadata?.links).toContain('Other Note');
      expect(metadata?.links).toContain('Folder/Another');
    });

    it('should extract wiki links with aliases', async () => {
      createFile('note.md', '# Note\n\nLink to [[Target|Display Text]].');

      const metadata = await adapter.getFileMetadata('note.md');
      expect(metadata?.links).toContain('Target');
    });

    it('should strip heading anchors from links', async () => {
      createFile('note.md', '# Note\n\nLink to [[Other Note#Heading]].');

      const metadata = await adapter.getFileMetadata('note.md');
      expect(metadata?.links).toContain('Other Note');
      expect(metadata?.links).not.toContain('Other Note#Heading');
    });

    it('should extract headings', async () => {
      createFile(
        'note.md',
        `# Title
## Section 1
### Subsection
## Section 2`,
      );

      const metadata = await adapter.getFileMetadata('note.md');
      expect(metadata?.headings).toHaveLength(4);
      expect(metadata?.headings[0]).toEqual({ heading: 'Title', level: 1, line: 1 });
      expect(metadata?.headings[1]).toEqual({ heading: 'Section 1', level: 2, line: 2 });
      expect(metadata?.headings[2]).toEqual({ heading: 'Subsection', level: 3, line: 3 });
      expect(metadata?.headings[3]).toEqual({ heading: 'Section 2', level: 2, line: 4 });
    });

    it('should extract frontmatter', async () => {
      createFile(
        'note.md',
        `---
title: My Note
author: John
count: 42
---
# Content`,
      );

      const metadata = await adapter.getFileMetadata('note.md');
      expect(metadata?.frontmatter.title).toBe('My Note');
      expect(metadata?.frontmatter.author).toBe('John');
      expect(metadata?.frontmatter.count).toBe('42');
    });

    it('should count words excluding frontmatter and code', async () => {
      createFile(
        'note.md',
        `---
title: Test
---
# Title

This is a sentence with seven words here.

\`\`\`
code not counted
\`\`\``,
      );

      const metadata = await adapter.getFileMetadata('note.md');
      // "# Title This is a sentence with seven words here." = 10 words
      expect(metadata?.wordCount).toBeGreaterThan(5);
      expect(metadata?.wordCount).toBeLessThan(20);
    });

    it('should return null for non-existent file', async () => {
      const metadata = await adapter.getFileMetadata('non-existent.md');
      expect(metadata).toBeNull();
    });

    it('should include path in metadata', async () => {
      createFile('folder/note.md', '# Note');

      const metadata = await adapter.getFileMetadata('folder/note.md');
      expect(metadata?.path).toBe('folder/note.md');
    });
  });

  describe('getResolvedLinks', () => {
    it('should resolve links between files', async () => {
      createFile('source.md', '# Source\n\nLink to [[target]].');
      createFile('target.md', '# Target');

      const links = await adapter.getResolvedLinks();
      expect(links['source.md']).toBeDefined();
      expect(links['source.md']['target.md']).toBe(1);
    });

    it('should deduplicate links to same target', async () => {
      createFile('source.md', '# Source\n\n[[target]] and [[target]] again.');
      createFile('target.md', '# Target');

      const links = await adapter.getResolvedLinks();
      // Links are deduplicated (extracted as a Set), so count is 1
      expect(links['source.md']['target.md']).toBe(1);
    });

    it('should resolve links by basename', async () => {
      createFile('source.md', '# Source\n\nLink to [[nested]].');
      createFile('folder/nested.md', '# Nested');

      const links = await adapter.getResolvedLinks();
      expect(links['source.md']['folder/nested.md']).toBe(1);
    });

    it('should return empty object when no links', async () => {
      createFile('lonely.md', '# No Links');

      const links = await adapter.getResolvedLinks();
      expect(links['lonely.md']).toBeUndefined();
    });
  });

  describe('getBacklinks', () => {
    it('should find files that link to target', async () => {
      createFile('source1.md', '# Source 1\n\n[[target]]');
      createFile('source2.md', '# Source 2\n\n[[target]]');
      createFile('target.md', '# Target');

      const backlinks = await adapter.getBacklinks('target.md');
      expect(backlinks).toHaveLength(2);
      expect(backlinks).toContain('source1.md');
      expect(backlinks).toContain('source2.md');
    });

    it('should return empty array when no backlinks', async () => {
      createFile('lonely.md', '# No backlinks');

      const backlinks = await adapter.getBacklinks('lonely.md');
      expect(backlinks).toHaveLength(0);
    });
  });

  describe('getAllTags', () => {
    it('should return all unique tags from vault', async () => {
      createFile('note1.md', '# Note 1\n\n#tag1 #shared');
      createFile('note2.md', '# Note 2\n\n#tag2 #shared');

      const tags = await adapter.getAllTags();
      expect(tags).toContain('#tag1');
      expect(tags).toContain('#tag2');
      expect(tags).toContain('#shared');
      expect(tags).toHaveLength(3);
    });

    it('should return sorted tags', async () => {
      createFile('note.md', '# Note\n\n#zebra #apple #mango');

      const tags = await adapter.getAllTags();
      expect(tags).toEqual(['#apple', '#mango', '#zebra']);
    });

    it('should return empty array when no tags', async () => {
      createFile('note.md', '# Note without tags');

      const tags = await adapter.getAllTags();
      expect(tags).toHaveLength(0);
    });
  });

  describe('caching', () => {
    it('should cache metadata after first load', async () => {
      createFile('note.md', '# Note\n\n#tag1');

      // First call loads metadata
      const metadata1 = await adapter.getFileMetadata('note.md');

      // Modify file (cache should still return old value)
      createFile('note.md', '# Modified\n\n#tag2');

      // Second call should return cached value
      const metadata2 = await adapter.getFileMetadata('note.md');

      expect(metadata1?.tags).toEqual(metadata2?.tags);
      expect(metadata2?.tags).toContain('#tag1');
    });
  });
});
