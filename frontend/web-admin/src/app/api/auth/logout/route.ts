import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_access_token', '', { maxAge: 0, path: '/' });
  res.cookies.set('admin_refresh_token', '', { maxAge: 0, path: '/' });
  res.cookies.set('admin_user_id', '', { maxAge: 0, path: '/' });
  return res;
}
