import { Redis } from 'ioredis';
import { config } from '../config.js';

const redis = new Redis(config.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on('error', (err: Error) => {
  console.error({ err }, 'Redis connection error');
});

// socket.io's redis adapter needs its own dedicated pub/sub connections.
let pubClient: Redis | null = null;
let subClient: Redis | null = null;

export function getRedisClient(): Redis {
  return redis;
}

export function getPubSubClients(): { pubClient: Redis; subClient: Redis } {
  if (!pubClient) pubClient = redis.duplicate();
  if (!subClient) subClient = redis.duplicate();
  return { pubClient, subClient };
}

const viewersKey = (sessionId: string) => `live:session:${sessionId}:viewers`;
const chatRateKey = (userId: string) => `chat_rate:${userId}`;

const VIEWER_STALE_MS = 45_000; // 3 missed 15 s beats = gone

export async function recordViewerHeartbeat(sessionId: string, viewerId: string): Promise<void> {
  await redis.zadd(viewersKey(sessionId), Date.now(), viewerId);
}

// Prune stale members, then return the current concurrent-viewer count.
export async function countViewers(sessionId: string): Promise<number> {
  const cutoff = Date.now() - VIEWER_STALE_MS;
  await redis.zremrangebyscore(viewersKey(sessionId), '-inf', cutoff);
  return redis.zcard(viewersKey(sessionId));
}

export async function clearViewers(sessionId: string): Promise<void> {
  await redis.del(viewersKey(sessionId));
}

// 1 message per second per user. INCR returns 1 on the first call in the
// window, after which we set a 1 s expiry; >1 means the user is over the limit.
export async function checkChatRateLimit(userId: string): Promise<boolean> {
  const key = chatRateKey(userId);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 1);
  }
  return count <= 1;
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
  if (pubClient) await pubClient.quit();
  if (subClient) await subClient.quit();
}
