// Client-safe auth helpers — no server-only imports.
// Client components cannot read httpOnly cookies directly; this fetches the
// token from a local API route that reads it server-side.
export async function getToken(): Promise<string> {
  const res = await fetch('/api/auth/token', { cache: 'no-store' });
  if (!res.ok) return '';
  const { token } = await res.json();
  return token ?? '';
}
