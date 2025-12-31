# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ignite is an Obsidian plugin that provides goal-oriented learning. Users define learning goals, and the plugin helps them achieve mastery through personalized quizzes, research, and drafts. It uses the Anthropic Claude API for AI-powered features.

## Commands

```bash
npm run dev          # Start esbuild in watch mode for development
npm run build        # Production build (outputs main.js)
npm run test         # Run all tests
npm run test:watch   # Run tests in watch mode
vitest run src/path/to/file.test.ts  # Run a single test file
npm run lint         # Lint source files with Biome
npm run format       # Format source files with Biome
npm run check        # Run Biome check (lint + format)
npm run typecheck    # TypeScript type checking
```

## Architecture

### Ports and Adapters Pattern

The codebase uses a hexagonal architecture to decouple domain logic from Obsidian's APIs:

- **Ports** (`src/ports/`): Interfaces defining contracts for external dependencies

  - `IVaultProvider`: File operations (list, read, exists)
  - `IMetadataProvider`: Note metadata (tags, links, headings, frontmatter)
  - `IStorageAdapter`: Persistent storage
  - `ILLMProvider`: LLM interactions for question generation

- **Adapters** (`src/adapters/`): Implementations of port interfaces

  - `obsidian/`: Obsidian-specific implementations
  - `anthropic/`: Anthropic Claude LLM adapter
  - `mock/`: In-memory implementations for testing

- **Domain** (`src/domain/`): Pure business logic with no Obsidian dependencies

### Question Generation Pipeline

The `src/domain/question/` module generates quiz questions from notes:

1. **Note Selection** - Selects notes based on learning goals and history
2. **Question Generation** - LLM generates questions from selected content
3. **History Tracking** - Tracks quiz performance for adaptive learning

### Embedding Module (for future use)

The `src/domain/embedding/` module provides text preparation and caching utilities that may be reused for semantic search or other features.

### Testing

- Tests use Vitest with jsdom environment
- Obsidian API is mocked via `src/test/mocks/obsidian.ts` (aliased in vitest.config.ts)
- Path alias `@/` maps to `src/`
- Test files are colocated with source: `__tests__/*.test.ts`

### Code Style

- Biome for linting/formatting (2 spaces, single quotes, semicolons)
- Always use absolute imports with `@/` prefix (e.g., `import { Foo } from '@/domain/foo'`)
- Never use relative imports with `../` (use `@/` path alias instead)
- Strict TypeScript with strict null checks
- `noNonNullAssertion` is an error (never use `!` non-null assertions)
- Never use `any` to get rid of type errors. Figure out the right type always.
