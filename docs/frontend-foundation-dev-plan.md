---
created: 2025-12-29
updated: 2025-12-29
---
# Frontend Foundation Dev Plan

This plan covers Phase 1 of the frontend implementation: setting up React, Obsidian integration, CSS foundations, and validating the entire pipeline works.

See also: [[frontend-architecture]]

---

## Overview

**Goal**: Render a minimal React component inside Obsidian's right sidebar with proper theming.

**Success Criteria**:
- React 18 renders inside an Obsidian ItemView
- CSS variables from Obsidian theme are accessible
- View can be opened via ribbon icon and command palette
- Hot reload works during development
- No console errors on mount/unmount

**Estimated Tasks**: 8 tasks

---

## Task 1: Install React Dependencies

### Description
Add React 18 and type definitions to the project.

### Steps
1. Install production dependencies:
   ```bash
   npm install react@^18.3.0 react-dom@^18.3.0
   ```

2. Install dev dependencies:
   ```bash
   npm install -D @types/react@^18.3.0 @types/react-dom@^18.3.0
   ```

3. Update `tsconfig.json` to support JSX:
   ```json
   {
     "compilerOptions": {
       "jsx": "react-jsx",
       "jsxImportSource": "react"
     }
   }
   ```

### Verification
- `npm run typecheck` passes
- No new TypeScript errors

---

## Task 2: Update esbuild Configuration

### Description
Ensure esbuild correctly compiles TSX files and bundles React.

### Steps
1. Open `esbuild.config.mjs` (or equivalent build config)

2. Verify/add these settings:
   ```javascript
   {
     entryPoints: ['src/main.ts'],
     bundle: true,
     external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
     format: 'cjs',
     target: 'es2018',
     // React JSX support
     jsx: 'automatic',
     // Ensure .tsx files are processed
     loader: {
       '.tsx': 'tsx',
       '.ts': 'ts',
     },
   }
   ```

3. Verify React is NOT in the `external` array (it should be bundled)

### Verification
- `npm run build` succeeds
- `main.js` output contains React runtime code

---

## Task 3: Create Directory Structure

### Description
Set up the `src/ui/` folder structure for all frontend code.

### Steps
Create the following directories:
```
src/ui/
├── components/
│   ├── layout/           # Panel, Header, Footer
│   ├── quiz/             # Quiz-specific screens
│   ├── concepts/         # Concept management
│   ├── activity/         # Activity tab
│   ├── settings/         # Settings tab
│   └── shared/           # Reusable components (Button, Card, etc.)
├── hooks/                # Custom React hooks
├── context/              # React context providers
├── types/                # UI-specific TypeScript types
└── styles/               # CSS files
```

### Commands
```bash
mkdir -p src/ui/components/{layout,quiz,concepts,activity,settings,shared}
mkdir -p src/ui/{hooks,context,types,styles}
```

### Verification
- Directory structure exists
- No build errors

---

## Task 4: Create CSS Variables Foundation

### Description
Create the CSS variable mapping file that bridges Obsidian's theme to our components.

### Steps
1. Create `src/ui/styles/variables.css`:

```css
/*
 * Recall Plugin CSS Variables
 * Maps Obsidian theme variables to recall-prefixed tokens
 * This enables automatic light/dark theme support
 */

.recall-view-container {
  /* === BACKGROUNDS === */
  --recall-bg: var(--background-primary);
  --recall-bg-secondary: var(--background-secondary);
  --recall-bg-card: var(--background-secondary);
  --recall-bg-hover: var(--background-modifier-hover);

  /* === TEXT === */
  --recall-text: var(--text-normal);
  --recall-text-muted: var(--text-muted);
  --recall-text-faint: var(--text-faint);
  --recall-text-on-accent: var(--text-on-accent);

  /* === ACCENT (uses user's accent color) === */
  --recall-accent: var(--interactive-accent);
  --recall-accent-hover: var(--interactive-accent-hover);

  /* === STATUS COLORS === */
  --recall-success: var(--color-green);
  --recall-warning: var(--color-yellow);
  --recall-error: var(--color-red);
  --recall-info: var(--color-blue);

  /* === BORDERS === */
  --recall-border: var(--background-modifier-border);
  --recall-border-focus: var(--interactive-accent);

  /* === INPUTS === */
  --recall-input-bg: var(--background-modifier-form-field);

  /* === SPACING (4px base grid) === */
  --recall-space-1: 4px;
  --recall-space-2: 8px;
  --recall-space-3: 12px;
  --recall-space-4: 16px;
  --recall-space-5: 20px;
  --recall-space-6: 24px;
  --recall-space-8: 32px;

  /* === TYPOGRAPHY === */
  --recall-font-ui: var(--font-interface);
  --recall-font-size-xs: var(--font-ui-smaller);
  --recall-font-size-sm: var(--font-ui-small);
  --recall-font-size-base: var(--font-ui-medium);
  --recall-font-size-lg: var(--font-ui-large);

  /* === RADIUS === */
  --recall-radius-sm: 4px;
  --recall-radius-md: 6px;
  --recall-radius-lg: 8px;
  --recall-radius-full: 9999px;

  /* === SHADOWS === */
  --recall-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --recall-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);

  /* === TRANSITIONS === */
  --recall-transition-fast: 100ms ease-out;
  --recall-transition-normal: 150ms ease-out;
  --recall-transition-slow: 200ms ease-out;
}
```

2. Create `src/ui/styles/base.css`:

```css
/*
 * Base styles for the Recall plugin
 */

@import './variables.css';

.recall-view-container {
  width: 100%;
  height: 100%;
  font-family: var(--recall-font-ui);
  font-size: var(--recall-font-size-base);
  color: var(--recall-text);
  background-color: var(--recall-bg);
  overflow: hidden;
}

/* Reset for plugin container */
.recall-view-container * {
  box-sizing: border-box;
}

.recall-view-container button {
  font-family: inherit;
  cursor: var(--cursor);
}
```

### Verification
- Files created without syntax errors
- CSS imports work (verified in Task 7)

---

## Task 5: Implement RecallView (Obsidian ItemView)

### Description
Create the Obsidian ItemView that hosts the React application.

### Steps
1. Create `src/adapters/obsidian/RecallView.ts`:

```typescript
import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { Root } from 'react-dom/client';

export const RECALL_VIEW_TYPE = 'recall-view';

export class RecallView extends ItemView {
  private root: Root | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return RECALL_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Recall';
  }

  getIcon(): string {
    return 'brain';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    if (!container) return;

    container.empty();
    container.addClass('recall-view-container');

    // Dynamic import to ensure React is loaded
    const { createRoot } = await import('react-dom/client');
    const { RecallApp } = await import('@/ui/RecallApp');

    this.root = createRoot(container as HTMLElement);
    this.root.render(<RecallApp />);
  }

  async onClose(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
```

2. Create a minimal `src/ui/RecallApp.tsx`:

```tsx
import React from 'react';

// Import base styles
import './styles/base.css';

export const RecallApp: React.FC = () => {
  return (
    <div className="recall-app">
      <div style={{ padding: 'var(--recall-space-4)' }}>
        <h2 style={{
          color: 'var(--recall-text)',
          marginBottom: 'var(--recall-space-2)'
        }}>
          Recall
        </h2>
        <p style={{ color: 'var(--recall-text-muted)' }}>
          Plugin is loading...
        </p>
        <div style={{
          marginTop: 'var(--recall-space-4)',
          padding: 'var(--recall-space-3)',
          backgroundColor: 'var(--recall-bg-card)',
          borderRadius: 'var(--recall-radius-md)',
          border: '1px solid var(--recall-border)'
        }}>
          <p style={{ color: 'var(--recall-accent)' }}>
            ✓ React is working
          </p>
          <p style={{
            color: 'var(--recall-text-muted)',
            fontSize: 'var(--recall-font-size-sm)',
            marginTop: 'var(--recall-space-2)'
          }}>
            CSS variables are mapped correctly
          </p>
        </div>
      </div>
    </div>
  );
};
```

### Verification
- TypeScript compiles without errors
- No JSX errors in editor

---

## Task 6: Register View in Main Plugin

### Description
Update `main.ts` to register the RecallView and add ribbon/command access.

### Steps
1. Add imports to `src/main.ts`:

```typescript
import { RecallView, RECALL_VIEW_TYPE } from '@/adapters/obsidian/RecallView';
```

2. Add to `onload()` method:

```typescript
// Register the Recall view
this.registerView(
  RECALL_VIEW_TYPE,
  (leaf) => new RecallView(leaf)
);

// Add ribbon icon to open Recall
this.addRibbonIcon('brain', 'Open Recall', () => {
  this.activateRecallView();
});

// Add command to open Recall
this.addCommand({
  id: 'open-recall-view',
  name: 'Open Recall panel',
  callback: () => {
    this.activateRecallView();
  },
});
```

3. Add helper method to the plugin class:

```typescript
async activateRecallView(): Promise<void> {
  const { workspace } = this.app;

  let leaf = workspace.getLeavesOfType(RECALL_VIEW_TYPE)[0];

  if (!leaf) {
    // Open in right sidebar
    const rightLeaf = workspace.getRightLeaf(false);
    if (rightLeaf) {
      await rightLeaf.setViewState({
        type: RECALL_VIEW_TYPE,
        active: true,
      });
      leaf = rightLeaf;
    }
  }

  if (leaf) {
    workspace.revealLeaf(leaf);
  }
}
```

4. Add cleanup in `onunload()`:

```typescript
// Detach all Recall views
this.app.workspace.detachLeavesOfType(RECALL_VIEW_TYPE);
```

### Verification
- Plugin compiles without errors
- Ribbon icon appears in Obsidian

---

## Task 7: Configure CSS Loading in esbuild

### Description
Ensure CSS files are bundled and injected correctly.

### Steps
1. Verify esbuild config handles CSS:

```javascript
{
  // ... existing config
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css',
  },
}
```

2. If using esbuild's native CSS handling, styles should be inlined or you may need a plugin like `esbuild-style-plugin` for CSS injection.

3. Alternative approach - inject CSS via JavaScript in RecallView:

```typescript
// In RecallView.onOpen(), before React render:
const styleEl = document.createElement('style');
styleEl.id = 'recall-plugin-styles';
if (!document.getElementById('recall-plugin-styles')) {
  // Inline the CSS content or import it
  styleEl.textContent = `/* CSS content here */`;
  document.head.appendChild(styleEl);
}
```

4. Most reliable approach for Obsidian plugins - use `styles.css` in plugin root:
   - Create `styles.css` in project root
   - Obsidian automatically loads this file
   - Copy contents from `src/ui/styles/base.css` and `variables.css`

### Verification
- CSS variables are applied when view opens
- Theme colors match Obsidian's current theme

---

## Task 8: End-to-End Testing in Obsidian

### Description
Verify the complete integration works in a real Obsidian vault.

### Test Environment Setup

1. **Development vault**: Create or use a test vault
   ```bash
   mkdir -p ~/obsidian-test-vault/.obsidian/plugins/recall
   ```

2. **Symlink plugin** (for rapid development):
   ```bash
   # From project root
   ln -sf "$(pwd)/main.js" ~/obsidian-test-vault/.obsidian/plugins/recall/main.js
   ln -sf "$(pwd)/manifest.json" ~/obsidian-test-vault/.obsidian/plugins/recall/manifest.json
   ln -sf "$(pwd)/styles.css" ~/obsidian-test-vault/.obsidian/plugins/recall/styles.css
   ```

3. **Start dev server**:
   ```bash
   npm run dev
   ```

### Test Cases

#### TC1: Plugin Loads Successfully
1. Open Obsidian with test vault
2. Go to Settings → Community Plugins
3. Enable "Recall" plugin
4. **Expected**: Plugin enables without errors

#### TC2: Ribbon Icon Works
1. Click the brain icon (🧠) in the left ribbon
2. **Expected**: Right sidebar opens with Recall panel
3. **Expected**: Panel shows "Recall" header and "React is working" message

#### TC3: Command Palette Works
1. Press `Cmd/Ctrl + P`
2. Type "Recall"
3. Select "Open Recall panel"
4. **Expected**: Recall panel opens in right sidebar

#### TC4: CSS Variables Apply Correctly
1. Open Recall panel
2. Check that text colors match Obsidian's theme
3. **Expected**: Card background uses `--background-secondary`
4. **Expected**: Accent text uses user's accent color

#### TC5: Theme Switching
1. Open Recall panel
2. Go to Settings → Appearance
3. Switch between Light and Dark themes
4. **Expected**: Recall panel updates colors automatically
5. **Expected**: No flash or re-render needed

#### TC6: View Persistence
1. Open Recall panel
2. Close Obsidian completely
3. Reopen Obsidian
4. **Expected**: Recall panel is still open in sidebar

#### TC7: Clean Unmount
1. Open Recall panel
2. Close the panel (X button or drag away)
3. Open Developer Console (`Cmd/Ctrl + Shift + I`)
4. **Expected**: No React errors about unmounting
5. **Expected**: No memory leak warnings

#### TC8: Hot Reload (Development)
1. With `npm run dev` running
2. Open Recall panel in Obsidian
3. Modify `RecallApp.tsx` (e.g., change text)
4. Save file
5. In Obsidian: `Cmd/Ctrl + P` → "Reload app without saving"
6. **Expected**: Changes appear after reload

### Debugging Tips

**If view doesn't appear:**
- Check Developer Console for errors
- Verify `manifest.json` has correct `id` matching plugin folder name
- Ensure plugin is enabled in Community Plugins

**If styles don't apply:**
- Verify `styles.css` exists in plugin folder
- Check that class names match CSS selectors
- Inspect element to see computed styles

**If React crashes:**
- Check for hydration errors (shouldn't happen with createRoot)
- Verify all imports resolve correctly
- Check for circular dependencies

---

## Completion Checklist

- [ ] React dependencies installed
- [ ] esbuild compiles TSX correctly
- [ ] Directory structure created
- [ ] CSS variables file created
- [ ] RecallView implemented
- [ ] View registered in main.ts
- [ ] CSS loading works
- [ ] All 8 test cases pass

---

## Next Steps

After completing this foundation:

1. **Phase 2**: Implement Panel layout components and tab navigation
2. **Phase 3**: Build shared components (Button, Card, Input)
3. **Phase 4**: Implement quiz flow screens

See [[frontend-architecture]] for the full implementation roadmap.
