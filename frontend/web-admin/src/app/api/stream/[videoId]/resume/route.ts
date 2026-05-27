import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
  const session = await getServerSession();
  const streamingUrl = process.env.STREAMING_SERVICE_URL ?? 'http://localhost:3002';

  const upstream = await fetch(`${streamingUrl}/stream/${videoId}/resume`, {
    headers: {
      'x-user-id':   session?.userId ?? 'admin',
      'x-user-tier': 'admin',
    },
  });

  const json = await upstream.json();
  return NextResponse.json(json, { status: upstream.status });
}
