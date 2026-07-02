import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Server, Socket } from 'socket.io';
import { ulid } from 'ulid';
import { verifyJwt } from '../core/jwt.js';
import * as streamKeysRepo from '../db/stream-keys.repo.js';
import * as sessionsRepo from '../db/sessions.repo.js';
import * as ffmpeg from '../services/ffmpeg.service.js';
import * as kafka from '../services/kafka.service.js';
import { buildCdnUrl } from '../services/s3.service.js';

// Browser-based "Go Live" ingest. The viewer's browser captures camera/screen
// with MediaRecorder and streams webm chunks over this socket.io namespace;
// we pipe them into a per-session FFmpeg process (stdin) which produces the
// exact same HLS/VOD output as the RTMP path. The stream key is minted server
// side and never shown to the user — they only provide a title.
const NAMESPACE = '/live-ingest';
const MAX_TITLE_LEN = 200;

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function attachIngest(io: Server, fastify: FastifyInstance): void {
  const ns = io.of(NAMESPACE);

  // Identity comes from the verified JWT in the handshake — never a client field.
  ns.use(async (socket, next) => {
    try {
      const claims = await verifyJwt(socket.handshake.auth?.token as string | undefined);
      socket.data.userId = claims.sub;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  ns.on('connection', (socket: Socket) => {
    void startBroadcast(socket, fastify);
  });
}

async function startBroadcast(socket: Socket, fastify: FastifyInstance): Promise<void> {
  const userId = socket.data.userId as string;
  const rawTitle = firstQueryValue(socket.handshake.query.title)?.trim();
  const title = rawTitle ? rawTitle.slice(0, MAX_TITLE_LEN) : 'Live stream';

  let proc: ReturnType<typeof ffmpeg.startBrowser>;
  try {
    const key = await streamKeysRepo.create({ userId, key: ulid(), title, description: '' });
    const sessionId = crypto.randomUUID();
    const s3Prefix = `sessions/${sessionId}`;
    const session = await sessionsRepo.create({
      id: sessionId,
      streamKeyId: key.id,
      userId,
      title,
      description: '',
      hlsMasterUrl: buildCdnUrl(`${s3Prefix}/master.m3u8`),
      s3Prefix,
    });

    proc = ffmpeg.startBrowser(session);
    socket.emit('live_started', { sessionId: session.id, hlsMasterUrl: session.hlsMasterUrl });

    kafka.publishLiveStarted(session).catch(err =>
      fastify.log.error({ err, sessionId }, 'kafka publish failed — live.started'),
    );
  } catch (err) {
    fastify.log.error({ err, userId }, 'failed to start browser broadcast');
    socket.emit('ingest_error', { message: 'Could not start the broadcast.' });
    socket.disconnect(true);
    return;
  }

  socket.on('chunk', (data: ArrayBuffer | Buffer) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (proc.stdin?.writable) proc.stdin.write(buf);
  });

  // Ending stdin makes FFmpeg flush the final segments and exit cleanly, which
  // triggers its close handler → finalizeVod. `stop` and `disconnect` are the
  // same intent (the user stopped, or the tab/connection dropped).
  const end = (): void => {
    if (proc.stdin?.writable) proc.stdin.end();
  };
  socket.on('stop', end);
  socket.on('disconnect', end);
}
