import { describe, it, expect } from 'vitest';
import {
  parseMediaPlaylist,
  buildReplayMediaPlaylist,
  buildLiveMaster,
  buildReplayMaster,
  orderLadder,
} from '../src/services/hls.js';

describe('parseMediaPlaylist', () => {
  it('extracts seq from filename and real EXTINF durations', () => {
    const playlist = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:2',
      '#EXT-X-MEDIA-SEQUENCE:40',
      '#EXTINF:1.987,',
      '1080p_00040.ts',
      '#EXTINF:2.000,',
      '1080p_00041.ts',
    ].join('\n');

    const segs = parseMediaPlaylist(playlist);
    expect(segs).toEqual([
      { seq: 40, uri: '1080p_00040.ts', duration: 1.987 },
      { seq: 41, uri: '1080p_00041.ts', duration: 2.0 },
    ]);
  });

  it('ignores comments and blank lines', () => {
    expect(parseMediaPlaylist('#EXTM3U\n\n# comment\n')).toEqual([]);
  });
});

describe('buildReplayMediaPlaylist', () => {
  it('preserves segment order and true durations, ends with ENDLIST', () => {
    const out = buildReplayMediaPlaylist([
      { seq: 0, uri: '720p_00000.ts', duration: 2.0 },
      { seq: 1, uri: '720p_00001.ts', duration: 1.5 },
    ]);
    const lines = out.trim().split('\n');
    expect(lines).toContain('#EXT-X-PLAYLIST-TYPE:VOD');
    expect(lines[lines.length - 1]).toBe('#EXT-X-ENDLIST');
    // durations are the real ones, not a hardcoded 2.000
    expect(out).toContain('#EXTINF:1.500,');
    // relative URIs, no CDN domain
    expect(out).not.toContain('http');
    // target duration is the ceil of the max segment duration
    expect(out).toContain('#EXT-X-TARGETDURATION:2');
  });

  it('orders segments as given (sorted by caller)', () => {
    const out = buildReplayMediaPlaylist([
      { seq: 0, uri: 'a.ts', duration: 2 },
      { seq: 1, uri: 'b.ts', duration: 2 },
    ]);
    expect(out.indexOf('a.ts')).toBeLessThan(out.indexOf('b.ts'));
  });
});

describe('master manifests', () => {
  it('orders renditions high→low regardless of input order', () => {
    const master = buildLiveMaster(['360p', '1080p', '720p']);
    expect(master.indexOf('1080p.m3u8')).toBeLessThan(master.indexOf('720p.m3u8'));
    expect(master.indexOf('720p.m3u8')).toBeLessThan(master.indexOf('360p.m3u8'));
  });

  it('replay master points at replay_ playlists with relative URIs', () => {
    const master = buildReplayMaster(['1080p', '480p']);
    expect(master).toContain('replay_1080p.m3u8');
    expect(master).toContain('replay_480p.m3u8');
    expect(master).not.toContain('http');
  });

  it('orderLadder filters and sorts', () => {
    expect(orderLadder(['480p', '1080p'])).toEqual(['1080p', '480p']);
  });
});
