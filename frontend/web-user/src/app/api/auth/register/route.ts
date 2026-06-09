import { NextRequest, NextResponse } from 'next/server';
import { decodePayload, secondsUntilExpiry, setTokenCookies } from '@/lib/jwt-cookies';

const GATEWAY = process.env.API_GATEWAY_URL ?? 'http://localhost:8100';

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    email: string;
    username: string;
    display_name?: string;
    password: string;
    password_confirm: string;
  };

  let data: { access: string; refresh: string };
  try {
    const upstream = await fetch(`${GATEWAY}/api/v1/auth/register`, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      return NextResponse.json(JSON.parse(text), { status: upstream.status });
    }
    data = await upstream.json();
  } catch {
    return NextResponse.json({ detail: 'Cannot reach auth service.' }, { status: 502 });
  }

  const accessPayload = decodePayload(data.access);
  const userId = accessPayload.user_id ?? accessPayload.sub ?? '';

  const res = NextResponse.json({ ok: true });
  setTokenCookies(res, data);
  res.cookies.set('user_user_id', userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: secondsUntilExpiry(data.refresh, 60 * 60 * 24 * 30),
  });
  return res;
}
