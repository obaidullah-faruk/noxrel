import type { FastifyRequest, FastifyReply } from 'fastify';
import { fetchManifestText, buildSegmentUrl } from '../services/s3.service.js';
import { publishVideoViewed } from '../services/kafka.service.js';
import { filterMasterManifest, QUALITY_CAPS } from './quality.js';
import { AppError } from '../core/exceptions.js';

interface ManifestParams {
  videoId: string;
}

export async function manifestHandler(
  req: FastifyRequest<{ Params: ManifestParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { videoId } = req.params;
  const userId = (req.headers['x-user-id'] as string | undefined) ?? 'anonymous';
  const tier   = (req.headers['x-user-tier'] as string | undefined) ?? 'guest';

  let rawManifest: string;
  try {
    rawManifest = await fetchManifestText(videoId);
  } catch (err) {
    if (err instanceof AppError) {
      await reply.status(err.statusCode).send({ error: err.message, code: err.code });
      return;
    }
    req.log.error({ err, videoId }, 's3 fetch failed');
    await reply.status(502).send({ error: 'Upstream error fetching manifest' });
    return;
  }

  if (!rawManifest) {
    await reply.status(404).send({ error: 'Manifest is empty', code: 'EMPTY_MANIFEST' });
    return;
  }

  const maxQuality = QUALITY_CAPS[tier] ?? QUALITY_CAPS['guest']!;
  const filteredManifest = filterMasterManifest(rawManifest, maxQuality);

  // Replace relative paths (e.g. "720p/index.m3u8") with absolute S3 URLs
  const resolvedManifest = filteredManifest
    .split('\n')
    .map(line =>
      /^(240p|480p|720p|1080p|4K)\//.test(line)
        ? buildSegmentUrl(videoId, line)
        : line,
    )
    .join('\n');

  // Fire-and-forget — never fail the manifest request on kafka errors
  publishVideoViewed({ userId, videoId, tier, qualityCap: maxQuality }).catch(err =>
    req.log.error({ err, userId, videoId }, 'kafka publish failed — video.viewed'),
  );

  await reply
    .header('Content-Type', 'application/vnd.apple.mpegurl')
    .header('Cache-Control', 'no-store')
    .send(resolvedManifest);
}
