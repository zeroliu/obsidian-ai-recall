import { vi } from 'vitest';

// Global test setup for Obsidian AI Recall
// Mock any global APIs that might be needed across tests

// Mock console methods if needed for cleaner test output
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  vi.restoreAllMocks();
});
