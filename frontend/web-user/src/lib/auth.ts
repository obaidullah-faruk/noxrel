import { cookies } from 'next/headers';

export interface Session {
  accessToken: string;
  userId: string;
}

export async function getServerSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('user_access_token')?.value;
  const userId = cookieStore.get('user_user_id')?.value;
  if (!token || !userId) return null;
  return { accessToken: token, userId };
}
