import type React from 'react';

import { useRouter } from '@/ui/Router';
import { GoalCard } from '@/ui/components/goal';
import { Button, LoadingSpinner } from '@/ui/components/shared';
import { useGoals } from '@/ui/contexts/GoalContext';

/**
 * Home screen displaying list of goals with empty state.
 * Entry point for the application.
 */
export const HomeScreen: React.FC = () => {
  const { goals, loading, error } = useGoals();
  const { navigate } = useRouter();

  const handleGoalClick = (goalId: string) => {
    navigate({ type: 'goal-detail', goalId });
  };

  const handleCreateGoal = () => {
    navigate({ type: 'brainstorm' });
  };

  if (loading) {
    return (
      <div className="ignite-screen ignite-screen--centered">
        <LoadingSpinner size="lg" label="Loading goals..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ignite-screen">
        <div className="ignite-error-message">
          <p>Failed to load goals: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ignite-screen ignite-home-screen">
      <div className="ignite-home-header">
        <h2 className="ignite-home-title">My Learning Goals</h2>
        <Button variant="primary" onClick={handleCreateGoal}>
          Create Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <div className="ignite-empty-state">
          <p className="ignite-empty-state-text">No goals yet</p>
          <p className="ignite-empty-state-subtext">
            Create your first learning goal to get started
          </p>
          <Button variant="primary" onClick={handleCreateGoal}>
            Create Your First Goal
          </Button>
        </div>
      ) : (
        <div className="ignite-goals-list">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onClick={() => handleGoalClick(goal.id)} />
          ))}
        </div>
      )}
    </div>
  );
};
