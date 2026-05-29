import { NextRequest, NextResponse } from 'next/server';
import { setTokenCookies } from '@/lib/jwt-cookies';

const GATEWAY = process.env.API_GATEWAY_URL ?? 'http://localhost:8100';

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('user_refresh_token')?.value;
  if (!refreshToken) {
    return NextResponse.json({ detail: 'No refresh token.' }, { status: 401 });
  }

  let data: { access: string; refresh?: string };
  try {
    const upstream = await fetch(`${GATEWAY}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!upstream.ok) {
      return NextResponse.json({ detail: 'Refresh failed.' }, { status: 401 });
    }

    data = await upstream.json();
  } catch {
    return NextResponse.json({ detail: 'Cannot reach auth service.' }, { status: 502 });
  }

  const res = NextResponse.json({ token: data.access });
  setTokenCookies(res, data);
  return res;
}
