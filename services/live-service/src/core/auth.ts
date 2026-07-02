import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyJwt } from './jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    roles?: string[];
  }
}

// preHandler that requires a valid Bearer token and populates req.userId /
// req.roles from the verified claims. Kong forwards the Authorization header;
// this service verifies the RS256 signature itself (Kong does not).
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const claims = await verifyJwt(req.headers.authorization);
    req.userId = claims.sub;
    req.roles = claims.roles ?? [];
  } catch {
    await reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }
}
