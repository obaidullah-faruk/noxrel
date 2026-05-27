import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  const session = await getServerSession();
  const authHeader = session
    ? `Bearer ${session.accessToken}`
    : req.headers.get('Authorization') ?? '';

  const streamingUrl = process.env.STREAMING_SERVICE_URL ?? 'http://localhost:3002';

  const upstream = await fetch(`${streamingUrl}/stream/${videoId}/manifest`, {
    headers: {
      Authorization: authHeader,
      'x-user-id':   session?.userId ?? 'admin',
      'x-user-tier': 'admin',
      'x-request-id': req.headers.get('x-request-id') ?? crypto.randomUUID(),
    },
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/vnd.apple.mpegurl' },
  });
}
