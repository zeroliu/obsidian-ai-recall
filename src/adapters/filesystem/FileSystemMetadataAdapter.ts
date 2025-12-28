/**
 * File system implementation of IMetadataProvider
 *
 * Used by scripts to run the pipeline outside of Obsidian environment.
 * Parses metadata directly from markdown files.
 */

import { basename } from 'node:path';
import type {
  FileMetadata,
  HeadingInfo,
  IMetadataProvider,
  ResolvedLinks,
} from '@/ports/IMetadataProvider';
import { FileSystemVaultAdapter } from './FileSystemVaultAdapter';

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return {};

  const yamlContent = match[1];
  const frontmatter: Record<string, unknown> = {};
  const lines = yamlContent.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
      } else {
        frontmatter[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  return frontmatter;
}

/**
 * Extract tags from markdown content and frontmatter
 */
function extractTags(content: string, frontmatter: Record<string, unknown>): string[] {
  const tags = new Set<string>();

  // From frontmatter
  if (frontmatter.tags) {
    const fmTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags];
    for (const tag of fmTags) {
      const normalized = String(tag).startsWith('#') ? String(tag) : `#${String(tag)}`;
      tags.add(normalized);
    }
  }

  // Inline tags (excluding code blocks)
  const withoutCode = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');
  const inlineTagRegex = /(?<![`\w])#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
  for (const match of withoutCode.matchAll(inlineTagRegex)) {
    tags.add(`#${match[1]}`);
  }

  return Array.from(tags);
}

/**
 * Extract wiki-style links from markdown content
 */
function extractLinks(content: string): string[] {
  const links = new Set<string>();
  const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

  for (const match of content.matchAll(wikiLinkRegex)) {
    let link = match[1].trim();
    const hashIndex = link.indexOf('#');
    if (hashIndex > 0) {
      link = link.slice(0, hashIndex);
    } else if (hashIndex === 0) {
      continue;
    }
    if (link) {
      links.add(link);
    }
  }

  return Array.from(links);
}

/**
 * Extract headings from markdown content
 */
function extractHeadings(content: string): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        heading: match[2].trim(),
        level: match[1].length,
        line: i + 1,
      });
    }
  }

  return headings;
}

/**
 * Count words in content (excluding frontmatter and code blocks)
 */
function countWords(content: string): number {
  const withoutFrontmatter = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const withoutCode = withoutFrontmatter.replace(/```[\s\S]*?```/g, '');
  const words = withoutCode.split(/\s+/).filter((w) => w.length > 0);
  return words.length;
}

/**
 * File system implementation of IMetadataProvider
 */
export class FileSystemMetadataAdapter implements IMetadataProvider {
  private vaultAdapter: FileSystemVaultAdapter;

  // Lazy-loaded cache
  private metadataCache: Map<string, FileMetadata> | null = null;
  private resolvedLinksCache: ResolvedLinks | null = null;

  constructor(vaultPath: string) {
    this.vaultAdapter = new FileSystemVaultAdapter(vaultPath);
  }

  /**
   * Load and parse all vault metadata (lazy, called once on first access)
   */
  private async loadVaultMetadata(): Promise<void> {
    if (this.metadataCache !== null) return;

    this.metadataCache = new Map();
    const linksMap = new Map<string, string[]>();
    const allPaths: string[] = [];

    const files = await this.vaultAdapter.listMarkdownFiles();

    for (const fileInfo of files) {
      const content = await this.vaultAdapter.readFile(fileInfo.path);
      const frontmatter = parseFrontmatter(content);
      const tags = extractTags(content, frontmatter);
      const links = extractLinks(content);
      const headings = extractHeadings(content);
      const wordCount = countWords(content);

      this.metadataCache.set(fileInfo.path, {
        path: fileInfo.path,
        tags,
        links,
        headings,
        frontmatter,
        wordCount,
      });

      linksMap.set(fileInfo.path, links);
      allPaths.push(fileInfo.path);
    }

    // Build resolved links
    this.resolvedLinksCache = this.buildResolvedLinks(allPaths, linksMap);
  }

  /**
   * Build resolved links map from file paths and raw links
   */
  private buildResolvedLinks(files: string[], linksMap: Map<string, string[]>): ResolvedLinks {
    const resolvedLinks: ResolvedLinks = {};

    // Build basename to path map (prefer shorter paths for duplicates)
    const basenameToPath: Record<string, string> = {};
    for (const filePath of files) {
      const name = basename(filePath, '.md');
      if (!basenameToPath[name] || filePath.length < basenameToPath[name].length) {
        basenameToPath[name] = filePath;
      }
    }

    for (const filePath of files) {
      const links = linksMap.get(filePath) || [];
      if (links.length === 0) continue;

      const linkCounts: Record<string, number> = {};

      for (const link of links) {
        let resolved: string | null = null;
        if (files.includes(link) || files.includes(`${link}.md`)) {
          resolved = files.includes(link) ? link : `${link}.md`;
        } else {
          resolved = basenameToPath[link] || null;
        }

        if (resolved) {
          linkCounts[resolved] = (linkCounts[resolved] || 0) + 1;
        }
      }

      if (Object.keys(linkCounts).length > 0) {
        resolvedLinks[filePath] = linkCounts;
      }
    }

    return resolvedLinks;
  }

  async getFileMetadata(path: string): Promise<FileMetadata | null> {
    await this.loadVaultMetadata();
    return this.metadataCache?.get(path) ?? null;
  }

  async getResolvedLinks(): Promise<ResolvedLinks> {
    await this.loadVaultMetadata();
    return this.resolvedLinksCache ?? {};
  }

  async getBacklinks(path: string): Promise<string[]> {
    await this.loadVaultMetadata();
    const backlinks: string[] = [];

    if (this.resolvedLinksCache) {
      for (const [sourcePath, targets] of Object.entries(this.resolvedLinksCache)) {
        if (path in targets) {
          backlinks.push(sourcePath);
        }
      }
    }

    return backlinks;
  }

  async getAllTags(): Promise<string[]> {
    await this.loadVaultMetadata();
    const tagSet = new Set<string>();

    if (this.metadataCache) {
      for (const meta of this.metadataCache.values()) {
        for (const tag of meta.tags) {
          tagSet.add(tag);
        }
      }
    }

    return Array.from(tagSet).sort();
  }
}
