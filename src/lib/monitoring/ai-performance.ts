import { startSpan, setTag, setContext, type Span } from '@sentry/nextjs';
import { increment, timing } from '@/lib/monitoring/metrics';

interface AIOperationMetrics {
  operation: string;
  model: string;
  provider: string;
  startTime: number;
  inputTokens?: number;
  outputTokens?: number;
  cached?: boolean;
  error?: string;
}

class AIPerformanceMonitor {
  private activeOperations = new Map<string, AIOperationMetrics>();

  startOperation(operationId: string, metrics: Omit<AIOperationMetrics, 'startTime'>): void {
    this.activeOperations.set(operationId, {
      ...metrics,
      startTime: Date.now(),
    });

    setTag('ai.operation', metrics.operation);
    setTag('ai.model', metrics.model);
    setTag('ai.provider', metrics.provider);

    setContext('ai_operation', {
      id: operationId,
      operation: metrics.operation,
      model: metrics.model,
      provider: metrics.provider,
    });
  }

  endOperation(operationId: string, success: boolean, outputTokens?: number): void {
    const metrics = this.activeOperations.get(operationId);
    if (!metrics) return;

    const duration = Date.now() - metrics.startTime;
    this.activeOperations.delete(operationId);

    timing('ai.operation.duration', duration, {
      operation: metrics.operation,
      model: metrics.model,
      provider: metrics.provider,
      success,
      cached: metrics.cached ?? false,
    });

    increment('ai.operation.count', {
      operation: metrics.operation,
      model: metrics.model,
      success,
    });

    if (metrics.inputTokens) {
      timing('ai.tokens.input', metrics.inputTokens, {
        operation: metrics.operation,
        model: metrics.model,
      });
    }

    if (outputTokens) {
      timing('ai.tokens.output', outputTokens, {
        operation: metrics.operation,
        model: metrics.model,
      });
    }

    const totalTokens = (metrics.inputTokens ?? 0) + (outputTokens ?? 0);
    if (totalTokens > 0) {
      timing('ai.tokens.total', totalTokens, {
        operation: metrics.operation,
        model: metrics.model,
      });
    }

    if (metrics.cached) {
      increment('ai.cache.hit', {
        operation: metrics.operation,
        model: metrics.model,
      });
    }
  }

  recordError(operationId: string, error: string): void {
    const metrics = this.activeOperations.get(operationId);
    if (!metrics) return;

    increment('ai.error', {
      operation: metrics.operation,
      model: metrics.model,
      error,
    });
  }

  getActiveOperations(): number {
    return this.activeOperations.size;
  }
}

let monitor: AIPerformanceMonitor | null = null;

export function getAIPerformanceMonitor(): AIPerformanceMonitor {
  if (!monitor) {
    monitor = new AIPerformanceMonitor();
  }
  return monitor;
}

export function traceAIOperation<T>(
  operation: string,
  model: string,
  provider: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return startSpan(
    {
      op: `ai.${operation}`,
      name: `${provider} ${model} ${operation}`,
      attributes: {
        'ai.provider': provider,
        'ai.model': model,
        'ai.operation': operation,
      },
    },
    async (span) => {
      const monitor = getAIPerformanceMonitor();
      const operationId = `${operation}_${Date.now()}`;

      monitor.startOperation(operationId, {
        operation,
        model,
        provider,
      });

      try {
        const result = await fn(span);
        monitor.endOperation(operationId, true);
        return result;
      } catch (error) {
        monitor.recordError(operationId, error instanceof Error ? error.message : 'unknown');
        monitor.endOperation(operationId, false);
        throw error;
      }
    }
  );
}

export function getAIPerformanceStats() {
  const monitor = getAIPerformanceMonitor();
  return {
    activeOperations: monitor.getActiveOperations(),
  };
}
