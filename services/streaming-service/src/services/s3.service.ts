import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config.js';
import { NotFoundError } from '../core/exceptions.js';

const s3 = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
  ...(config.AWS_ENDPOINT_URL
    ? { endpoint: config.AWS_ENDPOINT_URL, forcePathStyle: true }
    : {}),
});

export async function fetchManifestText(videoId: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.S3_TRANSCODED_BUCKET,
    Key: `${videoId}/master.m3u8`,
  });

  let response;
  try {
    response = await s3.send(command);
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'NoSuchKey' || name === 'NotFound') {
      throw new NotFoundError(`Manifest not found for video ${videoId}`);
    }
    throw err;
  }

  return (await response.Body?.transformToString()) ?? '';
}

/**
 * Phase 4A: builds a public S3 URL for segment/variant paths.
 * Phase 4B: replace with CloudFront signed URL via @aws-sdk/cloudfront-signer.
 */
export function buildSegmentUrl(videoId: string, path: string): string {
  // CDN_BASE_URL takes priority — use it so browsers can reach segments directly.
  // Falls back to AWS_ENDPOINT_URL (Docker-internal) only for server-side S3 fetches.
  const base =
    config.CDN_BASE_URL ??
    config.AWS_ENDPOINT_URL ??
    `https://s3.${config.AWS_REGION}.amazonaws.com`;
  return `${base.replace(/\/$/, '')}/${config.S3_TRANSCODED_BUCKET}/${videoId}/${path}`;
}
