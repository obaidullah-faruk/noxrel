import { NextRequest, NextResponse } from 'next/server';

// Client components can't read httpOnly cookies directly — they call this
// route to get the access token for Authorization headers.
export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_access_token')?.value ?? null;
  return NextResponse.json({ token });
}
