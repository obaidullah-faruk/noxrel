import { config } from '../config.js';

export interface RegisterReplayParams {
  sessionId: string;
  title: string;
  description: string;
  uploaderId: string;
  hlsManifestUrl: string;
  durationSeconds: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retries with exponential backoff. video-service's /internal/videos/from_live
// is idempotent on session_id, so re-sends never create duplicate videos. If
// every attempt fails the caller (finalize) marks the session stitch_failed and
// the reconcile job retries later.
export async function registerReplay(params: RegisterReplayParams): Promise<string> {
  const attempts = 5;
  const baseDelayMs = 1000;
  let lastErr: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(
        `${config.VIDEO_SERVICE_INTERNAL_URL}/internal/videos/from_live`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Key': config.INTERNAL_API_KEY,
          },
          body: JSON.stringify({
            session_id: params.sessionId,
            title: params.title,
            description: params.description,
            uploader_id: params.uploaderId,
            hls_manifest_url: params.hlsManifestUrl,
            duration_seconds: params.durationSeconds,
          }),
        },
      );
      if (!res.ok) throw new Error(`video-service registerReplay failed: ${res.status}`);
      const { id } = (await res.json()) as { id: string };
      return id;
    } catch (err) {
      lastErr = err;
      if (attempt < attempts - 1) {
        await sleep(baseDelayMs * 2 ** attempt);
      }
    }
  }
  throw lastErr;
}
