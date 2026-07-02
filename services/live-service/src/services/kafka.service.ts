import { Admin, Kafka, Producer, logLevel } from 'kafkajs';
import { config } from '../config.js';
import type { LiveSession } from '../types.js';

const kafka = new Kafka({
  clientId: 'live-service',
  brokers: config.KAFKA_BROKERS,
  logLevel: logLevel.WARN,
});

let admin: Admin | null = null;

export function getKafkaAdmin(): Admin {
  if (!admin) {
    admin = kafka.admin();
  }
  return admin;
}

let producer: Producer | null = null;
let connecting = false;

async function getProducer(): Promise<Producer> {
  if (producer) return producer;
  if (connecting) {
    await new Promise(r => setTimeout(r, 200));
    return getProducer();
  }
  connecting = true;
  producer = kafka.producer();
  await producer.connect();
  connecting = false;
  return producer;
}

async function publish(topic: string, key: string, payload: Record<string, unknown>): Promise<void> {
  const p = await getProducer();
  await p.send({
    topic,
    messages: [{ key, value: JSON.stringify({ ...payload, ts: new Date().toISOString() }) }],
  });
}

export async function publishLiveStarted(session: LiveSession): Promise<void> {
  await publish('live.started', session.id, {
    event: 'live.started',
    session_id: session.id,
    user_id: session.userId,
    title: session.title,
    hls_master_url: session.hlsMasterUrl,
  });
}

export async function publishLiveEnded(
  session: LiveSession,
  vodVideoId: string,
  replayUrl: string,
): Promise<void> {
  await publish('live.ended', session.id, {
    event: 'live.ended',
    session_id: session.id,
    user_id: session.userId,
    vod_video_id: vodVideoId,
    replay_url: replayUrl,
  });
}

export async function publishViewerCount(sessionId: string, viewerCount: number): Promise<void> {
  await publish('live.viewer_count', sessionId, {
    event: 'live.viewer_count',
    session_id: sessionId,
    viewer_count: viewerCount,
  });
}

export async function closeKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
  if (admin) {
    await admin.disconnect();
    admin = null;
  }
}
