import { Redis } from 'ioredis';
import { logger } from '@/lib/logger';

const log = logger.child('queue:redis');

const host = process.env.REDIS_HOST ?? '127.0.0.1';
const port = Number(process.env.REDIS_PORT ?? '6379');

if (Number.isNaN(port)) {
  throw new Error('Invalid REDIS_PORT environment variable');
}

export const redisConnection = {
  host,
  port,
};

export const redis = new Redis({
  ...redisConnection,

  // Production-safe config
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,

  // Reconnect strategy: reconnect on known transient errors
  reconnectOnError: (err) => {
    const message = String((err as unknown as { message?: string })?.message ?? err);
    return (
      message.includes('ECONNRESET') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ETIMEDOUT') ||
      message.includes('READONLY') ||
      message.includes('LOADING')
    );
  },

  // Retry with exponential backoff + cap
  retryStrategy: (times) => {
    const delay = Math.min(2000 * Math.pow(2, times), 30000);
    return delay;
  },
});

// Attach observability handlers (structured logs, no console noise)
redis.on('error', (err: Error) => {
  log.error('Redis client error', { error: err.message });
});

redis.on('connect', () => {
  log.info('Redis connected', { host, port });
});

redis.on('ready', () => {
  log.info('Redis ready', { host, port });
});

redis.on('reconnecting', () => {
  log.warn('Redis reconnecting', { host, port });
});

export const connectRedis = async (): Promise<void> => {
  const status = redis.status;
  if (status === 'ready') return;

  log.info('Connecting redis...', { status, host, port });
  await redis.connect();
};

