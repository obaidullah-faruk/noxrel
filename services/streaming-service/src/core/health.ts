import type { FastifyInstance } from 'fastify';
import { register } from 'prom-client';
import { getRedisClient } from '../services/redis.service.js';
import { getKafkaAdmin } from '../services/kafka.service.js';

export function registerHealthRoute(app: FastifyInstance): void {
  app.get('/metrics', async (_req, reply) => {
    reply.header('content-type', register.contentType);
    return reply.send(await register.metrics());
  });

  app.get('/health', async (_req, reply) => {
    const checks: Record<string, boolean> = { redis: false, kafka: false };

    try {
      await getRedisClient().ping();
      checks.redis = true;
    } catch {
      // degraded
    }

    try {
      const admin = getKafkaAdmin();
      await admin.listTopics();
      checks.kafka = true;
    } catch {
      // degraded
    }

    const ok = Object.values(checks).every(Boolean);
    return reply
      .status(ok ? 200 : 503)
      .send({ status: ok ? 'ok' : 'degraded', service: 'streaming-service', checks });
  });
}
