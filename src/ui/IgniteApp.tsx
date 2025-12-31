import type React from 'react';

import { ErrorBoundary } from '@/ui/components/shared/ErrorBoundary';

const IgniteAppContent: React.FC = () => {
  return (
    <div style={{ padding: 'var(--ignite-space-4)' }}>
      <h2
        style={{
          color: 'var(--ignite-text)',
          marginBottom: 'var(--ignite-space-2)',
        }}
      >
        Ignite
      </h2>
      <p style={{ color: 'var(--ignite-text-muted)' }}>Plugin is loading...</p>
      <div
        style={{
          marginTop: 'var(--ignite-space-4)',
          padding: 'var(--ignite-space-3)',
          backgroundColor: 'var(--ignite-bg-card)',
          borderRadius: 'var(--ignite-radius-md)',
          border: '1px solid var(--ignite-border)',
        }}
      >
        <p style={{ color: 'var(--ignite-accent)' }}>React is working</p>
        <p
          style={{
            color: 'var(--ignite-text-muted)',
            fontSize: 'var(--ignite-font-size-sm)',
            marginTop: 'var(--ignite-space-2)',
          }}
        >
          CSS variables are mapped correctly
        </p>
      </div>
    </div>
  );
};

export const IgniteApp: React.FC = () => {
  return (
    <ErrorBoundary>
      <div className="ignite-app">
        <IgniteAppContent />
      </div>
    </ErrorBoundary>
  );
};
