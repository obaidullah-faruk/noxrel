import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the service modules before importing the handler
vi.mock('../src/services/s3.service.js', () => ({
  fetchManifestText: vi.fn(),
  buildSegmentUrl: vi.fn((videoId: string, path: string) =>
    `http://localhost:4566/transcoded-videos/${videoId}/${path}`,
  ),
}));

vi.mock('../src/services/kafka.service.js', () => ({
  publishVideoViewed: vi.fn().mockResolvedValue(undefined),
}));

import { fetchManifestText } from '../src/services/s3.service.js';
import { manifestHandler } from '../src/handlers/manifest.handler.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

const SAMPLE_MANIFEST = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=426x240
240p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480
480p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=1280x720
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1920x1080
1080p/index.m3u8`;

function makeReply() {
  const reply = {
    _status: 200,
    _headers: {} as Record<string, string>,
    _body: null as unknown,
    status(code: number) {
      this._status = code;
      return this;
    },
    header(key: string, value: string) {
      this._headers[key] = value;
      return this;
    },
    send(body: unknown) {
      this._body = body;
      return Promise.resolve();
    },
  };
  return reply;
}

function makeRequest(overrides: Partial<{
  videoId: string;
  userId: string;
  tier: string;
}> = {}) {
  return {
    params: { videoId: overrides.videoId ?? 'video-123' },
    headers: {
      'x-user-id': overrides.userId ?? 'user-abc',
      'x-user-tier': overrides.tier ?? 'basic_subscriber',
    },
    log: { error: vi.fn(), info: vi.fn() },
  } as unknown as FastifyRequest<{ Params: { videoId: string } }>;
}

describe('manifestHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns filtered manifest for basic_subscriber (up to 1080p)', async () => {
    vi.mocked(fetchManifestText).mockResolvedValueOnce(SAMPLE_MANIFEST);
    const req = makeRequest({ tier: 'basic_subscriber' });
    const reply = makeReply();

    await manifestHandler(req, reply as unknown as FastifyReply);

    expect(reply._status).toBe(200);
    expect(reply._headers['Content-Type']).toBe('application/vnd.apple.mpegurl');
    const body = reply._body as string;
    expect(body).toContain('240p');
    expect(body).toContain('480p');
    expect(body).toContain('720p');
    expect(body).toContain('1080p');
    // Paths should be resolved to absolute URLs
    expect(body).toContain('http://localhost:4566');
    expect(body).not.toContain('4K');
  });

  it('caps guest to 240p only', async () => {
    vi.mocked(fetchManifestText).mockResolvedValueOnce(SAMPLE_MANIFEST);
    const req = makeRequest({ tier: 'guest' });
    const reply = makeReply();

    await manifestHandler(req, reply as unknown as FastifyReply);

    const body = reply._body as string;
    expect(body).toContain('240p');
    expect(body).not.toContain('480p');
    expect(body).not.toContain('1080p');
  });

  it('returns 404 when manifest not found', async () => {
    const { NotFoundError } = await import('../src/core/exceptions.js');
    vi.mocked(fetchManifestText).mockRejectedValueOnce(
      new NotFoundError('Manifest not found for video missing-id'),
    );
    const req = makeRequest({ videoId: 'missing-id' });
    const reply = makeReply();

    await manifestHandler(req, reply as unknown as FastifyReply);

    expect(reply._status).toBe(404);
  });

  it('returns 502 on unexpected S3 error', async () => {
    vi.mocked(fetchManifestText).mockRejectedValueOnce(new Error('Network error'));
    const req = makeRequest();
    const reply = makeReply();

    await manifestHandler(req, reply as unknown as FastifyReply);

    expect(reply._status).toBe(502);
  });

  it('uses guest tier when x-user-tier header is missing', async () => {
    vi.mocked(fetchManifestText).mockResolvedValueOnce(SAMPLE_MANIFEST);
    const req = {
      params: { videoId: 'video-123' },
      headers: {},
      log: { error: vi.fn(), info: vi.fn() },
    } as unknown as FastifyRequest<{ Params: { videoId: string } }>;
    const reply = makeReply();

    await manifestHandler(req, reply as unknown as FastifyReply);

    const body = reply._body as string;
    expect(body).toContain('240p');
    expect(body).not.toContain('480p');
  });
});
