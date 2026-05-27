import type { FastifyRequest, FastifyReply } from 'fastify';
import { savePosition } from '../services/redis.service.js';

interface HeartbeatParams {
  videoId: string;
}

interface HeartbeatBody {
  position: number;
}

export async function heartbeatHandler(
  req: FastifyRequest<{ Params: HeartbeatParams; Body: HeartbeatBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { videoId } = req.params;
  const userId = (req.headers['x-user-id'] as string | undefined) ?? 'anonymous';
  const { position } = req.body;

  if (typeof position !== 'number' || position < 0 || !isFinite(position)) {
    await reply.status(400).send({ error: 'position must be a non-negative finite number' });
    return;
  }

  await savePosition(userId, videoId, position);
  await reply.send({ ok: true });
}
