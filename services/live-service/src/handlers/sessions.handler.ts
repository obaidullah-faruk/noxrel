import type { FastifyRequest, FastifyReply } from 'fastify';
import * as sessionsRepo from '../db/sessions.repo.js';
import * as redis from '../services/redis.service.js';
import { dropPublisher } from '../services/nginx-control.service.js';
import * as streamKeysRepo from '../db/stream-keys.repo.js';
import type { LiveSession } from '../types.js';

// Public-facing shape — never leak the s3 prefix or internal counters wholesale.
function toPublic(session: LiveSession) {
  return {
    id: session.id,
    userId: session.userId,
    status: session.status,
    title: session.title,
    description: session.description,
    hlsMasterUrl: session.hlsMasterUrl,
    vodVideoId: session.vodVideoId,
    replayUrl: session.replayUrl,
    viewerCount: session.viewerCount,
    peakViewerCount: session.peakViewerCount,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
  };
}

export async function listLiveSessions(_req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const sessions = await sessionsRepo.listLive();
  await reply.send(sessions.map(toPublic));
}

export async function getSession(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const session = await sessionsRepo.findById(req.params.id);
  if (!session) {
    await reply.status(404).send({ error: 'Session not found', code: 'NOT_FOUND' });
    return;
  }
  await reply.send(toPublic(session));
}

export async function viewerHeartbeat(
  req: FastifyRequest<{ Params: { id: string }; Body: { viewerId: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = req.params;
  const viewerId = req.body?.viewerId;
  if (!viewerId) {
    await reply.status(400).send({ error: 'viewerId required' });
    return;
  }
  await redis.recordViewerHeartbeat(id, viewerId);
  await reply.status(204).send();
}

// Admin-only force-end: drop the publisher so on_publish_done runs the normal
// finalize path. Requires the 'admin' role on the verified JWT.
export async function forceEndSession(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  if (!req.roles?.includes('admin')) {
    await reply.status(403).send({ error: 'Admin only', code: 'FORBIDDEN' });
    return;
  }
  const session = await sessionsRepo.findById(req.params.id);
  if (!session) {
    await reply.status(404).send({ error: 'Session not found', code: 'NOT_FOUND' });
    return;
  }
  const key = await streamKeysRepo.findById(session.streamKeyId);
  if (key && session.status === 'live') {
    await dropPublisher(key.key);
  }
  await reply.status(202).send({ status: 'ending' });
}
