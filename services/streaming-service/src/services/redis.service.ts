import { Redis } from 'ioredis';
import { config } from '../config.js';

const redis = new Redis(config.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on('error', (err: Error) => {
  console.error({ err }, 'Redis connection error');
});

const watchKey = (userId: string, videoId: string) =>
  `watch_pos:${userId}:${videoId}`;

const TTL_SECONDS = 90 * 24 * 3600; // 90 days

export async function savePosition(
  userId: string,
  videoId: string,
  positionSeconds: number,
): Promise<void> {
  await redis.set(watchKey(userId, videoId), positionSeconds, 'EX', TTL_SECONDS);
}

export async function getPosition(
  userId: string,
  videoId: string,
): Promise<number> {
  const val = await redis.get(watchKey(userId, videoId));
  return val !== null ? parseFloat(val) : 0;
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
}
