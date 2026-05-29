import { NextResponse } from 'next/server';

interface JwtPayload {
  user_id?: string;
  sub?: string;
  exp?: number;
  [key: string]: unknown;
}

// Uses atob (available in all runtimes including Edge) instead of Buffer,
// and handles the base64url → base64 alphabet translation.
export function decodePayload(token: string): JwtPayload {
  const [, b64] = token.split('.');
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(padded)) as JwtPayload;
}

// Seconds until the token's exp claim, with a 30-second clock-skew buffer,
// floored to 1 so a fresh token is never treated as already expired.
// Falls back to defaultSeconds if the token has no exp claim.
export function secondsUntilExpiry(token: string, defaultSeconds = 900): number {
  const { exp } = decodePayload(token);
  if (!exp) return defaultSeconds;
  return Math.max(1, exp - Math.floor(Date.now() / 1000) - 30);
}

export function setTokenCookies(
  res: NextResponse,
  tokens: { access: string; refresh?: string },
): void {
  res.cookies.set('user_access_token', tokens.access, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: secondsUntilExpiry(tokens.access, 900),
  });

  if (tokens.refresh) {
    res.cookies.set('user_refresh_token', tokens.refresh, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: secondsUntilExpiry(tokens.refresh, 60 * 60 * 24 * 30),
    });
  }
}
