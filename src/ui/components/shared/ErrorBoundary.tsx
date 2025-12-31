import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Ignite plugin error:', error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: 'var(--ignite-space-4)',
            color: 'var(--ignite-error)',
          }}
        >
          <h3 style={{ marginBottom: 'var(--ignite-space-2)' }}>Something went wrong</h3>
          <p
            style={{
              color: 'var(--ignite-text-muted)',
              fontSize: 'var(--ignite-font-size-sm)',
            }}
          >
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 'var(--ignite-space-3)',
              padding: 'var(--ignite-space-2) var(--ignite-space-4)',
              backgroundColor: 'var(--ignite-accent)',
              color: 'var(--ignite-text-on-accent)',
              border: 'none',
              borderRadius: 'var(--ignite-radius-md)',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
