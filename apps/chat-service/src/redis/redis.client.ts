import { logger } from "@shared/src/Logger";
import Redis from 'ioredis';

let redis: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL!, {
      lazyConnect: true,
      maxRetriesPerRequest: null, // important for pub/sub & microservices
      enableReadyCheck: true,
    });

    redis.on('error', (error) => {
      logger.error( 'Redis connection error');
    });

    redis.on('connect', () => {
      logger.info('Redis connection established');
    });

    redis.on('ready', () => {
      logger.info('Redis client ready');
    });

    redis.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    redis.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  return redis;
};

export const connectRedis = async (): Promise<void> => {
  const client = getRedisClient();

  if (client.status === 'ready' || client.status === 'connecting') {
    return;
  }

  await client.connect();
};

export const closeRedis = async (): Promise<void> => {
  if (!redis) return;

  await redis.quit();
  redis = null;
};
