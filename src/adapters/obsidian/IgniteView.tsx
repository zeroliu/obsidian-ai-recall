import { ItemView } from 'obsidian';
import type { Root } from 'react-dom/client';

export const IGNITE_VIEW_TYPE = 'ignite-view';

export class IgniteView extends ItemView {
  private root: Root | null = null;

  getViewType(): string {
    return IGNITE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Ignite';
  }

  getIcon(): string {
    return 'flame';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    if (!container) return;

    container.empty();
    container.addClass('ignite-view-container');

    // Show loading state while React loads
    const loadingEl = container.createDiv({ cls: 'ignite-loading' });
    loadingEl.createSpan({ text: 'Loading Ignite...' });

    // Dynamic import to ensure React is loaded
    const { createRoot } = await import('react-dom/client');
    const { IgniteApp } = await import('@/ui/IgniteApp');

    // Remove loading state and mount React
    loadingEl.remove();
    this.root = createRoot(container as HTMLElement);
    this.root.render(<IgniteApp />);
  }

  async onClose(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
