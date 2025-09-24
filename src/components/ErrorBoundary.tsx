import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
            <h3 className="text-red-800 font-medium mb-2">Something went wrong</h3>
            <p className="text-red-600 text-sm mb-3">
              The editor encountered an error. Please try switching back to markdown mode.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="text-sm bg-red-100 hover:bg-red-200 px-3 py-1 rounded"
            >
              Try Again
            </button>
            {this.state.error && (
              <details className="mt-3 text-xs text-red-500">
                <summary>Error Details</summary>
                <pre className="mt-1 overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        )
      );
    }

    return this.props.children;
  }
}