import { NextRequest, NextResponse } from 'next/server';
import { streamingHeaders, STREAMING_SERVICE_URL } from '@/lib/streaming';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  const upstream = await fetch(
    `${STREAMING_SERVICE_URL}/api/v1/stream/${videoId}/resume`,
    { headers: await streamingHeaders() },
  );

  if (!upstream.ok) {
    return NextResponse.json({ position: 0 }, { status: 200 });
  }

  const json = await upstream.json();
  return NextResponse.json(json, { status: 200 });
}
