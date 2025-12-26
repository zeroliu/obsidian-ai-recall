# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin that provides AI-powered spaced repetition for note recall. It uses the Anthropic Claude API to intelligently cluster and surface notes for review.

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

- **Adapters** (`src/adapters/`): Implementations of port interfaces

  - `mock/`: In-memory implementations for testing

- **Domain** (`src/domain/`): Pure business logic with no Obsidian dependencies

### Clustering Pipeline

The `src/domain/clustering/` module clusters notes through a multi-step pipeline:

1. `clusterByFolder` - Initial grouping by folder structure
2. `refineByTags` - Refine clusters by dominant tags
3. `analyzeLinks` - Calculate internal link density
4. `mergeRelatedClusters` - Merge clusters with high link overlap
5. `groupByTitleKeywords` - Further refine by title keywords (supports CJK)
6. `normalizeClusterSizes` - Split large clusters, merge small ones

Run the full pipeline via `runClusteringPipeline()` from `src/domain/clustering/pipeline.ts`.

### Testing

- Tests use Vitest with jsdom environment
- Obsidian API is mocked via `src/test/mocks/obsidian.ts` (aliased in vitest.config.ts)
- Path alias `@/` maps to `src/`
- Test files are colocated with source: `__tests__/*.test.ts`

### Code Style

- Biome for linting/formatting (tabs, single quotes, semicolons)
- Strict TypeScript with strict null checks
- `noNonNullAssertion` is a warning (allowed but discouraged)
- Never use `any` to get rid of type errors. Figure out the right type always.
