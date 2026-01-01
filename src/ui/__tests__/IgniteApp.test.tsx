import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { IMetadataProvider, IStorageAdapter, IVaultProvider } from '@/ports';
import type { IgniteSettings } from '@/settings';
import { IgniteApp } from '@/ui/IgniteApp';
import { AppProvider } from '@/ui/contexts/AppContext';
import { GoalProvider } from '@/ui/contexts/GoalContext';

/**
 * Mock providers for testing.
 * These wrap IgniteApp with the required context that would normally
 * come from the Obsidian plugin.
 */
function createMockVaultProvider(): IVaultProvider {
  return {
    listMarkdownFiles: vi.fn(async () => []),
    readFile: vi.fn(async () => ''),
    exists: vi.fn(async () => false),
    getBasename: vi.fn((path: string) => path.split('/').pop()?.replace('.md', '') ?? ''),
    getFolder: vi.fn((path: string) => path.split('/').slice(0, -1).join('/')),
    createFile: vi.fn(async () => {}),
    modifyFile: vi.fn(async () => {}),
    createFolder: vi.fn(async () => {}),
    deleteFile: vi.fn(async () => {}),
    deleteFolder: vi.fn(async () => {}),
  };
}

function createMockStorageAdapter(): IStorageAdapter {
  return {
    read: vi.fn().mockResolvedValue(null),
    write: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
    delete: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockResolvedValue([]),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockMetadataProvider(): IMetadataProvider {
  return {
    getFileMetadata: vi.fn(async () => null),
    getResolvedLinks: vi.fn(async () => ({})),
    getBacklinks: vi.fn(async () => []),
    getAllTags: vi.fn(async () => []),
  };
}

function createMockSettings(): IgniteSettings {
  return {
    anthropicApiKey: '',
    voyageApiKey: '',
    includePaths: [],
    excludePaths: [],
  };
}

interface TestWrapperProps {
  children: React.ReactNode;
}

/**
 * Test wrapper that provides all required context providers.
 * This mimics what IgniteView should provide in production.
 */
function TestWrapper({ children }: TestWrapperProps) {
  const appContextValue = {
    vaultProvider: createMockVaultProvider(),
    storageAdapter: createMockStorageAdapter(),
    metadataProvider: createMockMetadataProvider(),
    settings: createMockSettings(),
  };

  return (
    <AppProvider value={appContextValue}>
      <GoalProvider>{children}</GoalProvider>
    </AppProvider>
  );
}

describe('IgniteApp', () => {
  it('renders without throwing context errors', () => {
    // This will throw if any required internal context provider is missing
    // (e.g., Router). External providers (AppProvider, GoalProvider) are
    // provided by TestWrapper.
    expect(() =>
      render(<IgniteApp />, {
        wrapper: TestWrapper,
      }),
    ).not.toThrow();
  });

  it('renders the home screen by default', () => {
    render(<IgniteApp />, { wrapper: TestWrapper });

    // HomeScreen should render the goals list (empty state when no goals)
    expect(screen.getByText('My Goals')).toBeTruthy();
  });
});
