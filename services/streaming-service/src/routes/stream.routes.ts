import type { FastifyInstance } from 'fastify';
import { manifestHandler } from '../handlers/manifest.handler.js';
import { heartbeatHandler } from '../handlers/heartbeat.handler.js';
import { resumeHandler } from '../handlers/resume.handler.js';

export async function streamRoutes(app: FastifyInstance): Promise<void> {
  // All routes under /api/v1/stream to match Kong forwarding (strip_path: false)
  app.get<{ Params: { videoId: string } }>(
    '/api/v1/stream/:videoId/manifest',
    {
      schema: {
        params: {
          type: 'object',
          properties: { videoId: { type: 'string' } },
          required: ['videoId'],
        },
      },
    },
    manifestHandler,
  );

  app.post<{ Params: { videoId: string }; Body: { position: number } }>(
    '/api/v1/stream/:videoId/heartbeat',
    {
      schema: {
        params: {
          type: 'object',
          properties: { videoId: { type: 'string' } },
          required: ['videoId'],
        },
        body: {
          type: 'object',
          properties: { position: { type: 'number' } },
          required: ['position'],
        },
      },
    },
    heartbeatHandler,
  );

  app.get<{ Params: { videoId: string } }>(
    '/api/v1/stream/:videoId/resume',
    {
      schema: {
        params: {
          type: 'object',
          properties: { videoId: { type: 'string' } },
          required: ['videoId'],
        },
      },
    },
    resumeHandler,
  );
}
