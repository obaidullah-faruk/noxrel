import type { FastifyRequest, FastifyReply } from 'fastify';
import { getPosition } from '../services/redis.service.js';

interface ResumeParams {
  videoId: string;
}

export async function resumeHandler(
  req: FastifyRequest<{ Params: ResumeParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { videoId } = req.params;
  const userId = (req.headers['x-user-id'] as string | undefined) ?? 'anonymous';

  const position = await getPosition(userId, videoId);
  await reply.send({ position });
}
