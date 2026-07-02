import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { config, RENDITION_SPECS, type Rendition } from '../config.js';
import type { LiveSession } from '../types.js';
import { activeRenditions } from './hls.js';
import * as segmentSync from './segment-sync.service.js';
import * as sessionsRepo from '../db/sessions.repo.js';

interface ActiveEntry {
  proc: ChildProcess;
  restarted: boolean;
  killTimer: NodeJS.Timeout;
}

const SCRATCH_ROOT = '/tmp/live';
const active = new Map<string, ActiveEntry>();

// finalize is injected to avoid a circular import (vod-finalize imports nothing
// from here, but the close handler must call into it).
type FinalizeFn = (sessionId: string) => Promise<void>;
let finalizeVod: FinalizeFn = async () => {};
export function setFinalizer(fn: FinalizeFn): void {
  finalizeVod = fn;
}

export function outputDirFor(sessionId: string): string {
  return `${SCRATCH_ROOT}/${sessionId}`;
}

function buildArgs(inputArgs: string[], outputDir: string, renditions: Rendition[]): string[] {
  // filter_complex splits the decoded video into one scaled output per rung.
  const splitLabels = renditions.map((_, i) => `[v${i}]`).join('');
  const splitChain = `[0:v]split=${renditions.length}${splitLabels}`;
  const scaleChains = renditions.map((r, i) => {
    const spec = RENDITION_SPECS[r];
    return `[v${i}]scale=w=${spec.width}:h=${spec.height}[v${i}out]`;
  });

  const args = [...inputArgs, '-filter_complex', [splitChain, ...scaleChains].join(';')];

  // Video maps + encode params, one per rung.
  renditions.forEach((r, i) => {
    const spec = RENDITION_SPECS[r];
    args.push(
      '-map', `[v${i}out]`,
      `-c:v:${i}`, 'libx264',
      `-b:v:${i}`, spec.videoBitrate,
      `-maxrate:v:${i}`, spec.maxrate,
      `-bufsize:v:${i}`, spec.bufsize,
    );
  });

  // One audio rung per video rung (re-encode from the single input audio).
  renditions.forEach((r, i) => {
    const spec = RENDITION_SPECS[r];
    args.push('-map', '0:a', `-c:a:${i}`, 'aac', `-b:a:${i}`, spec.audioBitrate);
  });

  const streamMap = renditions.map((r, i) => `v:${i},a:${i},name:${r}`).join(' ');

  args.push(
    '-ar', '48000',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-g', '48',            // keyframe every 2 s at 24 fps
    '-sc_threshold', '0',  // aligned segments across renditions for clean ABR
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '10',
    '-hls_flags', 'independent_segments',
    '-hls_segment_filename', `${outputDir}/%v_%05d.ts`,
    '-master_pl_name', 'master.m3u8',
    '-var_stream_map', streamMap,
    `${outputDir}/%v.m3u8`,
  );

  return args;
}

// Spawns FFmpeg with the given input args, wires the segment-sync loop, the
// duration cap, and the close handler. `onCrash` (RTMP only) restarts a single
// time after an abnormal exit; browser ingest passes none — a MediaRecorder
// stream cannot be replayed, so a crash just finalizes whatever was captured.
function launch(
  session: LiveSession,
  inputArgs: string[],
  onCrash?: () => void,
): ChildProcess {
  const outputDir = outputDirFor(session.id);
  mkdirSync(outputDir, { recursive: true });

  const ffmpeg = spawn('ffmpeg', buildArgs(inputArgs, outputDir, activeRenditions()));

  const killTimer = setTimeout(() => {
    ffmpeg.kill('SIGTERM');
  }, config.MAX_STREAM_DURATION_HOURS * 3600 * 1000);

  active.set(session.id, { proc: ffmpeg, restarted: !onCrash, killTimer });

  segmentSync.startLoop(session, outputDir);

  ffmpeg.stderr?.on('data', (data: Buffer) => {
    // FFmpeg logs progress to stderr; keep it at debug to avoid noise.
    if (config.LOG_LEVEL === 'trace' || config.LOG_LEVEL === 'debug') {
      console.debug({ sessionId: session.id, ffmpeg: data.toString().trim() });
    }
  });

  ffmpeg.on('error', (err) => {
    console.error({ err, sessionId: session.id }, 'failed to spawn ffmpeg');
  });

  ffmpeg.on('close', async (code) => {
    const entry = active.get(session.id);
    active.delete(session.id);
    if (entry) clearTimeout(entry.killTimer);

    await segmentSync.stopLoop(session.id);

    const stillLive = await sessionsRepo.isLive(session.id);
    if (code !== 0 && stillLive && entry && !entry.restarted && onCrash) {
      console.warn({ sessionId: session.id, code }, 'ffmpeg crashed, restarting once');
      onCrash();
      return;
    }
    await finalizeVod(session.id);
  });

  return ffmpeg;
}

// RTMP ingest (OBS / external encoder via nginx-rtmp).
export function start(session: LiveSession, streamKey: string, isRestart = false): void {
  const rtmpInput = `${config.NGINX_RTMP_URL}/${streamKey}`;
  launch(session, ['-i', rtmpInput], isRestart ? undefined : () => start(session, streamKey, true));
}

// Browser ingest: MediaRecorder webm chunks are written to FFmpeg's stdin as one
// continuous stream. `+genpts` smooths the timestamp gaps between chunks.
export function startBrowser(session: LiveSession): ChildProcess {
  const ffmpeg = launch(session, ['-fflags', '+genpts', '-i', 'pipe:0']);
  // ffmpeg closing its stdin first (e.g. on exit) would otherwise crash us with EPIPE.
  ffmpeg.stdin?.on('error', () => {});
  return ffmpeg;
}

export function stop(sessionId: string): void {
  active.get(sessionId)?.proc.kill('SIGTERM');
}

export function isActive(sessionId: string): boolean {
  return active.has(sessionId);
}

export const _internal = { buildArgs };
