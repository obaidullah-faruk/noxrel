import { describe, it, expect } from 'vitest';
import { _internal } from '../src/services/ffmpeg.service.js';

const { buildArgs } = _internal;

describe('ffmpeg buildArgs', () => {
  it('produces one valid var_stream_map entry per rendition', () => {
    const args = buildArgs(['-i', 'rtmp://x/live/key'], '/tmp/live/s1', ['1080p', '720p']);
    const mapIdx = args.indexOf('-var_stream_map');
    expect(mapIdx).toBeGreaterThan(-1);
    expect(args[mapIdx + 1]).toBe('v:0,a:0,name:1080p v:1,a:1,name:720p');
  });

  it('writes the master manifest at start via -master_pl_name', () => {
    const args = buildArgs(['-i', 'rtmp://x/live/key'], '/tmp/live/s1', ['720p']);
    const idx = args.indexOf('-master_pl_name');
    expect(idx).toBeGreaterThan(-1);
    expect(args[idx + 1]).toBe('master.m3u8');
  });

  it('splits the video into exactly N scaled outputs', () => {
    const args = buildArgs(['-i', 'rtmp://x/live/key'], '/tmp/live/s1', ['1080p', '720p', '480p']);
    const fc = args[args.indexOf('-filter_complex') + 1]!;
    expect(fc).toContain('split=3');
    expect(fc).toContain('scale=w=1920:h=1080');
    expect(fc).toContain('scale=w=854:h=480');
  });

  it('uses 2 s aligned segments with scene-change keyframes disabled', () => {
    const args = buildArgs(['-i', 'rtmp://x/live/key'], '/tmp/live/s1', ['720p']);
    expect(args[args.indexOf('-hls_time') + 1]).toBe('2');
    expect(args[args.indexOf('-sc_threshold') + 1]).toBe('0');
  });

  it('passes through a stdin (browser ingest) input ahead of the filter graph', () => {
    const args = buildArgs(['-fflags', '+genpts', '-i', 'pipe:0'], '/tmp/live/s1', ['720p']);
    const inputIdx = args.indexOf('-i');
    expect(args[inputIdx + 1]).toBe('pipe:0');
    // input must come before the filter graph FFmpeg builds from it
    expect(inputIdx).toBeLessThan(args.indexOf('-filter_complex'));
  });
});
