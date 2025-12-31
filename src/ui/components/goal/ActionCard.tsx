import type React from 'react';

import { Button } from '@/ui/components/shared/Button';
import { Card } from '@/ui/components/shared/Card';

export interface ActionCardProps {
  title: string;
  description: string;
  icon?: string;
  onAction: () => void;
  actionLabel?: string;
}

/**
 * Action card component for Discuss and Q&A actions.
 * Displays action with description and button to start.
 */
export const ActionCard: React.FC<ActionCardProps> = ({
  title,
  description,
  icon,
  onAction,
  actionLabel = 'Start',
}) => {
  return (
    <Card className="ignite-action-card">
      <div className="ignite-action-card-content">
        {icon && <span className="ignite-action-card-icon">{icon}</span>}
        <div className="ignite-action-card-text">
          <h4 className="ignite-action-card-title">{title}</h4>
          <p className="ignite-action-card-description">{description}</p>
        </div>
      </div>
      <Button variant="primary" onClick={onAction} className="ignite-action-card-button">
        {actionLabel}
      </Button>
    </Card>
  );
};
