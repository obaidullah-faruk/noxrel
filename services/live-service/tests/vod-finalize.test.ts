import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock every external dependency of the finalize handler so we can assert its
// orchestration logic (idempotency guard, ordering, registration) in isolation.
const putText = vi.fn(async () => {});
const buildCdnUrl = vi.fn((key: string) => `https://cdn.test/${key}`);
const registerReplay = vi.fn(async () => 'vod-123');
const publishLiveEnded = vi.fn(async () => {});
const clearViewers = vi.fn(async () => {});

const beginStitching = vi.fn();
const markEnded = vi.fn(async () => {});
const markStitchFailed = vi.fn(async () => {});

const renditionsFor = vi.fn(async () => ['720p', '1080p']);
const listSegments = vi.fn();
const totalDuration = vi.fn(async () => 6);

vi.mock('../src/services/s3.service.js', () => ({ putText, buildCdnUrl }));
vi.mock('../src/services/vod-register.service.js', () => ({ registerReplay }));
vi.mock('../src/services/kafka.service.js', () => ({ publishLiveEnded }));
vi.mock('../src/services/redis.service.js', () => ({ clearViewers }));
vi.mock('../src/db/sessions.repo.js', () => ({ beginStitching, markEnded, markStitchFailed }));
vi.mock('../src/db/segments.repo.js', () => ({
  renditionsFor,
  list: listSegments,
  totalDuration,
}));

const SESSION = {
  id: 's1', s3Prefix: 'sessions/s1', title: 'T', description: 'D', userId: 'u1',
};

let finalizeVod: (id: string) => Promise<void>;

beforeEach(async () => {
  vi.clearAllMocks();
  beginStitching.mockResolvedValue(SESSION);
  listSegments.mockImplementation(async (_s: string, r: string) => [
    { seq: 0, uri: `${r}_00000.ts`, duration: 2.0 },
    { seq: 1, uri: `${r}_00001.ts`, duration: 1.5 },
  ]);
  ({ finalizeVod } = await import('../src/handlers/vod-finalize.handler.js'));
});

describe('finalizeVod', () => {
  it('writes a replay playlist per rendition + a master, then registers + ends', async () => {
    await finalizeVod('s1');

    const keys = putText.mock.calls.map(c => c[0]);
    expect(keys).toContain('sessions/s1/replay_1080p.m3u8');
    expect(keys).toContain('sessions/s1/replay_720p.m3u8');
    expect(keys).toContain('sessions/s1/replay_master.m3u8');

    // each rendition playlist uses real durations from the index
    const oneRendition = putText.mock.calls.find(c => c[0] === 'sessions/s1/replay_720p.m3u8')!;
    expect(oneRendition[1]).toContain('#EXTINF:1.500,');

    expect(registerReplay).toHaveBeenCalledOnce();
    expect(markEnded).toHaveBeenCalledWith('s1', {
      vodVideoId: 'vod-123',
      replayUrl: 'https://cdn.test/sessions/s1/replay_master.m3u8',
    });
    expect(publishLiveEnded).toHaveBeenCalledOnce();
  });

  it('no-ops when beginStitching loses the race (returns null)', async () => {
    beginStitching.mockResolvedValueOnce(null);
    await finalizeVod('s1');
    expect(putText).not.toHaveBeenCalled();
    expect(registerReplay).not.toHaveBeenCalled();
  });

  it('marks stitch_failed when no segments were captured', async () => {
    renditionsFor.mockResolvedValueOnce([]);
    await finalizeVod('s1');
    expect(markStitchFailed).toHaveBeenCalledWith('s1');
    expect(registerReplay).not.toHaveBeenCalled();
  });

  it('marks stitch_failed when replay registration fails', async () => {
    registerReplay.mockRejectedValueOnce(new Error('video-service down'));
    await finalizeVod('s1');
    expect(markStitchFailed).toHaveBeenCalledWith('s1');
    expect(markEnded).not.toHaveBeenCalled();
  });
});
