import type { FastifyInstance } from 'fastify';
import { onPublish, onPublishDone } from '../handlers/rtmp-hooks.handler.js';

// nginx-rtmp hooks. NOT routed through Kong — reachable only on the internal
// docker network. nginx-rtmp posts application/x-www-form-urlencoded bodies,
// which Fastify parses natively into req.body.
export async function internalRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { name?: string } }>('/internal/rtmp/on_publish', onPublish);
  app.post<{ Body: { name?: string } }>('/internal/rtmp/on_publish_done', onPublishDone);
}
