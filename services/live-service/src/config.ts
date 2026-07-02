import { z } from 'zod';

const RENDITION_LADDER = ['1080p', '720p', '480p', '360p'] as const;
export type Rendition = (typeof RENDITION_LADDER)[number];

const schema = z.object({
  PORT:                       z.coerce.number().default(3000),
  NODE_ENV:                   z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL:                  z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  SERVICE_NAME:               z.string().default('live-service'),

  DATABASE_URL:               z.string().default('postgres://noxrel:noxrel@localhost:5432/live_service'),
  REDIS_URL:                  z.string().default('redis://localhost:6379'),
  MONGODB_URL:                z.string().default('mongodb://localhost:27017'),
  MONGODB_DB:                 z.string().default('live_service'),
  KAFKA_BROKERS:              z.string().default('localhost:9092').transform(s => s.split(',')),

  AWS_REGION:                 z.string().default('us-east-1'),
  AWS_ENDPOINT_URL:           z.string().url().optional(),
  AWS_ACCESS_KEY_ID:          z.string().default('test'),
  AWS_SECRET_ACCESS_KEY:      z.string().default('test'),
  S3_LIVE_BUCKET:             z.string().default('live-segments'),
  // Base for the manifest URLs handed to clients. Manifests themselves use
  // relative segment URIs, so this domain is never baked into a playlist.
  CDN_BASE_URL:               z.string().default('http://localhost:4566/live-segments'),

  NGINX_RTMP_URL:             z.string().default('rtmp://localhost:1935/live'),
  NGINX_CONTROL_URL:          z.string().default('http://localhost:8080/control'),

  VIDEO_SERVICE_INTERNAL_URL: z.string().default('http://localhost:8001'),
  INTERNAL_API_KEY:           z.string().default('dev-internal-key'),

  JWT_PUBLIC_KEY:             z.string().optional(),

  // Comma-separated subset of the full ladder. Lets dev run a lighter encode.
  RENDITIONS: z
    .string()
    .default('1080p,720p,480p,360p')
    .transform(s => s.split(',').map(r => r.trim()) as Rendition[])
    .refine(rs => rs.every(r => RENDITION_LADDER.includes(r)), {
      message: `RENDITIONS must be a subset of ${RENDITION_LADDER.join(',')}`,
    }),
  MAX_STREAM_DURATION_HOURS:  z.coerce.number().default(12),
});

export const config = schema.parse(process.env);
export type Config = typeof config;

// Encoding parameters per rung, keyed by rendition name. The ordering in
// `config.RENDITIONS` decides which rungs FFmpeg actually produces.
export const RENDITION_SPECS: Record<Rendition, {
  width: number;
  height: number;
  videoBitrate: string;
  maxrate: string;
  bufsize: string;
  audioBitrate: string;
  bandwidth: number;
  codecs: string;
}> = {
  '1080p': { width: 1920, height: 1080, videoBitrate: '4000k', maxrate: '4400k', bufsize: '8000k', audioBitrate: '192k', bandwidth: 4_192_000, codecs: 'avc1.640028,mp4a.40.2' },
  '720p':  { width: 1280, height: 720,  videoBitrate: '2500k', maxrate: '2750k', bufsize: '5000k', audioBitrate: '128k', bandwidth: 2_628_000, codecs: 'avc1.64001f,mp4a.40.2' },
  '480p':  { width: 854,  height: 480,  videoBitrate: '1000k', maxrate: '1100k', bufsize: '2000k', audioBitrate: '96k',  bandwidth: 1_096_000, codecs: 'avc1.64001e,mp4a.40.2' },
  '360p':  { width: 640,  height: 360,  videoBitrate: '500k',  maxrate: '550k',  bufsize: '1000k', audioBitrate: '64k',  bandwidth: 564_000,   codecs: 'avc1.64001e,mp4a.40.2' },
};
