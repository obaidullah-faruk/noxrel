import { NextRequest, NextResponse } from 'next/server';

// This route exists so client components can obtain the httpOnly access token
// for outbound Authorization headers. It is restricted to same-origin fetches
// (Sec-Fetch-Site: same-origin) so cross-origin or injected scripts cannot
// exfiltrate the token via a simple fetch() call.
export async function GET(req: NextRequest) {
  const fetchSite = req.headers.get('sec-fetch-site');
  // Allow same-origin browser fetches. In non-browser environments (SSR, tests,
  // curl) the header is absent — also allow those since they can already read
  // cookies directly without going through this route.
  if (fetchSite && fetchSite !== 'same-origin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const token = req.cookies.get('admin_access_token')?.value ?? null;
  return NextResponse.json({ token });
}
