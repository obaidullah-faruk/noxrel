import { readFile } from 'node:fs/promises';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { config } from '../config.js';

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

export async function putText(key: string, body: string): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: config.S3_LIVE_BUCKET,
    Key: key,
    Body: body,
    ContentType: 'application/vnd.apple.mpegurl',
  }));
}

export async function uploadFile(key: string, localPath: string): Promise<void> {
  const body = await readFile(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: config.S3_LIVE_BUCKET,
    Key: key,
    Body: body,
    ContentType: key.endsWith('.ts') ? 'video/mp2t' : 'application/octet-stream',
  }));
}

export async function deletePrefix(prefix: string): Promise<void> {
  let token: string | undefined;
  do {
    const listed = await s3.send(new ListObjectsV2Command({
      Bucket: config.S3_LIVE_BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
    }));
    const objects = (listed.Contents ?? []).map(o => ({ Key: o.Key! }));
    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: config.S3_LIVE_BUCKET,
        Delete: { Objects: objects },
      }));
    }
    token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (token);
}

// Manifest URL handed to clients. Manifests use relative segment URIs, so the
// CDN domain only appears here, never inside a playlist.
export function buildCdnUrl(key: string): string {
  return `${config.CDN_BASE_URL.replace(/\/$/, '')}/${key}`;
}
