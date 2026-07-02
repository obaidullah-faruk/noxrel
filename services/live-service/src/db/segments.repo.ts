import { pool } from './pool.js';
import type { Rendition } from '../config.js';
import type { LiveSegment } from '../types.js';

interface SegmentRow {
  session_id: string;
  rendition: Rendition;
  seq: number;
  uri: string;
  duration: string; // pg returns NUMERIC as string
}

function mapRow(row: SegmentRow): LiveSegment {
  return {
    sessionId: row.session_id,
    rendition: row.rendition,
    seq: row.seq,
    uri: row.uri,
    duration: parseFloat(row.duration),
  };
}

// Idempotent — the sync loop may re-observe a segment already recorded.
export async function record(seg: LiveSegment): Promise<void> {
  await pool.query(
    `INSERT INTO live_segments (session_id, rendition, seq, uri, duration)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (session_id, rendition, seq) DO NOTHING`,
    [seg.sessionId, seg.rendition, seg.seq, seg.uri, seg.duration],
  );
}

export async function maxSeq(sessionId: string, rendition: Rendition): Promise<number> {
  const { rows } = await pool.query<{ max: number | null }>(
    `SELECT MAX(seq) AS max FROM live_segments WHERE session_id = $1 AND rendition = $2`,
    [sessionId, rendition],
  );
  return rows[0]?.max ?? -1;
}

export async function renditionsFor(sessionId: string): Promise<Rendition[]> {
  const { rows } = await pool.query<{ rendition: Rendition }>(
    `SELECT DISTINCT rendition FROM live_segments WHERE session_id = $1`,
    [sessionId],
  );
  return rows.map(r => r.rendition);
}

export async function list(sessionId: string, rendition: Rendition): Promise<LiveSegment[]> {
  const { rows } = await pool.query<SegmentRow>(
    `SELECT * FROM live_segments
      WHERE session_id = $1 AND rendition = $2
      ORDER BY seq ASC`,
    [sessionId, rendition],
  );
  return rows.map(mapRow);
}

export async function totalDuration(sessionId: string, rendition: Rendition): Promise<number> {
  const { rows } = await pool.query<{ total: string | null }>(
    `SELECT SUM(duration) AS total FROM live_segments
      WHERE session_id = $1 AND rendition = $2`,
    [sessionId, rendition],
  );
  return rows[0]?.total ? parseFloat(rows[0].total) : 0;
}
