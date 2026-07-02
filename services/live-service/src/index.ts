import Fastify from 'fastify';
import { config } from './config.js';
import { loggerConfig } from './core/logging.js';
import { registerHealthRoute } from './core/health.js';
import { streamKeyRoutes } from './routes/stream-keys.routes.js';
import { sessionRoutes } from './routes/sessions.routes.js';
import { internalRoutes } from './routes/internal.routes.js';
import { attachChat } from './chat/chat.gateway.js';
import { attachIngest } from './ingest/ingest.gateway.js';
import { setFinalizer } from './services/ffmpeg.service.js';
import { finalizeVod } from './handlers/vod-finalize.handler.js';
import { recoverOnStartup, startBackgroundJobs, stopBackgroundJobs } from './services/reconcile.service.js';
import { connectMongo, closeMongo } from './services/mongo.service.js';
import { closeRedis } from './services/redis.service.js';
import { closeKafka } from './services/kafka.service.js';
import { closePool } from './db/pool.js';

const app = Fastify({ logger: loggerConfig });

// Break the ffmpeg ↔ vod-finalize cycle by injecting the finalizer at startup.
setFinalizer(finalizeVod);

app.setErrorHandler(async (error: Error & { statusCode?: number }, _req, reply) => {
  app.log.error({ err: error }, 'unhandled error');
  await reply
    .status(error.statusCode ?? 500)
    .send({ error: error.message ?? 'Internal server error' });
});

registerHealthRoute(app);
await app.register(streamKeyRoutes);
await app.register(sessionRoutes);
await app.register(internalRoutes);

const io = attachChat(app);
attachIngest(io, app);

const start = async (): Promise<void> => {
  try {
    await connectMongo();
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info({ port: config.PORT }, 'live-service listening');

    // Recover sessions orphaned by a previous crash, then start the periodic
    // sweeper / retry / viewer-snapshot jobs.
    await recoverOnStartup();
    startBackgroundJobs();
  } catch (err) {
    app.log.fatal({ err }, 'failed to start');
    process.exit(1);
  }
};

const shutdown = async (): Promise<void> => {
  app.log.info('shutting down');
  stopBackgroundJobs();
  await app.close();
  await closeKafka();
  await closeRedis();
  await closeMongo();
  await closePool();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await start();
