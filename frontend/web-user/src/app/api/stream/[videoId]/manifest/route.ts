import { NextRequest, NextResponse } from 'next/server';
import { streamingHeaders, STREAMING_SERVICE_URL } from '@/lib/streaming';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  const upstream = await fetch(
    `${STREAMING_SERVICE_URL}/api/v1/stream/${videoId}/manifest`,
    { headers: await streamingHeaders() },
  );

  if (!upstream.ok) {
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    });
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: 200,
    headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' },
  });
}
