import type { PaginatedVideos, Video, VideoEditPayload } from '@/types/video';
import type { PaginatedUsers, User } from '@/types/user';

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

async function apiFetch<T>(url: string, options: RequestInit = {}, retry = true): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

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
  params: { page?: number; search?: string; status?: string } = {},
): Promise<PaginatedVideos> {
  const qs = new URLSearchParams();
  if (params.page)   qs.set('page', String(params.page));
  if (params.search) qs.set('search', params.search);
  if (params.status) qs.set('status', params.status);
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
