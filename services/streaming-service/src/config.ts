import { z } from 'zod';

const schema = z.object({
  PORT:                       z.coerce.number().default(3002),
  AWS_REGION:                 z.string().default('us-east-1'),
  AWS_ENDPOINT_URL:           z.string().url().optional(),
  AWS_ACCESS_KEY_ID:          z.string().default('test'),
  AWS_SECRET_ACCESS_KEY:      z.string().default('test'),
  S3_TRANSCODED_BUCKET:       z.string().default('transcoded-videos'),
  CDN_BASE_URL:               z.string().optional(),
  REDIS_URL:                  z.string().default('redis://localhost:6379'),
  KAFKA_BROKERS:              z.string().default('localhost:9092').transform(s => s.split(',')),
  JWT_PUBLIC_KEY:             z.string().optional(),
  NODE_ENV:                   z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL:                  z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  SERVICE_NAME:               z.string().default('streaming-service'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://otel-collector:4317'),
});

export const config = schema.parse(process.env);
export type Config = typeof config;
