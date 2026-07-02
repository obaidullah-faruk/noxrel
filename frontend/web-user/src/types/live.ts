export type LiveSessionStatus = 'live' | 'stitching' | 'ended' | 'stitch_failed' | 'error';

export interface LiveSession {
  id: string;
  userId: string;
  status: LiveSessionStatus;
  title: string;
  description: string;
  hlsMasterUrl: string;
  vodVideoId: string | null;
  replayUrl: string | null;
  viewerCount: number;
  peakViewerCount: number;
  startedAt: string;
  endedAt: string | null;
}

export interface StreamKey {
  id: string;
  userId: string;
  key: string;
  title: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export interface LiveChatMessage {
  userId: string;
  displayName: string;
  message: string;
  ts: number;
}
