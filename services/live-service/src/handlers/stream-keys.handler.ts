import type { FastifyRequest, FastifyReply } from 'fastify';
import { ulid } from 'ulid';
import * as streamKeysRepo from '../db/stream-keys.repo.js';
import * as sessionsRepo from '../db/sessions.repo.js';
import { dropPublisher } from '../services/nginx-control.service.js';
import { ForbiddenError } from '../core/exceptions.js';

interface CreateBody {
  title: string;
  description?: string;
}

function requireUserId(req: FastifyRequest): string {
  const userId = req.userId;
  if (!userId) throw new ForbiddenError('Authentication required');
  return userId;
}

export async function createStreamKey(
  req: FastifyRequest<{ Body: CreateBody }>,
  reply: FastifyReply,
): Promise<void> {
  const userId = requireUserId(req);
  const { title, description } = req.body;

  const key = await streamKeysRepo.create({
    userId,
    key: ulid(),
    title,
    description: description ?? '',
  });

  await reply.status(201).send(key);
}

export async function listStreamKeys(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = requireUserId(req);
  const keys = await streamKeysRepo.listByUser(userId);
  await reply.send(keys);
}

export async function revokeStreamKey(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const userId = requireUserId(req);
  const { id } = req.params;

  const key = await streamKeysRepo.findById(id);
  const revoked = await streamKeysRepo.revoke(id, userId);
  if (!revoked) {
    await reply.status(404).send({ error: 'Stream key not found', code: 'NOT_FOUND' });
    return;
  }

  // If this key has a stream in progress, kick the publisher so it ends cleanly.
  if (key) {
    const active = await sessionsRepo.findActiveByStreamKey(key.key);
    if (active) await dropPublisher(key.key);
  }

  await reply.status(204).send();
}
