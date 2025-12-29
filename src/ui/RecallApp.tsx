import type React from 'react';

import { ErrorBoundary } from '@/ui/components/shared/ErrorBoundary';

const RecallAppContent: React.FC = () => {
  return (
    <div style={{ padding: 'var(--recall-space-4)' }}>
      <h2
        style={{
          color: 'var(--recall-text)',
          marginBottom: 'var(--recall-space-2)',
        }}
      >
        Recall
      </h2>
      <p style={{ color: 'var(--recall-text-muted)' }}>Plugin is loading...</p>
      <div
        style={{
          marginTop: 'var(--recall-space-4)',
          padding: 'var(--recall-space-3)',
          backgroundColor: 'var(--recall-bg-card)',
          borderRadius: 'var(--recall-radius-md)',
          border: '1px solid var(--recall-border)',
        }}
      >
        <p style={{ color: 'var(--recall-accent)' }}>React is working</p>
        <p
          style={{
            color: 'var(--recall-text-muted)',
            fontSize: 'var(--recall-font-size-sm)',
            marginTop: 'var(--recall-space-2)',
          }}
        >
          CSS variables are mapped correctly
        </p>
      </div>
    </div>
  );
};

export const RecallApp: React.FC = () => {
  return (
    <ErrorBoundary>
      <div className="recall-app">
        <RecallAppContent />
      </div>
    </ErrorBoundary>
  );
};
