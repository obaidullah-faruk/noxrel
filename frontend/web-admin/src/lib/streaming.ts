import { getServerSession } from '@/lib/auth';

export const STREAMING_SERVICE_URL =
  process.env.STREAMING_SERVICE_URL ?? 'http://localhost:3002';

export async function streamingHeaders(): Promise<Record<string, string>> {
  const session = await getServerSession();
  return {
    ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    'x-user-id':   session?.userId ?? 'admin',
    'x-user-tier': 'admin',
  };
}
