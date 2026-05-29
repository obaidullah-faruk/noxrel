export async function getToken(): Promise<string> {
  const res = await fetch('/api/auth/token', { cache: 'no-store' });
  if (!res.ok) return '';
  const { token } = await res.json();
  return token ?? '';
}
