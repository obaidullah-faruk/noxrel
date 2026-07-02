import { finalizeVod } from '../handlers/vod-finalize.handler.js';
import * as ffmpeg from './ffmpeg.service.js';
import * as redis from './redis.service.js';
import * as kafka from './kafka.service.js';
import * as deletePrefixS3 from './s3.service.js';
import * as sessionsRepo from '../db/sessions.repo.js';

const STALE_SECONDS = 60;
const SWEEP_INTERVAL_MS = 60_000;
const RETRY_INTERVAL_MS = 5 * 60_000;
const VIEWER_SNAPSHOT_INTERVAL_MS = 30_000;
const ERROR_TTL_DAYS = 7;

let timers: NodeJS.Timeout[] = [];

// On boot, any session still marked 'live' belongs to a previous process whose
// FFmpeg is gone. Finalize them from whatever reached S3 + the segment index.
export async function recoverOnStartup(): Promise<void> {
  const orphaned = await sessionsRepo.listByStatus('live');
  for (const session of orphaned) {
    if (ffmpeg.isActive(session.id)) continue;
    console.warn({ sessionId: session.id }, 'recovering orphaned live session on startup');
    await finalizeVod(session.id);
  }
}

export function startBackgroundJobs(): void {
  timers.push(setInterval(() => void sweepStale(), SWEEP_INTERVAL_MS));
  timers.push(setInterval(() => void retryStitchFailed(), RETRY_INTERVAL_MS));
  timers.push(setInterval(() => void snapshotViewers(), VIEWER_SNAPSHOT_INTERVAL_MS));
}

export function stopBackgroundJobs(): void {
  timers.forEach(clearInterval);
  timers = [];
}

// Live sessions whose sync loop went quiet — missed on_publish_done or a wedged
// encoder. Drop the publisher (triggers on_publish_done) and finalize.
async function sweepStale(): Promise<void> {
  try {
    const stale = await sessionsRepo.listStaleLive(STALE_SECONDS);
    for (const session of stale) {
      console.warn({ sessionId: session.id }, 'stale live session, sweeping');
      ffmpeg.stop(session.id);
      await finalizeVod(session.id);
    }
  } catch (err) {
    console.error({ err }, 'sweepStale failed');
  }
}

async function retryStitchFailed(): Promise<void> {
  try {
    for (const session of await sessionsRepo.listByStatus('stitch_failed')) {
      console.warn({ sessionId: session.id }, 'retrying failed VOD finalize');
      await finalizeVod(session.id);
    }
    await cleanupErrored();
  } catch (err) {
    console.error({ err }, 'retryStitchFailed failed');
  }
}

// App-driven retention: there is no S3 lifecycle rule. Old errored sessions get
// their segment prefix removed.
async function cleanupErrored(): Promise<void> {
  const errored = await sessionsRepo.listByStatus('error');
  const cutoff = Date.now() - ERROR_TTL_DAYS * 86400 * 1000;
  for (const session of errored) {
    if (session.startedAt.getTime() < cutoff) {
      await deletePrefixS3.deletePrefix(`${session.s3Prefix}/`);
    }
  }
}

async function snapshotViewers(): Promise<void> {
  try {
    for (const session of await sessionsRepo.listLive()) {
      const count = await redis.countViewers(session.id);
      await sessionsRepo.updateViewerCount(session.id, count);
      await kafka.publishViewerCount(session.id, count);
    }
  } catch (err) {
    console.error({ err }, 'snapshotViewers failed');
  }
}
