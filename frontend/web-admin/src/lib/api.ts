import type { PaginatedVideos, Video, VideoEditPayload } from '@/types/video';
import type { PaginatedUsers, User } from '@/types/user';

// All requests go through Kong (port 8100 locally).
// Kong routes /api/v1/* to the appropriate upstream service.
const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:8100';

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Video Service ─────────────────────────────────────────────────────────────

export async function fetchVideos(
  token: string,
  params: { page?: number; search?: string; status?: string } = {},
): Promise<PaginatedVideos> {
  const qs = new URLSearchParams();
  if (params.page)   qs.set('page', String(params.page));
  if (params.search) qs.set('search', params.search);
  if (params.status) qs.set('status', params.status);
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch<PaginatedVideos>(`${GATEWAY}/api/v1/catalog/${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function fetchVideo(token: string, videoId: string): Promise<Video> {
  return apiFetch<Video>(`${GATEWAY}/api/v1/videos/${videoId}/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateVideo(
  token: string,
  videoId: string,
  payload: VideoEditPayload,
): Promise<Video> {
  return apiFetch<Video>(`${GATEWAY}/api/v1/videos/${videoId}/`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function publishVideo(token: string, videoId: string): Promise<void> {
  await apiFetch<unknown>(`${GATEWAY}/api/v1/videos/${videoId}/publish/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── User Service ──────────────────────────────────────────────────────────────

export async function fetchUsers(
  token: string,
  params: { page?: number; search?: string } = {},
): Promise<PaginatedUsers> {
  const qs = new URLSearchParams();
  if (params.page)   qs.set('page', String(params.page));
  if (params.search) qs.set('search', params.search);
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch<PaginatedUsers>(`${GATEWAY}/api/v1/users${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function fetchUser(token: string, userId: string): Promise<User> {
  return apiFetch<User>(`${GATEWAY}/api/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
