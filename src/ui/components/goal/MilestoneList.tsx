import type React from 'react';

import type { Milestone } from '@/domain/goal/types';

export interface MilestoneListProps {
  milestones: Milestone[];
  onToggle?: (milestoneId: string) => void;
  readonly?: boolean;
}

/**
 * Editable milestone list with checkbox toggles.
 * Displays milestones in order with completion status.
 */
export const MilestoneList: React.FC<MilestoneListProps> = ({
  milestones,
  onToggle,
  readonly = false,
}) => {
  const sortedMilestones = [...milestones].sort((a, b) => a.order - b.order);

  const handleToggle = (milestoneId: string) => {
    if (!readonly && onToggle) {
      onToggle(milestoneId);
    }
  };

  return (
    <div className="ignite-milestone-list">
      {sortedMilestones.map((milestone) => (
        <div key={milestone.id} className="ignite-milestone-item">
          <label className="ignite-milestone-label">
            <input
              type="checkbox"
              checked={milestone.completed}
              onChange={() => handleToggle(milestone.id)}
              disabled={readonly}
              className="ignite-milestone-checkbox"
            />
            <span
              className={`ignite-milestone-content ${milestone.completed ? 'ignite-milestone-content--completed' : ''}`}
            >
              {milestone.content}
            </span>
          </label>
        </div>
      ))}
    </div>
  );
};
