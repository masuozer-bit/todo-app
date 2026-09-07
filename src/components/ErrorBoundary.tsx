"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** "panel" keeps the failure inside one card instead of taking the page */
  variant?: "page" | "panel";
  /** Shown above the message, e.g. "Tasks" */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.variant === "panel") {
        return (
          <div className="surface border border-border rounded-lg p-6 text-center">
            <p className="text-sm font-medium text-text mb-1">
              {this.props.label ? `${this.props.label}: something went wrong` : "Something went wrong"}
            </p>
            <p className="text-xs text-text-muted dark:text-text-faint mb-4">
              The rest of the app still works. Your data is safe.
            </p>
            <button
              onClick={this.handleReset}
              className="px-3 py-1.5 text-xs rounded-xl btn-primary hover:opacity-80 transition-default font-medium"
            >
              Try again
            </button>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black px-4">
          <div className="text-center max-w-md">
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">!</span>
            </div>
            <h2 className="text-lg font-semibold text-text mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-text-muted dark:text-text-faint mb-6">
              An unexpected error occurred. Your data is safe.
            </p>
            {this.state.error && (
              <pre className="text-xs text-left surface-2 rounded-xl p-3 mb-6 overflow-auto max-h-32 text-gray-600 dark:text-text-faint">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-sm rounded-xl btn-primary hover:opacity-80 transition-default font-medium"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm rounded-xl border border-border text-text-muted hover:text-text transition-default"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
