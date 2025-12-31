import type React from 'react';

import { useRouter } from '@/ui/Router';
import { ActionCard, MilestoneList } from '@/ui/components/goal';
import { Button, LoadingSpinner } from '@/ui/components/shared';
import { useGoals } from '@/ui/contexts/GoalContext';

export interface GoalDetailScreenProps {
  goalId: string;
}

/**
 * Goal detail screen showing milestones, notes list, and action buttons.
 * Provides access to Discuss and Q&A features.
 */
export const GoalDetailScreen: React.FC<GoalDetailScreenProps> = ({ goalId }) => {
  const { getGoalById, updateMilestones, loading } = useGoals();
  const { navigate, goBack } = useRouter();

  const goal = getGoalById(goalId);

  const handleMilestoneToggle = async (milestoneId: string) => {
    if (!goal) {
      return;
    }

    const updatedMilestones = goal.milestones.map((m) =>
      m.id === milestoneId ? { ...m, completed: !m.completed } : m,
    );

    await updateMilestones(goalId, updatedMilestones);
  };

  const handleDiscuss = () => {
    navigate({ type: 'discuss', goalId });
  };

  const handleQA = () => {
    navigate({ type: 'qa', goalId });
  };

  if (loading) {
    return (
      <div className="ignite-screen ignite-screen--centered">
        <LoadingSpinner size="lg" label="Loading goal..." />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="ignite-screen">
        <div className="ignite-error-message">
          <p>Goal not found</p>
          <Button variant="secondary" onClick={goBack}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const completedMilestones = goal.milestones.filter((m) => m.completed).length;
  const totalMilestones = goal.milestones.length;
  const deadline = new Date(goal.deadline);
  const formattedDeadline = deadline.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="ignite-screen ignite-goal-detail-screen">
      <div className="ignite-goal-detail-header">
        <Button variant="secondary" onClick={goBack} className="ignite-back-button">
          Back
        </Button>
      </div>

      <div className="ignite-goal-detail-content">
        <div className="ignite-goal-detail-info">
          <h2 className="ignite-goal-detail-title">{goal.name}</h2>
          <span className="ignite-goal-detail-status">{goal.status}</span>
          <p className="ignite-goal-detail-description">{goal.description}</p>
          <div className="ignite-goal-detail-meta">
            <span>
              Deadline: <strong>{formattedDeadline}</strong>
            </span>
            <span>
              Progress:{' '}
              <strong>
                {completedMilestones}/{totalMilestones} milestones
              </strong>
            </span>
          </div>
        </div>

        <div className="ignite-goal-detail-section">
          <h3 className="ignite-section-title">Milestones</h3>
          {goal.milestones.length > 0 ? (
            <MilestoneList milestones={goal.milestones} onToggle={handleMilestoneToggle} />
          ) : (
            <p className="ignite-empty-state-text">No milestones defined</p>
          )}
        </div>

        <div className="ignite-goal-detail-section">
          <h3 className="ignite-section-title">Assigned Notes</h3>
          {goal.notesPaths.length > 0 ? (
            <div className="ignite-notes-list">
              {goal.notesPaths.map((notePath) => (
                <div key={notePath} className="ignite-note-item">
                  {notePath}
                </div>
              ))}
            </div>
          ) : (
            <p className="ignite-empty-state-text">No notes assigned</p>
          )}
        </div>

        <div className="ignite-goal-detail-section">
          <h3 className="ignite-section-title">Actions</h3>
          <div className="ignite-actions-grid">
            <ActionCard
              title="Discuss"
              description="Have a conversation with AI about your learning materials"
              icon="💬"
              onAction={handleDiscuss}
              actionLabel="Start Discussion"
            />
            <ActionCard
              title="Q&A Session"
              description="Test your knowledge with AI-generated questions"
              icon="❓"
              onAction={handleQA}
              actionLabel="Start Quiz"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
