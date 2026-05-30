import Fastify from 'fastify';
import { config } from './config.js';
import { loggerConfig } from './core/logging.js';
import { registerHealthRoute } from './core/health.js';
import { registerMetrics } from './core/metrics.js';
import { streamRoutes } from './routes/stream.routes.js';
import { closeRedis } from './services/redis.service.js';
import { closeKafka } from './services/kafka.service.js';

const app = Fastify({ logger: loggerConfig });

// Global error handler
app.setErrorHandler(async (error: Error & { statusCode?: number }, _req, reply) => {
  app.log.error({ err: error }, 'unhandled error');
  await reply
    .status(error.statusCode ?? 500)
    .send({ error: error.message ?? 'Internal server error' });
});

// Metrics hooks must be registered before routes so they observe every request
registerMetrics(app);

// Routes
registerHealthRoute(app);
await app.register(streamRoutes);

const start = async () => {
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info({ port: config.PORT }, 'streaming-service listening');
  } catch (err) {
    app.log.fatal({ err }, 'failed to start');
    process.exit(1);
  }
};

const shutdown = async () => {
  app.log.info('shutting down');
  await app.close();
  await closeRedis();
  await closeKafka();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await start();
