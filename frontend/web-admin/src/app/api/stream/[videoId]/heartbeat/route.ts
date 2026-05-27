import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
  const session = await getServerSession();
  const streamingUrl = process.env.STREAMING_SERVICE_URL ?? 'http://localhost:3002';

  const body = await req.json();
  const upstream = await fetch(`${streamingUrl}/stream/${videoId}/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id':   session?.userId ?? 'admin',
      'x-user-tier': 'admin',
    },
    body: JSON.stringify(body),
  });

  const json = await upstream.json();
  return NextResponse.json(json, { status: upstream.status });
}
