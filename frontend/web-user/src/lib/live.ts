import type { LiveSession } from '@/types/live';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:8100';

export async function fetchLiveSessions(): Promise<LiveSession[]> {
  const res = await fetch(`${GATEWAY}/api/v1/live/sessions`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`fetchLiveSessions failed: ${res.status}`);
  return res.json();
}

export async function fetchLiveSession(sessionId: string): Promise<LiveSession> {
  const res = await fetch(`${GATEWAY}/api/v1/live/sessions/${sessionId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`fetchLiveSession failed: ${res.status}`);
  return res.json();
}

// Fire-and-forget — viewer count is best-effort.
export async function sendViewerHeartbeat(sessionId: string, viewerId: string): Promise<void> {
  await fetch(`${GATEWAY}/api/v1/live/sessions/${sessionId}/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ viewerId }),
  });
}

// Stable per-browser viewer id for anonymous + logged-in viewers alike.
export function getOrCreateViewerId(): string {
  if (typeof window === 'undefined') return 'server';
  const KEY = 'live_viewer_id';
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
