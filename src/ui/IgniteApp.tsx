import type React from 'react';

import { Router, useRouter } from '@/ui/Router';
import { ErrorBoundary } from '@/ui/components/shared/ErrorBoundary';
import { GoalDetailScreen, HomeScreen } from '@/ui/screens';

const IgniteAppContent: React.FC = () => {
  const { currentScreen } = useRouter();

  // Render screen based on current route
  switch (currentScreen.type) {
    case 'home':
      return <HomeScreen />;
    case 'goal-detail':
      return <GoalDetailScreen goalId={currentScreen.goalId} />;
    case 'brainstorm':
      // TODO: Implement BrainstormScreen in Phase 3
      return (
        <div className="ignite-screen">
          <p>Brainstorm screen - Coming in Phase 3</p>
        </div>
      );
    case 'discuss':
      // TODO: Implement DiscussScreen in Phase 4
      return (
        <div className="ignite-screen">
          <p>Discuss screen - Coming in Phase 4</p>
        </div>
      );
    case 'qa':
      // TODO: Implement QAScreen in Phase 4
      return (
        <div className="ignite-screen">
          <p>Q&A screen - Coming in Phase 4</p>
        </div>
      );
    default:
      return (
        <div className="ignite-screen">
          <p>Unknown screen</p>
        </div>
      );
  }
};

export const IgniteApp: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router>
        <div className="ignite-app">
          <IgniteAppContent />
        </div>
      </Router>
    </ErrorBoundary>
  );
};
