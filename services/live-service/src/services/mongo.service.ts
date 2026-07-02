import { MongoClient, type Collection, type Db } from 'mongodb';
import { config } from '../config.js';

export interface ChatMessageDoc {
  session_id: string;
  user_id: string;
  display_name: string;
  message: string;
  ts: Date;
  is_deleted: boolean;
}

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<void> {
  if (client) return;
  client = new MongoClient(config.MONGODB_URL);
  await client.connect();
  db = client.db(config.MONGODB_DB);

  const messages = chatMessages();
  await messages.createIndex({ session_id: 1, ts: 1 });
  // 90-day TTL on chat history.
  await messages.createIndex({ ts: 1 }, { expireAfterSeconds: 7776000 });
}

export function chatMessages(): Collection<ChatMessageDoc> {
  if (!db) throw new Error('Mongo not connected');
  return db.collection<ChatMessageDoc>('live_chat_messages');
}

export async function pingMongo(): Promise<boolean> {
  if (!client) return false;
  try {
    await client.db(config.MONGODB_DB).command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
