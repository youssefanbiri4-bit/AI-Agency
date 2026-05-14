'use client';

import { useEffect, useRef } from 'react';
import type { ToastAction } from './toast';
import { toast } from './toast';

interface ActionStateLike {
  error?: string | null;
  message?: string | null;
}

interface UseActionToastOptions<TState extends ActionStateLike> {
  isPending: boolean;
  state: TState;
  loadingMessage: string;
  successMessage?: string | ((state: TState) => string | null | undefined);
  errorMessage?: string | ((state: TState) => string | null | undefined);
  successDescription?: string | ((state: TState) => string | null | undefined);
  errorDescription?: string | ((state: TState) => string | null | undefined);
  successAction?: (state: TState) => ToastAction | undefined;
}

function resolveValue<TState, TValue>(
  value: TValue | ((state: TState) => TValue) | undefined,
  state: TState
) {
  if (typeof value === 'function') {
    return (value as (state: TState) => TValue)(state);
  }

  return value;
}

export function useActionToast<TState extends ActionStateLike>({
  isPending,
  state,
  loadingMessage,
  successMessage,
  errorMessage,
  successDescription,
  errorDescription,
  successAction,
}: UseActionToastOptions<TState>) {
  const previousPendingRef = useRef(false);
  const loadingToastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isPending && !previousPendingRef.current) {
      loadingToastIdRef.current = toast.loading(loadingMessage);
    }

    if (!isPending && previousPendingRef.current) {
      const loadingToastId = loadingToastIdRef.current;
      const isError = Boolean(state.error);

      if (loadingToastId) {
        if (isError) {
          const resolvedErrorDescription = resolveValue(errorDescription, state) ?? undefined;

          toast.update(loadingToastId, {
            tone: 'error',
            title: resolveValue(errorMessage, state) ?? 'Something went wrong. Please try again.',
            description: resolvedErrorDescription,
          });
        } else {
          const resolvedSuccessMessage = resolveValue(successMessage, state);
          const resolvedSuccessDescription =
            resolveValue(successDescription, state) ?? undefined;

          if (resolvedSuccessMessage) {
            toast.update(loadingToastId, {
              tone: 'success',
              title: resolvedSuccessMessage,
              description: resolvedSuccessDescription,
              action: successAction?.(state),
            });
          } else {
            toast.dismiss(loadingToastId);
          }
        }
      } else if (isError) {
        const resolvedErrorDescription = resolveValue(errorDescription, state) ?? undefined;

        toast.error(resolveValue(errorMessage, state) ?? 'Something went wrong. Please try again.', {
          description: resolvedErrorDescription,
        });
      } else {
        const resolvedSuccessMessage = resolveValue(successMessage, state);
        const resolvedSuccessDescription =
          resolveValue(successDescription, state) ?? undefined;

        if (resolvedSuccessMessage) {
          toast.success(resolvedSuccessMessage, {
            description: resolvedSuccessDescription,
            action: successAction?.(state),
          });
        }
      }

      loadingToastIdRef.current = null;
    }

    previousPendingRef.current = isPending;
  }, [
    errorDescription,
    errorMessage,
    isPending,
    loadingMessage,
    state,
    successAction,
    successDescription,
    successMessage,
  ]);
}
