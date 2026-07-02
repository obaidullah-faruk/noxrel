import { checkChatRateLimit } from '../services/redis.service.js';
import { chatMessages } from '../services/mongo.service.js';

const MAX_LEN = 500;

export function checkRateLimit(userId: string): Promise<boolean> {
  return checkChatRateLimit(userId);
}

// Chat is plain text — the client renders it via React, which escapes on
// render, so there is no HTML to sanitise. We strip ASCII control characters
// and cap the length. Returns '' for messages empty after cleaning.
export function cleanText(message: unknown): string {
  if (typeof message !== 'string') return '';
  const stripped = message.replace(/[\x00-\x1F\x7F]/g, ' ').trim();
  return stripped.slice(0, MAX_LEN);
}

export async function persist(
  sessionId: string,
  userId: string,
  displayName: string,
  message: string,
): Promise<void> {
  await chatMessages().insertOne({
    session_id: sessionId,
    user_id: userId,
    display_name: displayName,
    message,
    ts: new Date(),
    is_deleted: false,
  });
}
