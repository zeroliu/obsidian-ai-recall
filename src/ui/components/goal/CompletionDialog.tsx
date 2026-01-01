import { Button } from '@/ui/components/shared/Button';
import { Card } from '@/ui/components/shared/Card';
import { useCallback, useEffect } from 'react';

/**
 * CompletionDialog component props.
 */
export interface CompletionDialogProps {
  goalName: string;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Dialog for confirming goal completion.
 * Shows a celebration message and asks for confirmation.
 */
export function CompletionDialog({ goalName, isOpen, onConfirm, onCancel }: CompletionDialogProps) {
  // Handle Escape key to close dialog
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape key handled via useEffect for better UX
    <div className="ignite-dialog-overlay" onClick={onCancel}>
      <Card className="ignite-dialog ignite-completion-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="ignite-completion-dialog-icon">🎉</div>
        <h2 className="ignite-completion-dialog-title">Complete Goal?</h2>
        <p className="ignite-completion-dialog-message">
          Are you sure you want to mark <strong>"{goalName}"</strong> as complete?
        </p>
        <p className="ignite-completion-dialog-description">
          This will mark all milestones as done and celebrate your achievement!
        </p>
        <div className="ignite-dialog-actions">
          <Button variant="secondary" onClick={onCancel}>
            Not Yet
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Complete Goal
          </Button>
        </div>
      </Card>
    </div>
  );
}
