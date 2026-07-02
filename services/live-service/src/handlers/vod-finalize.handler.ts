import { buildReplayMediaPlaylist, buildReplayMaster, orderLadder } from '../services/hls.js';
import * as s3 from '../services/s3.service.js';
import * as vodRegister from '../services/vod-register.service.js';
import * as kafka from '../services/kafka.service.js';
import * as redis from '../services/redis.service.js';
import * as sessionsRepo from '../db/sessions.repo.js';
import * as segmentsRepo from '../db/segments.repo.js';

// Builds the replay (VOD) playlists from the live_segments index, registers the
// replay with video-service, and ends the session. Idempotent and safe to
// re-run: the 'live|stitch_failed → stitching' transition is atomic, so only
// one caller (FFmpeg close, sweeper, or retry job) proceeds at a time.
export async function finalizeVod(sessionId: string): Promise<void> {
  const session = await sessionsRepo.beginStitching(sessionId);
  if (!session) return; // already ended, or another finalize is in flight

  try {
    const renditions = orderLadder(await segmentsRepo.renditionsFor(sessionId));
    if (renditions.length === 0) {
      // Nothing was ever captured — there is no replay to build.
      await sessionsRepo.markStitchFailed(sessionId);
      return;
    }

    for (const rendition of renditions) {
      const segments = await segmentsRepo.list(sessionId, rendition);
      const playlist = buildReplayMediaPlaylist(
        segments.map(s => ({ seq: s.seq, uri: s.uri, duration: s.duration })),
      );
      await s3.putText(`${session.s3Prefix}/replay_${rendition}.m3u8`, playlist);
    }

    await s3.putText(
      `${session.s3Prefix}/replay_master.m3u8`,
      buildReplayMaster(renditions),
    );

    const replayUrl = s3.buildCdnUrl(`${session.s3Prefix}/replay_master.m3u8`);
    const durationSeconds = await segmentsRepo.totalDuration(sessionId, renditions[0]!);

    const vodVideoId = await vodRegister.registerReplay({
      sessionId: session.id,
      title: session.title,
      description: session.description,
      uploaderId: session.userId,
      hlsManifestUrl: replayUrl,
      durationSeconds,
    });

    await sessionsRepo.markEnded(session.id, { vodVideoId, replayUrl });
    await redis.clearViewers(session.id);
    await kafka.publishLiveEnded(session, vodVideoId, replayUrl);
  } catch (err) {
    console.error({ err, sessionId }, 'VOD finalize failed');
    await sessionsRepo.markStitchFailed(sessionId);
  }
}
