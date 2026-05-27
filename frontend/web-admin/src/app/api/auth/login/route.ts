import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.API_GATEWAY_URL ?? 'http://localhost:8100';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  let data: { access: string; refresh: string };
  try {
    const upstream = await fetch(`${GATEWAY}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return NextResponse.json({ detail: text }, { status: upstream.status });
    }

    data = await upstream.json();
  } catch {
    return NextResponse.json({ detail: 'Cannot reach auth service.' }, { status: 502 });
  }

  const res = NextResponse.json({ ok: true });

  // httpOnly so JS cannot read it — middleware reads it server-side
  res.cookies.set('admin_access_token', data.access, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15, // 15 min — matches JWT lifetime
  });
  res.cookies.set('admin_refresh_token', data.refresh, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}
