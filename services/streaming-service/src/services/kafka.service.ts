import { Kafka, Producer, logLevel } from 'kafkajs';
import { config } from '../config.js';

const kafka = new Kafka({
  clientId: 'streaming-service',
  brokers: config.KAFKA_BROKERS,
  logLevel: logLevel.WARN,
});

let producer: Producer | null = null;
let connecting = false;

async function getProducer(): Promise<Producer> {
  if (producer) return producer;
  if (connecting) {
    // wait briefly for ongoing connect
    await new Promise(r => setTimeout(r, 200));
    return getProducer();
  }
  connecting = true;
  producer = kafka.producer();
  await producer.connect();
  connecting = false;
  return producer;
}

interface VideoViewedPayload {
  userId: string;
  videoId: string;
  tier: string;
  qualityCap: string;
}

export async function publishVideoViewed(payload: VideoViewedPayload): Promise<void> {
  const p = await getProducer();
  await p.send({
    topic: 'video.viewed',
    messages: [
      {
        key: payload.videoId,
        value: JSON.stringify({
          event: 'video.viewed',
          user_id: payload.userId,
          video_id: payload.videoId,
          tier: payload.tier,
          quality_cap: payload.qualityCap,
          ts: new Date().toISOString(),
        }),
      },
    ],
  });
}

export async function closeKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
