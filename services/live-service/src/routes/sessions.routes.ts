import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../core/auth.js';
import {
  listLiveSessions,
  getSession,
  viewerHeartbeat,
  forceEndSession,
} from '../handlers/sessions.handler.js';

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/live/sessions', listLiveSessions);

  app.get<{ Params: { id: string } }>('/api/v1/live/sessions/:id', getSession);

  app.post<{ Params: { id: string }; Body: { viewerId: string } }>(
    '/api/v1/live/sessions/:id/heartbeat',
    {
      schema: {
        body: {
          type: 'object',
          properties: { viewerId: { type: 'string' } },
          required: ['viewerId'],
        },
      },
    },
    viewerHeartbeat,
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/live/sessions/:id',
    { preHandler: requireAuth },
    forceEndSession,
  );
}
