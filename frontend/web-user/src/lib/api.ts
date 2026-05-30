import type { PaginatedVideos, Video } from '@/types/video';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:8100';

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
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (res.status === 401 && retry) {
    const newToken = await silentRefresh();
    if (!newToken) redirectToLogin();
    return apiFetch<T>(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers, Authorization: `Bearer ${newToken}` },
    }, false);
  }
  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? '';
    let message: string;
    if (contentType.includes('application/json')) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      message = (body.detail as string) ?? (body.message as string) ?? res.statusText;
    } else {
      message = res.statusText || `Request failed`;
    }
    throw new Error(`${res.status}: ${message}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchCatalogVideos(
  token: string,
  params: { page?: number; page_size?: number; search?: string; category?: string } = {},
): Promise<PaginatedVideos> {
  const qs = new URLSearchParams();
  if (params.page)      qs.set('page', String(params.page));
  if (params.page_size) qs.set('page_size', String(params.page_size));
  if (params.search)    qs.set('search', params.search);
  if (params.category)  qs.set('category', params.category);
  const query = qs.toString() ? `?${qs}` : '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return apiFetch<PaginatedVideos>(`${GATEWAY}/api/v1/catalog/${query}`, { headers }, true);
}

export async function fetchVideo(token: string, videoId: string): Promise<Video> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return apiFetch<Video>(`${GATEWAY}/api/v1/catalog/${videoId}/`, { headers }, true);
}
