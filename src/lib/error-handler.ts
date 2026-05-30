import { logger } from './logger';
import * as Sentry from '@sentry/nextjs';

export enum ErrorLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorContext {
  level?: ErrorLevel;
  userId?: string;
  requestId?: string;
  endpoint?: string;
  metadata?: Record<string, unknown>;
  statusCode?: number;
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly level: ErrorLevel = ErrorLevel.MEDIUM,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function handleError(error: unknown, context?: ErrorContext): {
  message: string;
  statusCode: number;
  level: ErrorLevel;
} {
  const errorMessage =
    error instanceof Error ? error.message : String(error);
  const isAppError = error instanceof AppError;
  const statusCode = isAppError ? error.statusCode : 500;
  const level = isAppError ? error.level : ErrorLevel.MEDIUM;

  // Log to structured logger
  logger.error('Application error occurred', {
    message: errorMessage,
    statusCode,
    level,
    stack: error instanceof Error ? error.stack : undefined,
    ...(context?.metadata ?? {}),
  });

  // Report to Sentry for monitoring
  if (typeof window === 'undefined') {
    // Server-side
    Sentry.captureException(error, {
      tags: {
        level,
        endpoint: context?.endpoint,
      },
      contexts: {
        request: {
          url: context?.endpoint,
          headers: {
            'X-Request-ID': context?.requestId,
          },
        },
      },
      user: context?.userId ? { id: context.userId } : undefined,
    });
  } else {
    // Client-side
    Sentry.captureException(error, {
      tags: { level, type: 'client' },
    });
  }

  return {
    message: errorMessage,
    statusCode,
    level,
  };
}

export function createErrorResponse(
  error: unknown,
  context?: ErrorContext
): Response {
  const { message, statusCode } = handleError(error, context);

  return new Response(
    JSON.stringify({
      error: message,
      requestId: context?.requestId,
      timestamp: new Date().toISOString(),
    }),
    {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...(context?.requestId && { 'X-Request-ID': context.requestId }),
      },
    }
  );
}

export function validateRequired<T>(
  value: T | null | undefined,
  fieldName: string
): T {
  if (!value) {
    throw new AppError(
      `${fieldName} is required`,
      400,
      ErrorLevel.LOW,
      { field: fieldName }
    );
  }
  return value;
}

export function validateNotEmpty<T extends { length: number }>(
  value: T,
  fieldName: string
): T {
  if (value.length === 0) {
    throw new AppError(
      `${fieldName} cannot be empty`,
      400,
      ErrorLevel.LOW,
      { field: fieldName }
    );
  }
  return value;
}
