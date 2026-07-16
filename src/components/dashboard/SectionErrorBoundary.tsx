'use client';

import { Component, type ReactNode } from 'react';
import { Notice } from '@/components/ui/Notice';

interface SectionErrorBoundaryProps {
  children: ReactNode;
  /** Human-readable name used in the fallback notice. */
  sectionName: string;
  /** Optional fallback element rendered instead of the default notice. */
  fallback?: ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
}

/**
 * Isolates a single dashboard widget so a render error in one section cannot
 * bubble up to the whole-page error boundary (the "Dashboard recovered safely"
 * fallback). Each section degrades independently and stays recoverable.
 */
export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  state: SectionErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Surfaced to Sentry via the global error handler; keep dashboard usable.
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[dashboard] section "${this.props.sectionName}" failed`, error);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <Notice tone="warning" title={`${this.props.sectionName} is temporarily unavailable`}>
          This panel could not be displayed, but the rest of the dashboard remains fully functional.
          Reload the page to retry this section.
        </Notice>
      );
    }

    return this.props.children;
  }
}
