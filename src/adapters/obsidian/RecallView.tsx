import { ItemView } from 'obsidian';
import type { Root } from 'react-dom/client';

export const RECALL_VIEW_TYPE = 'recall-view';

export class RecallView extends ItemView {
  private root: Root | null = null;

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
