import type { App, CachedMetadata } from 'obsidian';
import type {
	FileMetadata,
	HeadingInfo,
	IMetadataProvider,
	ResolvedLinks,
} from '@/ports/IMetadataProvider';

/**
 * Real Obsidian implementation of IMetadataProvider
 * Uses Obsidian's App.metadataCache API
 */
export class ObsidianMetadataAdapter implements IMetadataProvider {
	constructor(private app: App) {}

	async getFileMetadata(path: string): Promise<FileMetadata | null> {
		const cache = this.app.metadataCache.getCache(path);
		if (!cache) {
			return null;
		}
		return this.toFileMetadata(path, cache);
	}

	async getResolvedLinks(): Promise<ResolvedLinks> {
		// Obsidian's resolvedLinks is already in the correct format:
		// Record<string, Record<string, number>>
		return this.app.metadataCache.resolvedLinks;
	}

	async getBacklinks(path: string): Promise<string[]> {
		const resolvedLinks = this.app.metadataCache.resolvedLinks;
		const backlinks: string[] = [];

		for (const [sourcePath, targets] of Object.entries(resolvedLinks)) {
			if (path in targets) {
				backlinks.push(sourcePath);
			}
		}
		return backlinks;
	}

	async getAllTags(): Promise<string[]> {
		const tagSet = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.tags) {
				for (const tagCache of cache.tags) {
					tagSet.add(tagCache.tag);
				}
			}
			// Also check frontmatter tags
			if (cache?.frontmatter?.tags) {
				this.extractFrontmatterTags(cache.frontmatter.tags, tagSet);
			}
		}
		return Array.from(tagSet).sort();
	}

	private toFileMetadata(path: string, cache: CachedMetadata): FileMetadata {
		// Extract tags from inline tags and frontmatter
		const tags: string[] = [];
		if (cache.tags) {
			for (const tagCache of cache.tags) {
				tags.push(tagCache.tag);
			}
		}
		if (cache.frontmatter?.tags) {
			this.extractFrontmatterTags(cache.frontmatter.tags, new Set(tags));
			// Re-extract to get the normalized tags added to array
			const tagSet = new Set(tags);
			this.extractFrontmatterTags(cache.frontmatter.tags, tagSet);
			tags.length = 0;
			tags.push(...tagSet);
		}

		// Extract links
		const links: string[] = [];
		if (cache.links) {
			for (const linkCache of cache.links) {
				links.push(linkCache.link);
			}
		}

		// Extract headings
		const headings: HeadingInfo[] = [];
		if (cache.headings) {
			for (const headingCache of cache.headings) {
				headings.push({
					heading: headingCache.heading,
					level: headingCache.level,
					line: headingCache.position.start.line,
				});
			}
		}

		// Extract frontmatter (excluding 'position' key)
		const frontmatter: Record<string, unknown> = {};
		if (cache.frontmatter) {
			for (const [key, value] of Object.entries(cache.frontmatter)) {
				if (key !== 'position') {
					frontmatter[key] = value;
				}
			}
		}

		// Word count is not directly available from cache
		// Would need to read file content to calculate
		const wordCount = 0;

		return {
			path,
			tags,
			links,
			headings,
			frontmatter,
			wordCount,
		};
	}

	private extractFrontmatterTags(
		fmTags: unknown,
		tagSet: Set<string>,
	): void {
		if (Array.isArray(fmTags)) {
			for (const tag of fmTags) {
				if (typeof tag === 'string') {
					const normalized = tag.startsWith('#') ? tag : `#${tag}`;
					tagSet.add(normalized);
				}
			}
		} else if (typeof fmTags === 'string') {
			const normalized = fmTags.startsWith('#') ? fmTags : `#${fmTags}`;
			tagSet.add(normalized);
		}
	}
}
