import { NextRequest, NextResponse } from 'next/server';
import { streamingHeaders, STREAMING_SERVICE_URL } from '@/lib/streaming';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  const body = await req.json();
  const upstream = await fetch(
    `${STREAMING_SERVICE_URL}/api/v1/stream/${videoId}/heartbeat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...await streamingHeaders() },
      body: JSON.stringify(body),
    },
  );

  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json({ error: text }, { status: upstream.status });
  }

  const contentType = upstream.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json') || upstream.status === 204) {
    return new NextResponse(null, { status: upstream.status });
  }

  const json = await upstream.json();
  return NextResponse.json(json, { status: upstream.status });
}
