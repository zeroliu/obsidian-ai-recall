---
created: 2025-12-29
updated: 2025-12-29
---
# Frontend Architecture Design for Recall Plugin

This document provides a comprehensive guideline for implementing the Recall plugin's frontend UI, bridging the Lovable prototype's visual style and animations with Obsidian's design system.

See also: [[interaction-design-spec]]

---

## 1. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | React 18 | Same as prototype; Obsidian officially supports React for complex UIs |
| **Language** | TypeScript (strict mode) | Project already uses strict TypeScript |
| **Styling** | CSS Modules + CSS Variables | Obsidian-native theming via CSS variables |
| **Animations** | CSS-only (keyframes + transitions) | Same as prototype; performant, no extra deps |
| **Build** | esbuild (existing) | Already configured in project |

### Required New Dependencies

```json
{
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "@types/react": "^18.3.0",
  "@types/react-dom": "^18.3.0"
}
```

---

## 2. Directory Structure

```
src/
├── ui/                           # All frontend code
│   ├── components/               # React components
│   │   ├── layout/              # Panel, Header, Footer
│   │   ├── quiz/                # Quiz-specific screens
│   │   ├── concepts/            # Concept management
│   │   ├── activity/            # Activity tab
│   │   ├── settings/            # Settings tab
│   │   └── shared/              # Reusable components (Button, Input, Card, etc.)
│   ├── hooks/                   # Custom React hooks
│   ├── context/                 # React context providers
│   ├── types/                   # UI-specific TypeScript types
│   ├── styles/                  # CSS files
│   │   ├── variables.css        # Obsidian variable mappings
│   │   ├── animations.css       # Keyframe definitions
│   │   ├── components.css       # Component-specific styles
│   │   └── utilities.css        # Utility classes
│   ├── RecallApp.tsx            # Main app component
│   └── index.tsx                # Entry point (renders to ItemView)
├── adapters/obsidian/
│   └── RecallView.ts            # Obsidian ItemView wrapper
└── ...
```

---

## 3. Obsidian Integration

### 3.1 ItemView Registration

Create `src/adapters/obsidian/RecallView.ts`:

```typescript
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import { RecallApp } from '@/ui/RecallApp';

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
    return 'brain'; // Lucide icon name
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('recall-view-container');

    this.root = createRoot(container);
    this.root.render(<RecallApp app={this.app} />);
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
  }
}
```

### 3.2 Plugin Registration (main.ts)

Add to `onload()`:

```typescript
this.registerView(RECALL_VIEW_TYPE, (leaf) => new RecallView(leaf));

this.addRibbonIcon('brain', 'Open Recall', () => {
  this.activateView();
});

// Add command to open view
this.addCommand({
  id: 'open-recall',
  name: 'Open Recall panel',
  callback: () => this.activateView(),
});
```

---

## 4. CSS Variable Mapping Strategy

### 4.1 Mapping Table: Prototype → Obsidian

Create `src/ui/styles/variables.css`:

```css
/*
 * Map prototype tokens to Obsidian CSS variables
 * This enables automatic theme switching (light/dark)
 */

.recall-view-container {
  /* === BACKGROUNDS === */
  --recall-background: var(--background-primary);
  --recall-background-secondary: var(--background-secondary);
  --recall-card: var(--background-secondary);
  --recall-card-hover: var(--background-modifier-hover);

  /* === TEXT === */
  --recall-text: var(--text-normal);
  --recall-text-muted: var(--text-muted);
  --recall-text-faint: var(--text-faint);
  --recall-text-on-accent: var(--text-on-accent);

  /* === PRIMARY/ACCENT (uses user's accent color) === */
  --recall-primary: var(--interactive-accent);
  --recall-primary-hover: var(--interactive-accent-hover);

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

  /* === SPACING (4px grid) === */
  --recall-space-1: 4px;
  --recall-space-2: 8px;
  --recall-space-3: 12px;
  --recall-space-4: 16px;
  --recall-space-5: 20px;
  --recall-space-6: 24px;

  /* === TYPOGRAPHY === */
  --recall-font-ui: var(--font-interface);
  --recall-font-size-sm: var(--font-ui-small);
  --recall-font-size-base: var(--font-ui-medium);
  --recall-font-size-lg: var(--font-ui-large);

  /* === RADIUS === */
  --recall-radius-sm: 4px;
  --recall-radius-md: 6px;
  --recall-radius-lg: 8px;
}
```

### 4.2 Usage in Components

```css
/* Component CSS example */
.recall-button-primary {
  background-color: var(--recall-primary);
  color: var(--recall-text-on-accent);
  border: none;
  border-radius: var(--recall-radius-md);
  padding: var(--recall-space-2) var(--recall-space-4);
  font-family: var(--recall-font-ui);
  font-size: var(--recall-font-size-base);
  cursor: var(--cursor);
  transition: background-color 100ms ease-out;
}

.recall-button-primary:hover {
  background-color: var(--recall-primary-hover);
}
```

---

## 5. Animation System

### 5.1 Animation Keyframes

Create `src/ui/styles/animations.css`:

```css
/* === ENTRANCE ANIMATIONS === */
@keyframes recall-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes recall-slide-up {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes recall-slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes recall-scale-in {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* === EXIT ANIMATIONS === */
@keyframes recall-slide-down {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(20px); opacity: 0; }
}

@keyframes recall-slide-out-left {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-100%); opacity: 0; }
}

/* === FEEDBACK ANIMATIONS === */
@keyframes recall-confetti {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(-100px) rotate(720deg); opacity: 0; }
}

@keyframes recall-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

@keyframes recall-bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* === LOADING ANIMATIONS === */
@keyframes recall-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes recall-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* === PROGRESS BAR === */
@keyframes recall-progress-indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
```

### 5.2 Animation Utility Classes

```css
/* === ANIMATION CLASSES === */
.recall-animate-fade-in { animation: recall-fade-in 200ms ease-out forwards; }
.recall-animate-slide-up { animation: recall-slide-up 200ms ease-out forwards; }
.recall-animate-slide-in-right { animation: recall-slide-in-right 300ms ease-out forwards; }
.recall-animate-scale-in { animation: recall-scale-in 200ms ease-out forwards; }
.recall-animate-shake { animation: recall-shake 300ms ease-out; }
.recall-animate-bounce { animation: recall-bounce 300ms ease-out; }
.recall-animate-pulse { animation: recall-pulse 2s ease-in-out infinite; }

/* === TRANSITION HELPERS === */
.recall-transition-colors { transition: color 100ms, background-color 100ms; }
.recall-transition-transform { transition: transform 150ms ease-out; }
.recall-transition-all { transition: all 150ms ease-out; }

/* === REDUCED MOTION === */
@media (prefers-reduced-motion: reduce) {
  .recall-animate-fade-in,
  .recall-animate-slide-up,
  .recall-animate-slide-in-right,
  .recall-animate-scale-in,
  .recall-animate-shake,
  .recall-animate-bounce,
  .recall-animate-pulse {
    animation: none;
  }

  .recall-transition-colors,
  .recall-transition-transform,
  .recall-transition-all {
    transition: none;
  }
}
```

### 5.3 Animation Timing Reference

| Animation | Duration | Easing | Use Case |
|-----------|----------|--------|----------|
| fade-in | 200ms | ease-out | Element entrance |
| slide-up | 200ms | ease-out | Modal/toast entrance |
| slide-in-right | 300ms | ease-out | Screen transitions |
| scale-in | 200ms | ease-out | Modal content entrance |
| shake | 300ms | ease-out | Incorrect answer feedback |
| bounce | 300ms | ease-out | Correct answer icon |
| confetti | 1000ms | ease-out | Celebration particles |
| shimmer | 1500ms | linear (loop) | Skeleton loading |
| pulse | 2000ms | ease-in-out (loop) | Loading indicator |
| button hover | 100ms | linear | Micro-interaction |
| progress bar | 300ms | ease-out | Width transitions |

---

## 6. Component Architecture

### 6.1 Layout System

Port the Panel system from prototype:

```tsx
// src/ui/components/layout/Panel.tsx
interface PanelProps {
  children: React.ReactNode;
  className?: string;
}

export const Panel: React.FC<PanelProps> = ({ children, className }) => (
  <div className={`recall-panel ${className ?? ''}`}>
    {children}
  </div>
);

export const PanelHeader: React.FC<PanelProps> = ({ children, className }) => (
  <div className={`recall-panel-header ${className ?? ''}`}>
    {children}
  </div>
);

export const PanelContent: React.FC<PanelProps> = ({ children, className }) => (
  <div className={`recall-panel-content ${className ?? ''}`}>
    {children}
  </div>
);

export const PanelFooter: React.FC<PanelProps> = ({ children, className }) => (
  <div className={`recall-panel-footer ${className ?? ''}`}>
    {children}
  </div>
);
```

```css
/* Panel CSS */
.recall-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--recall-background);
  overflow: hidden;
}

.recall-panel-header {
  flex-shrink: 0;
  padding: var(--recall-space-4);
  border-bottom: 1px solid var(--recall-border);
}

.recall-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--recall-space-4);
}

.recall-panel-footer {
  flex-shrink: 0;
  padding: var(--recall-space-4);
  border-top: 1px solid var(--recall-border);
  background-color: var(--recall-card);
}
```

### 6.2 Screen State Machine

```tsx
// src/ui/RecallApp.tsx
type Screen =
  | 'welcome'
  | 'concept-selection'
  | 'home'
  | 'quiz'
  | 'feedback'
  | 'summary'
  | 'concepts'
  | 'activity'
  | 'settings';

export const RecallApp: React.FC<{ app: App }> = ({ app }) => {
  const [screen, setScreen] = useState<Screen>('welcome');

  // ... state management from prototype RecallApp.tsx

  return (
    <div className="recall-app">
      {renderScreen()}
      {/* Overlays (feedback, confetti, toast) rendered here */}
    </div>
  );
};
```

### 6.3 Shared Component Patterns

**Button Component:**

```tsx
// src/ui/components/shared/Button.tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) => (
  <button
    className={`recall-button recall-button-${variant} recall-button-${size} ${className ?? ''}`}
    {...props}
  >
    {children}
  </button>
);
```

**Card Component:**

```tsx
// src/ui/components/shared/Card.tsx
interface CardProps {
  children: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  onClick,
  selected,
  className
}) => (
  <div
    className={`recall-card ${selected ? 'recall-card-selected' : ''} ${className ?? ''}`}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
  >
    {children}
  </div>
);
```

---

## 7. Responsive Design

### 7.1 Sidebar Width Handling

The sidebar can be resized by users. Handle this with:

```css
.recall-view-container {
  /* Fill available space */
  width: 100%;
  height: 100%;
  min-width: 280px;  /* Minimum usable width */

  /* Container queries for responsive adjustments */
  container-type: inline-size;
  container-name: recall-panel;
}

/* Responsive adjustments based on container width */
@container recall-panel (max-width: 300px) {
  .recall-concept-card {
    flex-direction: column;
    gap: var(--recall-space-2);
  }

  .recall-concept-card-meta {
    align-self: flex-start;
  }

  .recall-quick-start-grid {
    grid-template-columns: 1fr;
  }
}

@container recall-panel (min-width: 350px) {
  .recall-quick-start-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### 7.2 Text Truncation

```css
.recall-text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recall-text-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

### 7.3 Scrollable Areas

```css
/* Match Obsidian's scrollbar styling */
.recall-panel-content::-webkit-scrollbar {
  width: 8px;
}

.recall-panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.recall-panel-content::-webkit-scrollbar-thumb {
  background: var(--background-modifier-border);
  border-radius: 4px;
}

.recall-panel-content::-webkit-scrollbar-thumb:hover {
  background: var(--background-modifier-border-hover);
}
```

---

## 8. Accessibility

### 8.1 Focus Management

```css
/* Focus ring using Obsidian's accent */
.recall-button:focus-visible,
.recall-card:focus-visible,
.recall-input:focus-visible {
  outline: 2px solid var(--recall-primary);
  outline-offset: 2px;
}

/* Remove default outline */
.recall-button:focus,
.recall-card:focus,
.recall-input:focus {
  outline: none;
}
```

### 8.2 Screen Reader Support

```tsx
// Use proper ARIA attributes
<div role="progressbar" aria-valuenow={70} aria-valuemin={0} aria-valuemax={100}>
  <div className="recall-progress-fill" style={{ width: '70%' }} />
</div>

// Announce quiz feedback
<div role="alert" aria-live="polite" className="recall-feedback">
  {isCorrect ? 'Correct!' : 'Incorrect'}
</div>
```

### 8.3 Keyboard Navigation

```tsx
// Quiz options should be keyboard navigable
const handleKeyDown = (e: KeyboardEvent, index: number) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    selectOption(index);
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    focusOption(index + 1);
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    focusOption(index - 1);
  }
};
```

---

## 9. State Management

### 9.1 Architecture

Use React's built-in state management (same as prototype):

```
┌─────────────────────────────────────────┐
│ RecallApp (Container)                   │
│ ├── screen state                        │
│ ├── quiz state (questions, results)     │
│ ├── concept state                       │
│ └── UI state (modals, toasts)           │
└─────────────────────────────────────────┘
           │
           ▼ props + callbacks
┌─────────────────────────────────────────┐
│ Screen Components                       │
│ (HomeScreen, QuizScreen, etc.)          │
└─────────────────────────────────────────┘
```

### 9.2 Context for App Instance

```tsx
// src/ui/context/AppContext.tsx
import { App } from 'obsidian';

const AppContext = React.createContext<App | null>(null);

export const AppProvider: React.FC<{ app: App; children: React.ReactNode }> = ({
  app,
  children
}) => (
  <AppContext.Provider value={app}>
    {children}
  </AppContext.Provider>
);

export const useApp = () => {
  const app = useContext(AppContext);
  if (!app) throw new Error('useApp must be used within AppProvider');
  return app;
};
```

---

## 10. File Reference: Prototype → Plugin

When implementing, port these prototype files to the plugin:

| Prototype File | Plugin Destination | Notes |
|----------------|-------------------|-------|
| `src/components/recall/RecallApp.tsx` | `src/ui/RecallApp.tsx` | Main container, adapt state |
| `src/components/recall/Panel.tsx` | `src/ui/components/layout/Panel.tsx` | Direct port with CSS Module |
| `src/components/recall/HomeScreen.tsx` | `src/ui/components/quiz/HomeScreen.tsx` | Add tab navigation |
| `src/components/recall/QuizScreen.tsx` | `src/ui/components/quiz/QuizScreen.tsx` | Port question types |
| `src/components/recall/FeedbackOverlay.tsx` | `src/ui/components/quiz/FeedbackOverlay.tsx` | Include Confetti |
| `src/components/recall/SummaryScreen.tsx` | `src/ui/components/quiz/SummaryScreen.tsx` | Port score animation |
| `src/types/recall.ts` | `src/ui/types/recall.ts` | Type definitions |
| `src/index.css` | `src/ui/styles/*.css` | Split into modules |

---

## 11. Testing Strategy

### 11.1 Component Testing

```tsx
// src/ui/components/shared/__tests__/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with correct variant class', () => {
    render(<Button variant="primary">Click</Button>);
    expect(screen.getByRole('button')).toHaveClass('recall-button-primary');
  });

  it('handles click events', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

### 11.2 Vitest Configuration

Add to `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
```

---

## 12. Implementation Checklist

### Phase 1: Foundation
- [ ] Add React dependencies to package.json
- [ ] Create `src/ui/` directory structure
- [ ] Create CSS variable mappings (`variables.css`)
- [ ] Create animation definitions (`animations.css`)
- [ ] Implement `RecallView.ts` (Obsidian ItemView)
- [ ] Register view in `main.ts`

### Phase 2: Layout & Navigation
- [ ] Port Panel components
- [ ] Implement tab navigation (Quiz, Concepts, Activity, Settings)
- [ ] Create screen state machine in RecallApp

### Phase 3: Shared Components
- [ ] Button component with variants
- [ ] Card component
- [ ] Input/TextArea components
- [ ] Progress bar component
- [ ] Modal/Overlay component
- [ ] Toast component

### Phase 4: Quiz Flow
- [ ] Welcome/Onboarding screen
- [ ] Concept selection screen
- [ ] Home screen with quick start
- [ ] Quiz screen (all question types)
- [ ] Feedback overlay with confetti
- [ ] Summary screen with score animation

### Phase 5: Management Screens
- [ ] Concepts tab (list + detail view)
- [ ] Activity tab
- [ ] Settings tab

### Phase 6: Polish
- [ ] Responsive testing at various widths
- [ ] Theme testing (light + dark)
- [ ] Accessibility audit
- [ ] Reduced motion support

---

## Summary

This architecture enables:

1. **Visual Fidelity**: Port prototype's visual style with Obsidian-native theming
2. **Theme Support**: Automatic light/dark mode via CSS variable mapping
3. **Responsive**: Container queries handle sidebar resizing
4. **Performant**: CSS-only animations, no heavy JS libraries
5. **Accessible**: Keyboard navigation, screen reader support, reduced motion
6. **Maintainable**: Clear component hierarchy, TypeScript throughout
7. **Testable**: React Testing Library + Vitest setup
