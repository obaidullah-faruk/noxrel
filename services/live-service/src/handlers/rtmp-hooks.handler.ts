import crypto from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import * as streamKeysRepo from '../db/stream-keys.repo.js';
import * as sessionsRepo from '../db/sessions.repo.js';
import * as ffmpeg from '../services/ffmpeg.service.js';
import * as kafka from '../services/kafka.service.js';
import { buildCdnUrl } from '../services/s3.service.js';

interface RtmpBody {
  name?: string; // stream key — nginx-rtmp sends it as the 'name' field
}

// POST /internal/rtmp/on_publish — nginx-rtmp calls this before accepting RTMP.
// A non-2xx reply rejects the broadcaster.
export async function onPublish(
  req: FastifyRequest<{ Body: RtmpBody }>,
  reply: FastifyReply,
): Promise<void> {
  const streamKey = req.body?.name;
  if (!streamKey) {
    await reply.status(400).send('Missing stream key');
    return;
  }

  const keyRecord = await streamKeysRepo.findByKey(streamKey);
  if (!keyRecord || !keyRecord.isActive) {
    await reply.status(403).send('Forbidden');
    return;
  }

  // One active session per key — reject a second concurrent publish.
  const existing = await sessionsRepo.findActiveByStreamKey(streamKey);
  if (existing) {
    await reply.status(409).send('Stream key already live');
    return;
  }

  const sessionId = crypto.randomUUID();
  const s3Prefix = `sessions/${sessionId}`;
  const hlsMasterUrl = buildCdnUrl(`${s3Prefix}/master.m3u8`);

  const session = await sessionsRepo.create({
    id: sessionId,
    streamKeyId: keyRecord.id,
    userId: keyRecord.userId,
    title: keyRecord.title,
    description: keyRecord.description,
    hlsMasterUrl,
    s3Prefix,
  });

  ffmpeg.start(session, streamKey);

  // Answer nginx-rtmp promptly; the hook has a short timeout.
  await reply.send('OK');

  kafka.publishLiveStarted(session).catch(err =>
    req.log.error({ err, sessionId }, 'kafka publish failed — live.started'),
  );
}

// POST /internal/rtmp/on_publish_done — broadcaster disconnected.
export async function onPublishDone(
  req: FastifyRequest<{ Body: RtmpBody }>,
  reply: FastifyReply,
): Promise<void> {
  await reply.send('OK');

  const streamKey = req.body?.name;
  if (!streamKey) return;

  const session = await sessionsRepo.findActiveByStreamKey(streamKey);
  if (!session) return;

  // FFmpeg also exits on its own when the RTMP input ends; this is a safety
  // net. Finalize runs from the FFmpeg 'close' handler either way.
  ffmpeg.stop(session.id);
}
