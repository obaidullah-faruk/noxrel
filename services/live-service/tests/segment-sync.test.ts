import { describe, it, expect } from 'vitest';
import { _internal } from '../src/services/segment-sync.service.js';

const { rewriteToRelative } = _internal;

describe('segment-sync rewriteToRelative', () => {
  it('strips any directory prefix from segment URIs', () => {
    const input = [
      '#EXTM3U',
      '#EXTINF:2.000,',
      '/tmp/live/s1/1080p_00001.ts',
      '#EXTINF:2.000,',
      '1080p_00002.ts',
    ].join('\n');
    const out = rewriteToRelative(input);
    expect(out).toContain('1080p_00001.ts');
    expect(out).not.toContain('/tmp/live');
    // already-relative URIs are untouched
    expect(out).toContain('1080p_00002.ts');
  });

  it('leaves tag lines untouched', () => {
    const input = '#EXT-X-TARGETDURATION:2\n#EXTINF:2.000,';
    expect(rewriteToRelative(input)).toBe(input);
  });
});
