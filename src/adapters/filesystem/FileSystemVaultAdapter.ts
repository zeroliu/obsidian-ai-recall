/**
 * File system implementation of IVaultProvider
 *
 * Used by scripts to run the pipeline outside of Obsidian environment.
 * Reads markdown files directly from the filesystem.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { FileInfo, IVaultProvider } from '@/ports/IVaultProvider';

/**
 * Recursively find all markdown files in a directory
 */
function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) {
    return files;
  }

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    // Skip hidden directories and common non-content folders
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * File system implementation of IVaultProvider
 */
export class FileSystemVaultAdapter implements IVaultProvider {
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  async listMarkdownFiles(): Promise<FileInfo[]> {
    const absolutePaths = findMarkdownFiles(this.vaultPath);
    const files: FileInfo[] = [];

    for (const fullPath of absolutePaths) {
      const relativePath = fullPath.replace(`${this.vaultPath}/`, '');
      const stats = statSync(fullPath);

      files.push({
        path: relativePath,
        basename: basename(fullPath, '.md'),
        folder: dirname(relativePath) === '.' ? '' : dirname(relativePath),
        modifiedAt: stats.mtimeMs,
        createdAt: stats.birthtimeMs,
      });
    }

    return files;
  }

  async readFile(path: string): Promise<string> {
    const fullPath = join(this.vaultPath, path);
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${path}`);
    }
    return readFileSync(fullPath, 'utf-8');
  }

  async exists(path: string): Promise<boolean> {
    return existsSync(join(this.vaultPath, path));
  }

  getBasename(path: string): string {
    const filename = path.split('/').pop() || '';
    return filename.replace(/\.[^/.]+$/, '');
  }

  getFolder(path: string): string {
    const parts = path.split('/');
    parts.pop(); // Remove filename
    return parts.join('/');
  }
}
