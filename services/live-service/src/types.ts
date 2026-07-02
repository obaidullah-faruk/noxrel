import type { Rendition } from './config.js';

export type SessionStatus = 'live' | 'stitching' | 'ended' | 'stitch_failed' | 'error';

export interface StreamKey {
  id: string;
  userId: string;
  key: string;
  title: string;
  description: string;
  isActive: boolean;
  createdAt: Date;
}

export interface LiveSession {
  id: string;
  streamKeyId: string;
  userId: string;
  status: SessionStatus;
  title: string;
  description: string;
  hlsMasterUrl: string;
  s3Prefix: string;
  vodVideoId: string | null;
  replayUrl: string | null;
  viewerCount: number;
  peakViewerCount: number;
  lastSegmentAt: Date | null;
  startedAt: Date;
  endedAt: Date | null;
}

export interface LiveSegment {
  sessionId: string;
  rendition: Rendition;
  seq: number;
  uri: string;
  duration: number;
}

export interface JwtClaims {
  sub: string;
  username?: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
}
