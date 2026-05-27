import { describe, it, expect } from 'vitest';
import {
  filterMasterManifest,
  QUALITY_CAPS,
  QUALITY_ORDER,
} from '../src/handlers/quality.js';

const SAMPLE_MANIFEST = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=426x240
240p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480
480p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=1280x720
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1920x1080
1080p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=3840x2160
4K/index.m3u8`;

describe('QUALITY_CAPS', () => {
  it('maps every role to a valid quality', () => {
    for (const [_role, cap] of Object.entries(QUALITY_CAPS)) {
      expect(QUALITY_ORDER).toContain(cap);
    }
  });

  it('guest gets lowest cap', () => {
    expect(QUALITY_CAPS['guest']).toBe('240p');
  });

  it('premium_subscriber and admin get 4K', () => {
    expect(QUALITY_CAPS['premium_subscriber']).toBe('4K');
    expect(QUALITY_CAPS['admin']).toBe('4K');
  });
});

describe('filterMasterManifest', () => {
  it('returns only 240p for guest', () => {
    const result = filterMasterManifest(SAMPLE_MANIFEST, '240p');
    expect(result).toContain('240p/index.m3u8');
    expect(result).not.toContain('480p/index.m3u8');
    expect(result).not.toContain('720p/index.m3u8');
    expect(result).not.toContain('1080p/index.m3u8');
    expect(result).not.toContain('4K/index.m3u8');
  });

  it('returns up to 480p for free_trial', () => {
    const result = filterMasterManifest(SAMPLE_MANIFEST, '480p');
    expect(result).toContain('240p/index.m3u8');
    expect(result).toContain('480p/index.m3u8');
    expect(result).not.toContain('720p/index.m3u8');
    expect(result).not.toContain('1080p/index.m3u8');
  });

  it('returns up to 1080p for basic_subscriber', () => {
    const result = filterMasterManifest(SAMPLE_MANIFEST, '1080p');
    expect(result).toContain('240p/index.m3u8');
    expect(result).toContain('480p/index.m3u8');
    expect(result).toContain('720p/index.m3u8');
    expect(result).toContain('1080p/index.m3u8');
    expect(result).not.toContain('4K/index.m3u8');
  });

  it('returns all qualities for premium_subscriber (4K)', () => {
    const result = filterMasterManifest(SAMPLE_MANIFEST, '4K');
    expect(result).toContain('240p/index.m3u8');
    expect(result).toContain('480p/index.m3u8');
    expect(result).toContain('720p/index.m3u8');
    expect(result).toContain('1080p/index.m3u8');
    expect(result).toContain('4K/index.m3u8');
  });

  it('preserves EXTM3U and VERSION headers', () => {
    const result = filterMasterManifest(SAMPLE_MANIFEST, '720p');
    expect(result).toContain('#EXTM3U');
    expect(result).toContain('#EXT-X-VERSION:3');
  });

  it('preserves EXT-X-STREAM-INF tags for allowed qualities', () => {
    const result = filterMasterManifest(SAMPLE_MANIFEST, '480p');
    const streamInfCount = (result.match(/#EXT-X-STREAM-INF/g) ?? []).length;
    expect(streamInfCount).toBe(2); // 240p + 480p
  });

  it('handles empty manifest gracefully', () => {
    const result = filterMasterManifest('', '4K');
    expect(result).toBe('');
  });

  it('handles manifest with no stream variants', () => {
    const headerOnly = '#EXTM3U\n#EXT-X-VERSION:3\n';
    const result = filterMasterManifest(headerOnly, '1080p');
    expect(result).toContain('#EXTM3U');
  });

  it('ignores unknown quality tokens in URIs', () => {
    const manifest = `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=400000\nunknown/index.m3u8`;
    const result = filterMasterManifest(manifest, '4K');
    // URI with unknown quality should be filtered out
    expect(result).not.toContain('unknown/index.m3u8');
  });
});
