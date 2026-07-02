import type { PaginatedVideos, Video, VideoEditPayload } from '@/types/video';
import type { PaginatedUsers, User } from '@/types/user';
import type { AdminSubscription, Refund } from '@/types/billing';
import type { LiveSession } from '@/types/live';

// All requests go through Kong (port 8100 locally).
// Kong routes /api/v1/* to the appropriate upstream service.
const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:8100';

// Single in-flight refresh promise shared across all concurrent callers.
// Prevents thundering-herd token rotation burns when multiple requests expire simultaneously.
let refreshInFlight: Promise<string | null> | null = null;

async function silentRefresh(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = fetch('/api/auth/refresh', { method: 'POST', cache: 'no-store' })
    .then(async res => {
      if (!res.ok) return null;
      const body = await res.json() as { token?: string };
      return body.token ?? null;
    })
    .catch(() => null)
    .finally(() => { refreshInFlight = null; });

  return refreshInFlight;
}

function redirectToLogin(): never {
  if (typeof window !== 'undefined') {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  throw new Error('Session expired.');
}

// Fail fast on an unreachable gateway instead of letting a request hang.
// In K8s mode a misconfigured gateway URL (e.g. an unroutable minikube IP)
// would otherwise freeze the UI for the OS-level connect timeout (~11s).
const REQUEST_TIMEOUT_MS = 8000;

async function apiFetch<T>(url: string, options: RequestInit = {}, retry = true): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error('Gateway unreachable — request timed out. Is the API gateway running?');
    }
    throw new Error('Cannot reach the API gateway.');
  }

  // On 401, attempt one silent token refresh then replay the original request.
  if (res.status === 401 && retry) {
    const newToken = await silentRefresh();
    if (!newToken) {
      redirectToLogin();
    }
    return apiFetch<T>(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        Authorization: `Bearer ${newToken}`,
      },
    }, false);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Video Service ─────────────────────────────────────────────────────────────

export async function fetchVideos(
  token: string,
  params: { page?: number; page_size?: number; search?: string; status?: string } = {},
): Promise<PaginatedVideos> {
  const qs = new URLSearchParams();
  if (params.page)      qs.set('page', String(params.page));
  if (params.page_size) qs.set('page_size', String(params.page_size));
  if (params.search)    qs.set('search', params.search);
  if (params.status)    qs.set('status', params.status);
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch<PaginatedVideos>(`${GATEWAY}/api/v1/videos/${query}`, {
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
  params: { page?: number; page_size?: number; search?: string } = {},
): Promise<PaginatedUsers> {
  const qs = new URLSearchParams();
  if (params.page)      qs.set('page', String(params.page));
  if (params.page_size) qs.set('page_size', String(params.page_size));
  if (params.search)    qs.set('search', params.search);
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

// ── Billing Service (admin) ─────────────────────────────────────────────────────

export async function fetchAdminSubscriptions(
  token: string,
  params: { page?: number; page_size?: number } = {},
): Promise<AdminSubscription[]> {
  const qs = new URLSearchParams();
  if (params.page)      qs.set('page', String(params.page));
  if (params.page_size) qs.set('page_size', String(params.page_size));
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch<AdminSubscription[]>(`${GATEWAY}/api/v1/billing/admin/subscriptions${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function refundSubscription(
  token: string,
  subscriptionId: string,
  body: { amount_usd?: number; reason?: string } = {},
): Promise<Refund> {
  return apiFetch<Refund>(`${GATEWAY}/api/v1/billing/admin/subscriptions/${subscriptionId}/refund`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

// ── Live Service (admin) ────────────────────────────────────────────────────────

// Public endpoint, but admins use it to monitor every active broadcast.
export async function fetchLiveSessions(token: string): Promise<LiveSession[]> {
  return apiFetch<LiveSession[]>(`${GATEWAY}/api/v1/live/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Admin-only: force-ends a live session and drops the publisher (nginx-rtmp).
export async function forceEndLiveSession(token: string, sessionId: string): Promise<void> {
  await apiFetch<unknown>(`${GATEWAY}/api/v1/live/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Upload ────────────────────────────────────────────────────────────────────

export interface UploadInitPayload {
  title: string;
  description?: string;
  category?: string;
  age_rating?: string;
  tags?: string[];
  file_size_bytes: number;
}

export interface PresignedPart {
  part_number: number;
  url: string;
}

export interface UploadInitResponse {
  video_id: string;
  upload_id: string;
  s3_upload_id: string;
  presigned_parts: PresignedPart[];
  total_parts: number;
}

export interface PartEtag {
  part_number: number;
  etag: string;
}

export async function initUpload(
  token: string,
  payload: UploadInitPayload,
): Promise<UploadInitResponse> {
  return apiFetch<UploadInitResponse>(`${GATEWAY}/api/v1/videos/upload/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function completeUpload(
  token: string,
  upload_id: string,
  part_etags: PartEtag[],
): Promise<{ video_id: string }> {
  return apiFetch<{ video_id: string }>(`${GATEWAY}/api/v1/videos/upload/complete/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ upload_id, part_etags }),
  });
}

export async function uploadPartToS3(
  presignedUrl: string,
  chunk: Blob,
  onProgress?: (loaded: number, total: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag') ?? '';
        resolve(etag.replace(/"/g, ''));
      } else {
        reject(new Error(`Part upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during part upload'));
    xhr.send(chunk);
  });
}
