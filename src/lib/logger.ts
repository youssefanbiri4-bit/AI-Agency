type SafeMetadataValue = string | number | boolean | null;
type SafeMetadata = Record<string, SafeMetadataValue>;

const SENSITIVE_KEY_PATTERN = /password|secret|token|key|authorization|cookie|session|email/i;
const MAX_VALUE_LENGTH = 500;

function sanitizeString(value: string) {
  return value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}...` : value;
}

function sanitizeMetadata(metadata?: Record<string, unknown>): SafeMetadata | undefined {
  if (!metadata) return undefined;

  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return [key, '[redacted]'];
      }

      if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
        return [key, typeof value === 'string' ? sanitizeString(value) : value as SafeMetadataValue];
      }

      return [key, '[object]'];
    })
  ) as SafeMetadata;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: sanitizeString(error.message),
      stack: process.env.NODE_ENV === 'production' ? undefined : sanitizeString(error.stack ?? ''),
    };
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: sanitizeString(error),
    };
  }

  return {
    name: 'UnknownError',
    message: 'An unknown error was reported.',
  };
}

function writeLog(
  level: 'error' | 'info',
  event: string,
  payload: Record<string, unknown> = {}
) {
  const entry = {
    level,
    event: sanitizeString(event),
    timestamp: new Date().toISOString(),
    runtime: typeof window === 'undefined' ? 'server' : 'client',
    ...payload,
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info(JSON.stringify(entry));
  }
}

export function reportAppError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
) {
  writeLog('error', context, {
    error: normalizeError(error),
    metadata: sanitizeMetadata(metadata),
  });
}

export function reportAppEvent(event: string, metadata?: Record<string, unknown>) {
  writeLog('info', event, {
    metadata: sanitizeMetadata(metadata),
  });
}
