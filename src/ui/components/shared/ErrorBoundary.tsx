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
    console.error('Recall plugin error:', error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: 'var(--recall-space-4)',
            color: 'var(--recall-error)',
          }}
        >
          <h3 style={{ marginBottom: 'var(--recall-space-2)' }}>Something went wrong</h3>
          <p
            style={{
              color: 'var(--recall-text-muted)',
              fontSize: 'var(--recall-font-size-sm)',
            }}
          >
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 'var(--recall-space-3)',
              padding: 'var(--recall-space-2) var(--recall-space-4)',
              backgroundColor: 'var(--recall-accent)',
              color: 'var(--recall-text-on-accent)',
              border: 'none',
              borderRadius: 'var(--recall-radius-md)',
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
