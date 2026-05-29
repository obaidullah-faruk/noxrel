import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const token = req.cookies.get('user_access_token')?.value ?? null;
  const userId = req.cookies.get('user_user_id')?.value ?? null;
  return NextResponse.json({ token, userId });
}
