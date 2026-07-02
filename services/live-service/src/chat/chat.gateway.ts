import type { FastifyInstance } from 'fastify';
import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { config } from '../config.js';
import { verifyJwt } from '../core/jwt.js';
import { getPubSubClients } from '../services/redis.service.js';
import * as chatService from './chat.service.js';

interface ChatPayload {
  sessionId: string;
  message: string;
}

// Attaches a socket.io chat server to the running Fastify HTTP server.
// Identity comes from the verified JWT in the handshake — never from a
// client-supplied field. The redis adapter lets chat scale horizontally.
export function attachChat(fastify: FastifyInstance): Server {
  const io = new Server(fastify.server, {
    path: '/api/v1/live/socket.io',
    cors: { origin: config.NODE_ENV === 'production' ? false : '*' },
    // Raised for the binary MediaRecorder chunks the /live-ingest namespace
    // carries (chat messages are tiny; browser go-live video is not).
    maxHttpBufferSize: 16 * 1024 * 1024,
  });

  const { pubClient, subClient } = getPubSubClients();
  io.adapter(createAdapter(pubClient, subClient));

  io.use(async (socket, next) => {
    try {
      const claims = await verifyJwt(socket.handshake.auth?.token as string | undefined);
      socket.data.userId = claims.sub;
      socket.data.displayName = claims.username ?? 'user';
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket: Socket) => {
    socket.on('join_stream', (sessionId: string) => {
      if (typeof sessionId === 'string') socket.join(sessionId);
    });

    socket.on('chat_message', async ({ sessionId, message }: ChatPayload) => {
      const userId = socket.data.userId as string;
      const displayName = socket.data.displayName as string;

      const allowed = await chatService.checkRateLimit(userId);
      if (!allowed) {
        socket.emit('error', { code: 'RATE_LIMITED' });
        return;
      }

      const clean = chatService.cleanText(message);
      if (!clean) return;

      const payload = { userId, displayName, message: clean, ts: Date.now() };
      io.to(sessionId).emit('chat_message', payload);
      chatService.persist(sessionId, userId, displayName, clean).catch(err =>
        fastify.log.warn({ err, sessionId }, 'chat persist failed'),
      );
    });
  });

  return io;
}
