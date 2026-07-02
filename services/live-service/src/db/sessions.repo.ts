import { pool } from './pool.js';
import type { LiveSession, SessionStatus } from '../types.js';

interface SessionRow {
  id: string;
  stream_key_id: string;
  user_id: string;
  status: SessionStatus;
  title: string;
  description: string | null;
  hls_master_url: string;
  s3_prefix: string;
  vod_video_id: string | null;
  replay_url: string | null;
  viewer_count: number;
  peak_viewer_count: number;
  last_segment_at: Date | null;
  started_at: Date;
  ended_at: Date | null;
}

function mapRow(row: SessionRow): LiveSession {
  return {
    id: row.id,
    streamKeyId: row.stream_key_id,
    userId: row.user_id,
    status: row.status,
    title: row.title,
    description: row.description ?? '',
    hlsMasterUrl: row.hls_master_url,
    s3Prefix: row.s3_prefix,
    vodVideoId: row.vod_video_id,
    replayUrl: row.replay_url,
    viewerCount: row.viewer_count,
    peakViewerCount: row.peak_viewer_count,
    lastSegmentAt: row.last_segment_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

export async function create(params: {
  id: string;
  streamKeyId: string;
  userId: string;
  title: string;
  description: string;
  hlsMasterUrl: string;
  s3Prefix: string;
}): Promise<LiveSession> {
  const { rows } = await pool.query<SessionRow>(
    `INSERT INTO live_sessions
       (id, stream_key_id, user_id, title, description, hls_master_url, s3_prefix)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [params.id, params.streamKeyId, params.userId, params.title,
     params.description, params.hlsMasterUrl, params.s3Prefix],
  );
  return mapRow(rows[0]!);
}

export async function findById(id: string): Promise<LiveSession | null> {
  const { rows } = await pool.query<SessionRow>(
    `SELECT * FROM live_sessions WHERE id = $1`, [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findActiveByStreamKey(streamKey: string): Promise<LiveSession | null> {
  const { rows } = await pool.query<SessionRow>(
    `SELECT s.* FROM live_sessions s
       JOIN stream_keys k ON k.id = s.stream_key_id
      WHERE k.key = $1 AND s.status = 'live'`,
    [streamKey],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listLive(): Promise<LiveSession[]> {
  const { rows } = await pool.query<SessionRow>(
    `SELECT * FROM live_sessions WHERE status = 'live' ORDER BY started_at DESC`,
  );
  return rows.map(mapRow);
}

export async function listByStatus(status: SessionStatus): Promise<LiveSession[]> {
  const { rows } = await pool.query<SessionRow>(
    `SELECT * FROM live_sessions WHERE status = $1`, [status],
  );
  return rows.map(mapRow);
}

// Sessions whose sync loop has gone quiet (sweeper input).
export async function listStaleLive(staleSeconds: number): Promise<LiveSession[]> {
  const { rows } = await pool.query<SessionRow>(
    `SELECT * FROM live_sessions
      WHERE status = 'live'
        AND last_segment_at IS NOT NULL
        AND last_segment_at < NOW() - ($1 || ' seconds')::interval`,
    [staleSeconds],
  );
  return rows.map(mapRow);
}

export async function isLive(id: string): Promise<boolean> {
  const { rows } = await pool.query<{ status: SessionStatus }>(
    `SELECT status FROM live_sessions WHERE id = $1`, [id],
  );
  return rows[0]?.status === 'live';
}

export async function touchSegment(id: string): Promise<void> {
  await pool.query(`UPDATE live_sessions SET last_segment_at = NOW() WHERE id = $1`, [id]);
}

// Atomic state transition into 'stitching'. Returns the row only if it was
// 'live' or 'stitch_failed' — guarantees a single finalize wins the race
// between the FFmpeg close handler, the sweeper, and the retry job.
export async function beginStitching(id: string): Promise<LiveSession | null> {
  const { rows } = await pool.query<SessionRow>(
    `UPDATE live_sessions SET status = 'stitching'
      WHERE id = $1 AND status IN ('live', 'stitch_failed')
      RETURNING *`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function markEnded(
  id: string,
  params: { vodVideoId: string; replayUrl: string },
): Promise<void> {
  await pool.query(
    `UPDATE live_sessions
        SET status = 'ended', vod_video_id = $2, replay_url = $3, ended_at = NOW()
      WHERE id = $1`,
    [id, params.vodVideoId, params.replayUrl],
  );
}

export async function markStitchFailed(id: string): Promise<void> {
  await pool.query(`UPDATE live_sessions SET status = 'stitch_failed' WHERE id = $1`, [id]);
}

export async function updateViewerCount(id: string, count: number): Promise<void> {
  await pool.query(
    `UPDATE live_sessions
        SET viewer_count = $2,
            peak_viewer_count = GREATEST(peak_viewer_count, $2)
      WHERE id = $1`,
    [id, count],
  );
}
