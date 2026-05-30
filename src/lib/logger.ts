export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
  Fatal = 'fatal',
}

type JsonLike = Record<string, unknown>;

interface LogContext {
  level: LogLevel;
  timestamp: string;
  message: string;
  traceId?: string; // For request/operation tracing
  requestId?: string; // For request correlation
  [key: string]: unknown; // Allow arbitrary context properties
}

function redactSensitiveValue(key: string, value: unknown): unknown {
  const lowerKey = key.toLowerCase();

  if (
    lowerKey.includes('token') ||
    lowerKey.includes('password') ||
    lowerKey.includes('secret') ||
    lowerKey.includes('api_key')
  ) {
    return '[REDACTED]';
  }

  if (lowerKey.includes('email') && typeof value === 'string') {
    const emailParts = value.split('@');
    if (emailParts.length === 2) {
      return `[REDACTED]@${emailParts[1]}`;
    }
    return '[REDACTED]';
  }

  if (value && typeof value === 'object') {
    return redactSensitiveObject(value as unknown);
  }

  return value;
}

// Deep redaction for objects by walking keys.
function redactSensitiveObject(input: unknown): unknown {
  if (input === null || typeof input !== 'object') return input;

  // Deep clone to avoid mutating caller objects
  const clonedObj = JSON.parse(JSON.stringify(input)) as JsonLike;

  for (const key in clonedObj) {
    if (!Object.prototype.hasOwnProperty.call(clonedObj, key)) continue;

    const value = clonedObj[key];
    clonedObj[key] = redactSensitiveValue(key, value);
  }

  return clonedObj;
}

// Function to generate a unique request ID
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Default logger implementation (writes to console)
// In production, this could be overridden to send logs to a centralized system (e.g., Datadog, CloudWatch)
function consoleLogger(context: LogContext): void {
  const timestamp = new Date(context.timestamp).toISOString();
  const baseMessage = `[${timestamp}] [${context.level.toUpperCase()}] ${context.message}`;
  
  const logOutput: Record<string, unknown> = {
    message: baseMessage,
    level: context.level,
    timestamp: timestamp,
  };

  if (context.requestId) logOutput.requestId = context.requestId;
  if (context.traceId) logOutput.traceId = context.traceId;

  // Add other context properties, ensuring redaction (key-aware)
  for (const key in context) {
    if (
      key !== 'level' &&
      key !== 'timestamp' &&
      key !== 'message' &&
      key !== 'requestId' &&
      key !== 'traceId'
    ) {
      logOutput[key] = redactSensitiveValue(key, context[key]);
    }
  }

  switch (context.level) {
    case LogLevel.Debug:
      console.debug(logOutput);
      break;
    case LogLevel.Info:
      console.info(logOutput);
      break;
    case LogLevel.Warn:
      console.warn(logOutput);
      break;
    case LogLevel.Error:
      console.error(logOutput);
      break;
    case LogLevel.Fatal:
      console.error(logOutput); // Fatal often logged as error, then process might exit
      break;
    default:
      console.log(logOutput);
  }
}

// Logger class to manage context and output
export class Logger {
  private readonly requestId: string;
  private readonly traceId?: string;

  constructor(requestId?: string, traceId?: string) {
    this.requestId = requestId ?? generateRequestId();
    this.traceId = traceId;
  }

  private createLogContext(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
  ): LogContext {
    return {
      level,
      timestamp: new Date().toISOString(),
      message,
      requestId: this.requestId,
      traceId: this.traceId,
      ...(data ?? {}),
    };
  }

  debug(message: string, data?: Record<string, unknown>): void {
    consoleLogger(this.createLogContext(LogLevel.Debug, message, data));
  }

  info(message: string, data?: Record<string, unknown>): void {
    consoleLogger(this.createLogContext(LogLevel.Info, message, data));
  }

  warn(message: string, data?: Record<string, unknown>): void {
    consoleLogger(this.createLogContext(LogLevel.Warn, message, data));
  }

  error(message: string, data?: Record<string, unknown>): void {
    consoleLogger(this.createLogContext(LogLevel.Error, message, data));
  }

  fatal(message: string, data?: Record<string, unknown>): void {
    consoleLogger(this.createLogContext(LogLevel.Fatal, message, data));
  }

  // Method to create a child logger with the same request ID but potentially a new trace ID
  child(traceId?: string): Logger {
    return new Logger(this.requestId, traceId);
  }
}

// Export a default logger instance (potentially short-lived request context)
// In a server environment, a request-scoped logger would be preferable.
// For now, a global instance with a generated request ID is used.
export const logger = new Logger();

/**
 * Report an application error with structured logging
 * Sensitive data (tokens, passwords, etc.) are automatically redacted
 * @param message - Human-readable error message
 * @param error - The error object or unknown error
 * @param metadata - Optional additional context to log
 */
export function reportAppError(
  message: string,
  error: Error | unknown,
  metadata?: Record<string, unknown>
): void {
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error(message, {
      errorMessage,
      errorStack,
      ...(metadata && { metadata }),
    });
  } catch (logError) {
    // Prevent logging failures from crashing the app
    console.error('[logger] Failed to report error:', { message, logError });
  }
}

/**
 * Report an application event for observability and monitoring
 * @param eventName - Name of the event (e.g., 'user_login', 'api_call_success')
 * @param data - Optional event-specific data
 */
export function reportAppEvent(
  eventName: string,
  data?: Record<string, unknown>
): void {
  try {
    logger.info(`event:${eventName}`, data || {});
  } catch (logError) {
    // Prevent logging failures from crashing the app
    console.error('[logger] Failed to report event:', { eventName, logError });
  }
}
