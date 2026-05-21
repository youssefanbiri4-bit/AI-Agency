'use client';

import { Component, type ComponentType, type ErrorInfo, type ReactNode } from 'react';

type RouteFallbackRenderer = (props: {
  error: Error;
  componentStack: string | null;
  resetBoundary: () => void;
}) => ReactNode;

// Props for the error boundary component
export interface RouteErrorBoundaryProps {
  /** Fallback UI to show when an error occurs */
  fallback: ReactNode;
  /** Optional fallback renderer with access to the caught error */
  renderFallback?: RouteFallbackRenderer;
  /** Children components to wrap with error boundary */
  children: ReactNode;
  /** Optional error callback for logging/reporting */
  onError?: (error: Error, info: { componentStack: string }) => void;
  /** Whether to reset the error boundary after a delay */
  resetOnTimeout?: number; // milliseconds
}

// State for the error boundary
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  resetTimeout: ReturnType<typeof setTimeout> | null;
}

/**
 * Route-level error boundary for isolating errors in specific routes
 * Prevents entire dashboard crashes from isolated component failures
 */
export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: null,
      resetTimeout: null,
    };
  }

  private resetBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      componentStack: null,
      resetTimeout: null,
    });
  };

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Update state to show fallback UI
    this.setState({
      hasError: true,
      error,
      componentStack: info.componentStack ?? null,
    });

    // Log error to console
    console.error('RouteErrorBoundary caught an error:', error, info);

    // Call user-provided error callback if available
    if (this.props.onError) {
      try {
        this.props.onError(error, { componentStack: info.componentStack ?? '' });
      } catch (callbackError) {
        console.error('Error in onError callback:', callbackError);
      }
    }

    // Set up auto-reset if configured
    if (this.props.resetOnTimeout && this.props.resetOnTimeout > 0) {
      const resetTimeout = setTimeout(() => {
        this.resetBoundary();
      }, this.props.resetOnTimeout);
      this.setState({ resetTimeout });
    }
  }

  componentWillUnmount() {
    // Clear any pending reset timeout
    if (this.state.resetTimeout) {
      clearTimeout(this.state.resetTimeout);
    }
  }

  render() {
    // If error occurred, show fallback UI
    if (this.state.hasError) {
      if (this.props.renderFallback && this.state.error) {
        return this.props.renderFallback({
          error: this.state.error,
          componentStack: this.state.componentStack,
          resetBoundary: this.resetBoundary,
        });
      }

      return this.props.fallback;
    }

    // Otherwise, render children normally
    return this.props.children;
  }
}

/**
 * Wrapper function for easier usage with TypeScript inference
 */
export function withRouteErrorBoundary<
  P extends Record<string, unknown>
>(
  Component: ComponentType<P>,
  fallback: (props: P & { error: Error; resetBoundary: () => void }) => ReactNode,
  options?: Omit<RouteErrorBoundaryProps, 'fallback' | 'renderFallback' | 'children'>
) {
  return function WrappedComponent(props: P) {
    return (
      <RouteErrorBoundary
        fallback={null}
        renderFallback={({ error, resetBoundary }) => fallback({ ...props, error, resetBoundary })}
        {...options}
      >
        <Component {...props} />
      </RouteErrorBoundary>
    );
  };
}
