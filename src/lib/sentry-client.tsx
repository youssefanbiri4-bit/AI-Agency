'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Initialize Sentry for client-side error tracking and performance monitoring
 * This hook should be called once in the root layout
 */
export function SentrySetup() {
  useEffect(() => {
    // Sentry is automatically initialized by the instrumentation hook
    // This component is here for any additional client-side setup if needed

    // Optional: Set up user context from session
    const setUserContext = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const user = await response.json();
          Sentry.setUser({
            id: user.id,
            email: user.email,
            username: user.email?.split('@')[0],
          });
        }
      } catch (error) {
        // Silently fail if user context can't be set
        void error;
        console.debug('Could not set Sentry user context');
      }
    };

    setUserContext();
  }, []);

  return null; // This component doesn't render anything
}

/**
 * Custom error boundary for catching React component errors
 */
export function SentryErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      {children}
    </Sentry.ErrorBoundary>
  );
}

function ErrorFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600">حدث خطأ</h1>
        <p className="mt-2 text-gray-600">تم تسجيل الخطأ وسيتم تحقق من سببه</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          تحديث الصفحة
        </button>
      </div>
    </div>
  );
}
