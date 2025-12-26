#!/usr/bin/env npx ts-node
/**
 * Export a vault directory to a fixture JSON file for testing.
 *
 * Usage:
 *   npx ts-node scripts/export-vault-fixture.ts <vault-path> [output-file]
 *
 * Example:
 *   npx ts-node scripts/export-vault-fixture.ts ~/Documents/MyVault ./fixtures/my-vault.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

interface FileInfo {
  path: string;
  basename: string;
  folder: string;
  modifiedAt: number;
  createdAt: number;
}

interface HeadingInfo {
  heading: string;
  level: number;
  line: number;
}

interface FileMetadata {
  path: string;
  tags: string[];
  links: string[];
  headings: HeadingInfo[];
  frontmatter: Record<string, unknown>;
  wordCount: number;
}

type ResolvedLinks = Record<string, Record<string, number>>;

interface VaultFixtureData {
  files: FileInfo[];
  contents: Record<string, string>;
}

interface MetadataFixtureData {
  metadata: Record<string, Omit<FileMetadata, 'path'>>;
  resolvedLinks: ResolvedLinks;
}

interface VaultFixture {
  vault: VaultFixtureData;
  metadata: MetadataFixtureData;
}

/**
 * Recursively find all markdown files in a directory
 */
function findMarkdownFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip hidden directories and common non-content folders
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // Get relative path from base directory
      const relativePath = path.relative(baseDir, fullPath);
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  bodyStart: number;
} {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, bodyStart: 0 };
  }

  const yamlContent = match[1];
  const frontmatter: Record<string, unknown> = {};

  // Simple YAML parser for common cases
  const lines = yamlContent.split('\n');
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check for list item
    if (trimmed.startsWith('- ') && currentKey && currentList) {
      currentList.push(trimmed.slice(2).trim());
      continue;
    }

    // Check for key: value pair
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      // Save previous list if any
      if (currentKey && currentList) {
        frontmatter[currentKey] = currentList;
      }

      currentKey = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      if (value === '' || value === '[]') {
        // Start of a list or empty value
        currentList = [];
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array
        const items = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
        frontmatter[currentKey] = items;
        currentKey = null;
        currentList = null;
      } else {
        // Simple value
        let parsedValue: unknown = value.replace(/^["']|["']$/g, '');
        // Try to parse as number or boolean
        if (parsedValue === 'true') parsedValue = true;
        else if (parsedValue === 'false') parsedValue = false;
        else if (/^\d+$/.test(parsedValue as string))
          parsedValue = Number.parseInt(parsedValue as string, 10);
        else if (/^\d+\.\d+$/.test(parsedValue as string))
          parsedValue = Number.parseFloat(parsedValue as string);

        frontmatter[currentKey] = parsedValue;
        currentKey = null;
        currentList = null;
      }
    }
  }

  // Save last list if any
  if (currentKey && currentList) {
    frontmatter[currentKey] = currentList;
  }

  return { frontmatter, bodyStart: match[0].length };
}

/**
 * Extract tags from markdown content (both inline and frontmatter)
 */
function extractTags(
  content: string,
  frontmatter: Record<string, unknown>
): string[] {
  const tags = new Set<string>();

  // Extract from frontmatter
  if (frontmatter.tags) {
    const fmTags = Array.isArray(frontmatter.tags)
      ? frontmatter.tags
      : [frontmatter.tags];
    for (const tag of fmTags) {
      const normalized = String(tag).startsWith('#')
        ? String(tag)
        : `#${String(tag)}`;
      tags.add(normalized);
    }
  }

  // Extract inline tags (not in code blocks or links)
  // Match #tag but not inside [[]] or `` or ```
  const inlineTagRegex = /(?<![`\w])#([a-zA-Z][a-zA-Z0-9_/-]*)/g;

  // Remove code blocks and inline code first
  const withoutCode = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '');

  let match: RegExpExecArray | null;
  while ((match = inlineTagRegex.exec(withoutCode)) !== null) {
    tags.add(`#${match[1]}`);
  }

  return Array.from(tags).sort();
}

/**
 * Extract wiki-style links from markdown content
 */
function extractLinks(content: string): string[] {
  const links = new Set<string>();

  // Match [[link]] or [[link|display]]
  const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

  let match: RegExpExecArray | null;
  while ((match = wikiLinkRegex.exec(content)) !== null) {
    let link = match[1].trim();
    // Remove heading/block references
    const hashIndex = link.indexOf('#');
    if (hashIndex > 0) {
      link = link.slice(0, hashIndex);
    } else if (hashIndex === 0) {
      // Link to heading in same file, skip
      continue;
    }
    if (link) {
      links.add(link);
    }
  }

  return Array.from(links).sort();
}

/**
 * Extract headings from markdown content
 */
function extractHeadings(content: string): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  const lines = content.split('\n');

  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track code blocks
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    // Match ATX-style headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      headings.push({
        heading: headingMatch[2].trim(),
        level: headingMatch[1].length,
        line: i + 1, // 1-indexed
      });
    }
  }

  return headings;
}

/**
 * Count words in content (excluding code blocks and frontmatter)
 */
function countWords(content: string, bodyStart: number): number {
  const body = content.slice(bodyStart);

  // Remove code blocks
  const withoutCode = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');

  // Count words (simple split on whitespace)
  const words = withoutCode
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^[#\-*>|]$/.test(w));

  return words.length;
}

/**
 * Build resolved links map from all file metadata
 */
function buildResolvedLinks(
  files: string[],
  metadataMap: Record<string, FileMetadata>
): ResolvedLinks {
  const resolvedLinks: ResolvedLinks = {};

  // Build a map of basename -> full path for link resolution
  const basenameToPath: Record<string, string> = {};
  for (const filePath of files) {
    const basename = path.basename(filePath, '.md');
    // If multiple files have the same basename, prefer shorter paths
    if (
      !basenameToPath[basename] ||
      filePath.length < basenameToPath[basename].length
    ) {
      basenameToPath[basename] = filePath;
    }
  }

  for (const filePath of files) {
    const metadata = metadataMap[filePath];
    if (!metadata || metadata.links.length === 0) continue;

    const linkCounts: Record<string, number> = {};

    for (const link of metadata.links) {
      // Try to resolve the link
      let resolvedPath: string | null = null;

      // Check if it's already a full path
      if (files.includes(link) || files.includes(`${link}.md`)) {
        resolvedPath = files.includes(link) ? link : `${link}.md`;
      } else {
        // Try basename resolution
        resolvedPath = basenameToPath[link] || null;
      }

      if (resolvedPath) {
        linkCounts[resolvedPath] = (linkCounts[resolvedPath] || 0) + 1;
      }
    }

    if (Object.keys(linkCounts).length > 0) {
      resolvedLinks[filePath] = linkCounts;
    }
  }

  return resolvedLinks;
}

/**
 * Main export function
 */
function exportVaultFixture(vaultPath: string): VaultFixture {
  const absoluteVaultPath = path.resolve(vaultPath);

  if (!fs.existsSync(absoluteVaultPath)) {
    throw new Error(`Vault path does not exist: ${absoluteVaultPath}`);
  }

  console.error(`Scanning vault at: ${absoluteVaultPath}`);

  // Find all markdown files
  const files = findMarkdownFiles(absoluteVaultPath);
  console.error(`Found ${files.length} markdown files`);

  // Build file info and metadata
  const fileInfos: FileInfo[] = [];
  const contents: Record<string, string> = {};
  const metadataMap: Record<string, FileMetadata> = {};

  for (const relativePath of files) {
    const fullPath = path.join(absoluteVaultPath, relativePath);
    const stats = fs.statSync(fullPath);
    const content = fs.readFileSync(fullPath, 'utf-8');

    // File info
    const basename = path.basename(relativePath, '.md');
    const folder = path.dirname(relativePath);

    fileInfos.push({
      path: relativePath,
      basename,
      folder: folder === '.' ? '' : folder,
      modifiedAt: stats.mtimeMs,
      createdAt: stats.birthtimeMs,
    });

    // Store content
    contents[relativePath] = content;

    // Parse metadata
    const { frontmatter, bodyStart } = parseFrontmatter(content);
    const tags = extractTags(content, frontmatter);
    const links = extractLinks(content);
    const headings = extractHeadings(content);
    const wordCount = countWords(content, bodyStart);

    metadataMap[relativePath] = {
      path: relativePath,
      tags,
      links,
      headings,
      frontmatter,
      wordCount,
    };
  }

  // Build resolved links
  const resolvedLinks = buildResolvedLinks(files, metadataMap);

  // Build fixture
  const fixture: VaultFixture = {
    vault: {
      files: fileInfos.sort((a, b) => a.path.localeCompare(b.path)),
      contents,
    },
    metadata: {
      metadata: Object.fromEntries(
        Object.entries(metadataMap).map(([path, meta]) => [
          path,
          {
            tags: meta.tags,
            links: meta.links,
            headings: meta.headings,
            frontmatter: meta.frontmatter,
            wordCount: meta.wordCount,
          },
        ])
      ),
      resolvedLinks,
    },
  };

  return fixture;
}

// CLI entry point
function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: npx ts-node scripts/export-vault-fixture.ts <vault-path> [output-file]');
    console.error('');
    console.error('Example:');
    console.error('  npx ts-node scripts/export-vault-fixture.ts ~/Documents/MyVault ./my-vault.json');
    process.exit(1);
  }

  const vaultPath = args[0];
  const outputFile = args[1];

  try {
    const fixture = exportVaultFixture(vaultPath);

    const json = JSON.stringify(fixture, null, 2);

    if (outputFile) {
      fs.writeFileSync(outputFile, json, 'utf-8');
      console.error(`Fixture written to: ${outputFile}`);
      console.error(`  Files: ${fixture.vault.files.length}`);
      console.error(`  Total size: ${(json.length / 1024).toFixed(1)} KB`);
    } else {
      // Write to stdout
      console.log(json);
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

main();
