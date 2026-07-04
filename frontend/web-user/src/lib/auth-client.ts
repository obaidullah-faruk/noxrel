export interface AuthSession {
  userId: string | null;
  token: string | null;
}

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

async function readTokenCookie(): Promise<AuthSession> {
  const res = await fetch('/api/auth/token', { cache: 'no-store' });
  if (!res.ok) return { userId: null, token: null };
  const data = await res.json() as { token?: string; userId?: string };
  return { userId: data.userId ?? null, token: data.token ?? null };
}

/** Returns a valid access token, refreshing the httpOnly cookie when needed. */
export async function resolveAccessToken(): Promise<string | null> {
  const session = await loadSession();
  return session.token;
}

/** Loads userId + access token from cookies, silently refreshing if access expired. */
export async function loadSession(): Promise<AuthSession> {
  const session = await readTokenCookie();
  if (session.token) return session;

  const refreshed = await silentRefresh();
  if (!refreshed) {
    return { userId: session.userId, token: null };
  }

  const updated = await readTokenCookie();
  return {
    userId: updated.userId ?? session.userId,
    token: updated.token ?? refreshed,
  };
}

export async function getToken(): Promise<string> {
  return (await resolveAccessToken()) ?? '';
}
