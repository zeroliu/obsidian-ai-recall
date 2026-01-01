import { ConversationService } from '@/domain/goal/ConversationService';
import { QAService } from '@/domain/goal/QAService';
import type { Conversation, Goal, QASession } from '@/domain/goal/types';
import { useRouter } from '@/ui/Router';
import { ActionCard } from '@/ui/components/goal/ActionCard';
import { CelebrationBanner } from '@/ui/components/goal/CelebrationBanner';
import { CompletionDialog } from '@/ui/components/goal/CompletionDialog';
import { ConversationList } from '@/ui/components/goal/ConversationList';
import { MilestoneList } from '@/ui/components/goal/MilestoneList';
import { QASessionList } from '@/ui/components/goal/QASessionList';
import { Button } from '@/ui/components/shared/Button';
import { EmptyState } from '@/ui/components/shared/EmptyState';
import { ErrorMessage } from '@/ui/components/shared/ErrorMessage';
import { LoadingSpinner } from '@/ui/components/shared/LoadingSpinner';
import { ProgressBar } from '@/ui/components/shared/ProgressBar';
import { useApp } from '@/ui/contexts/AppContext';
import { useGoals } from '@/ui/contexts/GoalContext';
import { useLLM } from '@/ui/contexts/LLMContext';
import { useCallback, useEffect, useState } from 'react';

/**
 * GoalDetailScreen component props.
 */
export interface GoalDetailScreenProps {
  goalId: string;
}

/**
 * Goal detail screen showing milestones, notes, and action buttons.
 */
export function GoalDetailScreen({ goalId }: GoalDetailScreenProps) {
  const { goals, updateGoal } = useGoals();
  const { navigate, goBack } = useRouter();
  const { vaultProvider } = useApp();
  const { llmProvider } = useLLM();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [qaSessions, setQASessions] = useState<QASession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const goal = goals.find((g: Goal) => g.id === goalId);

  // Load conversations and Q&A sessions
  const loadHistory = useCallback(async () => {
    if (!goal) return;

    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const conversationService = new ConversationService(vaultProvider, llmProvider);
      const qaService = new QAService(vaultProvider, llmProvider);

      const [loadedConversations, loadedSessions] = await Promise.all([
        conversationService.getConversationsForGoal(goalId),
        qaService.getSessionsForGoal(goalId),
      ]);

      setConversations(loadedConversations);
      setQASessions(loadedSessions);
    } catch (error) {
      console.error('Failed to load history:', error);
      setHistoryError(
        error instanceof Error ? error.message : 'Failed to load conversation and Q&A history',
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }, [goalId, goal, vaultProvider, llmProvider]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (!goal) {
    return (
      <div className="ignite-screen ignite-goal-detail-screen">
        <div className="ignite-screen-header">
          <Button variant="secondary" onClick={goBack}>
            ← Back
          </Button>
        </div>
        <div className="ignite-screen-content">
          <EmptyState
            icon="🔍"
            title="Goal not found"
            description="The goal you are looking for does not exist."
            actionLabel="Go Back"
            onAction={goBack}
          />
        </div>
      </div>
    );
  }

  const completedMilestones = goal.milestones.filter((m) => m.completed).length;
  const totalMilestones = goal.milestones.length;
  const allMilestonesCompleted = completedMilestones === totalMilestones && totalMilestones > 0;
  const isGoalCompleted = goal.status === 'completed';

  const handleMilestoneToggle = (milestoneId: string) => {
    const updatedMilestones = goal.milestones.map((m) =>
      m.id === milestoneId ? { ...m, completed: !m.completed } : m,
    );

    updateGoal(goal.id, {
      milestones: updatedMilestones,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDiscuss = () => {
    navigate({ type: 'discuss', goalId: goal.id });
  };

  const handleSelectConversation = (conversationId: string) => {
    navigate({ type: 'discuss', goalId: goal.id, conversationId });
  };

  const handleQA = () => {
    navigate({ type: 'qa', goalId: goal.id });
  };

  const handleSelectSession = (_sessionId: string) => {
    // For now, just start a new session. In the future, this could resume an incomplete session.
    navigate({ type: 'qa', goalId: goal.id });
  };

  const handleCompleteClick = () => {
    setIsCompletionDialogOpen(true);
  };

  const handleConfirmCompletion = async () => {
    setIsCompleting(true);
    try {
      // Mark all milestones as completed
      const completedMilestones = goal.milestones.map((m) => ({ ...m, completed: true }));

      await updateGoal(goal.id, {
        status: 'completed',
        milestones: completedMilestones,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setIsCompleting(false);
      setIsCompletionDialogOpen(false);
    }
  };

  const handleCancelCompletion = () => {
    setIsCompletionDialogOpen(false);
  };

  const deadlineDate = new Date(goal.deadline);
  const formattedDeadline = deadlineDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="ignite-screen ignite-goal-detail-screen">
      <div className="ignite-screen-header">
        <Button variant="secondary" onClick={goBack}>
          ← Back
        </Button>
        {!isGoalCompleted && (
          <Button variant="primary" onClick={handleCompleteClick} disabled={isCompleting}>
            {isCompleting ? 'Completing...' : 'Complete Goal'}
          </Button>
        )}
      </div>

      <div className="ignite-screen-content">
        {isGoalCompleted && <CelebrationBanner goalName={goal.name} completedAt={goal.updatedAt} />}

        <div className="ignite-goal-detail-header">
          <h2 className="ignite-goal-detail-title">{goal.name}</h2>
          {isGoalCompleted && (
            <span className="ignite-goal-badge ignite-goal-badge-completed">Completed</span>
          )}
        </div>

        <p className="ignite-goal-detail-description">{goal.description}</p>

        <div className="ignite-goal-detail-meta">
          <div className="ignite-goal-detail-meta-item">
            <span className="ignite-goal-detail-meta-label">Deadline:</span> {formattedDeadline}
          </div>
          <div className="ignite-goal-detail-meta-item">
            <span className="ignite-goal-detail-meta-label">Assigned Notes:</span>{' '}
            {goal.notesPaths.length}
          </div>
        </div>

        <div className="ignite-goal-detail-section">
          <h3 className="ignite-goal-detail-section-title">Progress</h3>
          <ProgressBar
            value={completedMilestones}
            max={totalMilestones}
            label={`${completedMilestones} of ${totalMilestones} milestones completed`}
            showPercentage={true}
          />
          {allMilestonesCompleted && !isGoalCompleted && (
            <p className="ignite-goal-detail-completion-hint">
              All milestones completed! Ready to mark this goal as complete?
            </p>
          )}
        </div>

        <div className="ignite-goal-detail-section">
          <h3 className="ignite-goal-detail-section-title">Milestones</h3>
          <MilestoneList
            milestones={goal.milestones}
            onToggle={handleMilestoneToggle}
            readonly={isGoalCompleted}
          />
        </div>

        {!isGoalCompleted && (
          <div className="ignite-goal-detail-section">
            <h3 className="ignite-goal-detail-section-title">Actions</h3>
            <div className="ignite-goal-detail-actions">
              <ActionCard
                title="Discuss"
                description="Have a conversation about your learning materials with AI guidance"
                icon="💬"
                onClick={handleDiscuss}
              />
              <ActionCard
                title="Q&A"
                description="Test your knowledge with AI-generated questions from your notes"
                icon="❓"
                onClick={handleQA}
              />
            </div>
          </div>
        )}

        <div className="ignite-goal-detail-section">
          <h3 className="ignite-goal-detail-section-title">Discussion History</h3>
          {isLoadingHistory ? (
            <div className="ignite-loading-inline">
              <LoadingSpinner size="sm" />
              <span>Loading discussions...</span>
            </div>
          ) : historyError ? (
            <ErrorMessage type="general" message={historyError} onRetry={loadHistory} />
          ) : (
            <ConversationList conversations={conversations} onSelect={handleSelectConversation} />
          )}
        </div>

        <div className="ignite-goal-detail-section">
          <h3 className="ignite-goal-detail-section-title">Q&A History</h3>
          {isLoadingHistory ? (
            <div className="ignite-loading-inline">
              <LoadingSpinner size="sm" />
              <span>Loading sessions...</span>
            </div>
          ) : historyError ? (
            <ErrorMessage type="general" message={historyError} onRetry={loadHistory} />
          ) : (
            <QASessionList sessions={qaSessions} onSelect={handleSelectSession} />
          )}
        </div>

        {goal.notesPaths.length > 0 && (
          <div className="ignite-goal-detail-section">
            <h3 className="ignite-goal-detail-section-title">Assigned Notes</h3>
            <ul className="ignite-goal-detail-notes-list">
              {goal.notesPaths.map((path) => (
                <li key={path} className="ignite-goal-detail-notes-item">
                  {path}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <CompletionDialog
        goalName={goal.name}
        isOpen={isCompletionDialogOpen}
        onConfirm={handleConfirmCompletion}
        onCancel={handleCancelCompletion}
      />
    </div>
  );
}
