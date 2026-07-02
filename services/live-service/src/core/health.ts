import type { FastifyInstance } from 'fastify';
import { getRedisClient } from '../services/redis.service.js';
import { getKafkaAdmin } from '../services/kafka.service.js';
import { pingMongo } from '../services/mongo.service.js';
import { pool } from '../db/pool.js';

export function registerHealthRoute(app: FastifyInstance): void {
  app.get('/health', async (_req, reply) => {
    const checks: Record<string, boolean> = {
      postgres: false,
      redis: false,
      mongo: false,
      kafka: false,
    };

    try {
      await pool.query('SELECT 1');
      checks.postgres = true;
    } catch {
      // degraded
    }

    try {
      await getRedisClient().ping();
      checks.redis = true;
    } catch {
      // degraded
    }

    checks.mongo = await pingMongo();

    try {
      await getKafkaAdmin().listTopics();
      checks.kafka = true;
    } catch {
      // degraded
    }

    const ok = Object.values(checks).every(Boolean);
    return reply
      .status(ok ? 200 : 503)
      .send({ status: ok ? 'ok' : 'degraded', service: 'live-service', checks });
  });
}
