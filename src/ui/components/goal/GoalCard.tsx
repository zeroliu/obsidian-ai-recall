import type React from 'react';

import type { Goal } from '@/domain/goal/types';
import { Card } from '@/ui/components/shared/Card';
import { ProgressBar } from '@/ui/components/shared/ProgressBar';

export interface GoalCardProps {
  goal: Goal;
  onClick?: () => void;
}

/**
 * Goal summary card displaying goal name, deadline, and progress.
 * Clickable to navigate to goal detail screen.
 */
export const GoalCard: React.FC<GoalCardProps> = ({ goal, onClick }) => {
  const completedMilestones = goal.milestones.filter((m) => m.completed).length;
  const totalMilestones = goal.milestones.length;

  const deadline = new Date(goal.deadline);
  const formattedDeadline = deadline.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card className="ignite-goal-card" onClick={onClick}>
      <div className="ignite-goal-card-header">
        <h3 className="ignite-goal-card-title">{goal.name}</h3>
        <span className="ignite-goal-card-status">{goal.status}</span>
      </div>
      <p className="ignite-goal-card-description">{goal.description}</p>
      <div className="ignite-goal-card-footer">
        <ProgressBar
          value={completedMilestones}
          max={totalMilestones}
          label={`${completedMilestones}/${totalMilestones} milestones`}
          showPercentage={true}
        />
        <span className="ignite-goal-card-deadline">Due: {formattedDeadline}</span>
      </div>
    </Card>
  );
};
