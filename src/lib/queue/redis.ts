import { Redis } from 'ioredis';
import { logger } from '@/lib/logger';

const log = logger.child('queue:redis');

const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

const host = process.env.REDIS_HOST ?? '127.0.0.1';
const port = Number(process.env.REDIS_PORT ?? '6379');

if (Number.isNaN(port) && !isBuildPhase) {
  throw new Error('Invalid REDIS_PORT environment variable');
}

export const redisConnection = {
  host,
  port,
};

function createRedisClient(): Redis {
  if (isBuildPhase) {
    return new Proxy({} as Redis, {
      get(_target, prop) {
        const noop = () => undefined;
        if (prop === 'status') return 'close';
        if (prop === 'connect') return () => Promise.resolve(undefined as unknown as Redis);
        if (prop === 'quit') return () => Promise.resolve('OK');
        if (prop === 'disconnect') return noop;
        if (prop === 'on' || prop === 'once' || prop === 'removeListener') return () => ({} as Redis);
        if (prop === 'then' || prop === 'catch') return undefined;
        return noop;
      },
    }) as Redis;
  }

  const client = new Redis({
    ...redisConnection,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
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
    retryStrategy: (times) => {
      const delay = Math.min(2000 * Math.pow(2, times), 30000);
      return delay;
    },
  });

  client.on('error', (err: Error) => {
    log.error('Redis client error', { error: err.message });
  });
  client.on('connect', () => {
    log.info('Redis connected', { host, port });
  });
  client.on('ready', () => {
    log.info('Redis ready', { host, port });
  });
  client.on('reconnecting', () => {
    log.warn('Redis reconnecting', { host, port });
  });

  return client;
}

const redis = createRedisClient();

export { redis };

export const connectRedis = async (): Promise<void> => {
  if (isBuildPhase) return;
  const status = redis.status;
  if (status === 'ready') return;

  log.info('Connecting redis...', { status, host, port });
  await redis.connect();
};
