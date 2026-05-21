import { stringify } from 'node:querystring'; // Use node: prefix for clarity and safety

export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
  Fatal = 'fatal',
}

interface LogContext {
  level: LogLevel;
  timestamp: string;
  message: string;
  traceId?: string; // For request/operation tracing
  requestId?: string; // For request correlation
  [key: string]: any; // Allow arbitrary context properties
}

// Function to redact sensitive information
// Add patterns for sensitive data like tokens, passwords, PII etc.
function redactSensitiveInfo(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Deep clone to avoid modifying original objects
  const clonedObj = JSON.parse(JSON.stringify(obj));

  for (const key in clonedObj) {
    if (Object.prototype.hasOwnProperty.call(clonedObj, key)) {
      const lowerKey = key.toLowerCase();
      // Basic redaction patterns
      if (lowerKey.includes('token') || lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('api_key')) {
        clonedObj[key] = '[REDACTED]';
      } else if (lowerKey.includes('email') && typeof clonedObj[key] === 'string') {
        // Example: Keep domain but redact username part of email
        const emailParts = clonedObj[key].split('@');
        if (emailParts.length === 2) {
          clonedObj[key] = `[REDACTED]@${emailParts[1]}`;
        } else {
          clonedObj[key] = '[REDACTED]';
        }
      } else if (typeof clonedObj[key] === 'object' && clonedObj[key] !== null) {
        clonedObj[key] = redactSensitiveInfo(clonedObj[key]); // Recurse for nested objects
      }
    }
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
  
  const logOutput: Record<string, any> = {
    message: baseMessage,
    level: context.level,
    timestamp: timestamp,
  };

  if (context.requestId) logOutput.requestId = context.requestId;
  if (context.traceId) logOutput.traceId = context.traceId;

  // Add other context properties, ensuring redaction
  for (const key in context) {
    if (key !== 'level' && key !== 'timestamp' && key !== 'message' && key !== 'requestId' && key !== 'traceId') {
      logOutput[key] = redactSensitiveInfo(context[key]);
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

  private createLogContext(level: LogLevel, message: string, data?: Record<string, any>): LogContext {
    return {
      level,
      timestamp: new Date().toISOString(),
      message,
      requestId: this.requestId,
      traceId: this.traceId,
      ...data,
    };
  }

  debug(message: string, data?: Record<string, any>): void {
    consoleLogger(this.createLogContext(LogLevel.Debug, message, data));
  }

  info(message: string, data?: Record<string, any>): void {
    consoleLogger(this.createLogContext(LogLevel.Info, message, data));
  }

  warn(message: string, data?: Record<string, any>): void {
    consoleLogger(this.createLogContext(LogLevel.Warn, message, data));
  }

  error(message: string, data?: Record<string, any>): void {
    consoleLogger(this.createLogContext(LogLevel.Error, message, data));
  }

  fatal(message: string, data?: Record<string, any>): void {
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
  metadata?: Record<string, any>
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
  data?: Record<string, any>
): void {
  try {
    logger.info(`event:${eventName}`, data || {});
  } catch (logError) {
    // Prevent logging failures from crashing the app
    console.error('[logger] Failed to report event:', { eventName, logError });
  }
}
