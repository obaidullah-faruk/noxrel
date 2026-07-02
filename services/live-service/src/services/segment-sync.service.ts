import { readFile, unlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import { type Rendition } from '../config.js';
import type { LiveSession } from '../types.js';
import { parseMediaPlaylist, buildLiveMaster, activeRenditions } from './hls.js';
import * as s3 from './s3.service.js';
import * as segmentsRepo from '../db/segments.repo.js';
import * as sessionsRepo from '../db/sessions.repo.js';

interface SyncState {
  timer: NodeJS.Timeout;
  outputDir: string;
  session: LiveSession;
  // seq numbers already uploaded, per rendition — avoids re-uploading.
  uploaded: Map<Rendition, Set<number>>;
  running: boolean;
  masterUploaded: boolean;
}

const SYNC_INTERVAL_MS = 2000;
const active = new Map<string, SyncState>();

export function startLoop(session: LiveSession, outputDir: string): void {
  if (active.has(session.id)) return;
  const state: SyncState = {
    timer: setInterval(() => void tick(session.id), SYNC_INTERVAL_MS),
    outputDir,
    session,
    uploaded: new Map(),
    running: false,
    masterUploaded: false,
  };
  active.set(session.id, state);
}

// Stop the interval and do one final flush so the last segments reach S3.
export async function stopLoop(sessionId: string): Promise<void> {
  const state = active.get(sessionId);
  if (!state) return;
  clearInterval(state.timer);
  await runSync(state);
  active.delete(sessionId);
}

async function tick(sessionId: string): Promise<void> {
  const state = active.get(sessionId);
  if (!state || state.running) return; // skip if previous tick still uploading
  state.running = true;
  try {
    await runSync(state);
  } catch (err) {
    console.error({ err, sessionId }, 'segment sync tick failed');
  } finally {
    state.running = false;
  }
}

async function runSync(state: SyncState): Promise<void> {
  const { session, outputDir } = state;
  let uploadedAny = false;

  // The live master is identical for the whole session — upload once it exists.
  if (!state.masterUploaded) {
    const masterPath = join(outputDir, 'master.m3u8');
    if (await exists(masterPath)) {
      // Prefer FFmpeg's own master; fall back to a built one if absent.
      const body = await readFile(masterPath, 'utf8').catch(() => buildLiveMaster(activeRenditions()));
      await s3.putText(`${session.s3Prefix}/master.m3u8`, body);
      state.masterUploaded = true;
    }
  }

  for (const rendition of activeRenditions()) {
    const playlistPath = join(outputDir, `${rendition}.m3u8`);
    if (!(await exists(playlistPath))) continue;

    const text = await readFile(playlistPath, 'utf8');
    const segments = parseMediaPlaylist(text);

    let done = state.uploaded.get(rendition);
    if (!done) {
      done = new Set();
      state.uploaded.set(rendition, done);
    }

    for (const seg of segments) {
      if (done.has(seg.seq)) continue;
      const localSeg = join(outputDir, seg.uri);
      if (!(await exists(localSeg))) continue; // not flushed to disk yet

      await s3.uploadFile(`${session.s3Prefix}/${seg.uri}`, localSeg);
      await segmentsRepo.record({
        sessionId: session.id,
        rendition,
        seq: seg.seq,
        uri: seg.uri,
        duration: seg.duration,
      });
      done.add(seg.seq);
      uploadedAny = true;

      // Delete the local segment only after a confirmed upload + index write.
      await unlink(localSeg).catch(() => {});
    }

    // Refresh the windowed live playlist on S3 so viewers see new segments.
    await s3.putText(`${session.s3Prefix}/${rendition}.m3u8`, rewriteToRelative(text));
  }

  if (uploadedAny) {
    await sessionsRepo.touchSegment(session.id);
  }
}

// FFmpeg writes absolute local paths for segment URIs only when configured to;
// with hls_segment_filename it uses bare names already. Keep only the basename
// so the published playlist references segments relative to its own prefix.
function rewriteToRelative(playlist: string): string {
  return playlist
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('/')) {
        return trimmed.slice(trimmed.lastIndexOf('/') + 1);
      }
      return line;
    })
    .join('\n');
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export const _internal = { rewriteToRelative };
