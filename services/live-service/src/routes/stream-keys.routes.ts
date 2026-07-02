import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../core/auth.js';
import {
  createStreamKey,
  listStreamKeys,
  revokeStreamKey,
} from '../handlers/stream-keys.handler.js';

// Prefixed /api/v1/live to match Kong forwarding (strip_path: false).
export async function streamKeyRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { title: string; description?: string } }>(
    '/api/v1/live/stream-keys',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          properties: { title: { type: 'string' }, description: { type: 'string' } },
          required: ['title'],
        },
      },
    },
    createStreamKey,
  );

  app.get('/api/v1/live/stream-keys', { preHandler: requireAuth }, listStreamKeys);

  app.delete<{ Params: { id: string } }>(
    '/api/v1/live/stream-keys/:id',
    { preHandler: requireAuth },
    revokeStreamKey,
  );
}
