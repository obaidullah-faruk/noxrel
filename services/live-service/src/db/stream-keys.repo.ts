import { pool } from './pool.js';
import type { StreamKey } from '../types.js';

interface StreamKeyRow {
  id: string;
  user_id: string;
  key: string;
  title: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
}

function mapRow(row: StreamKeyRow): StreamKey {
  return {
    id: row.id,
    userId: row.user_id,
    key: row.key,
    title: row.title,
    description: row.description ?? '',
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function create(params: {
  userId: string;
  key: string;
  title: string;
  description: string;
}): Promise<StreamKey> {
  const { rows } = await pool.query<StreamKeyRow>(
    `INSERT INTO stream_keys (user_id, key, title, description)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [params.userId, params.key, params.title, params.description],
  );
  return mapRow(rows[0]!);
}

export async function findByKey(key: string): Promise<StreamKey | null> {
  const { rows } = await pool.query<StreamKeyRow>(
    `SELECT * FROM stream_keys WHERE key = $1`,
    [key],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listByUser(userId: string): Promise<StreamKey[]> {
  const { rows } = await pool.query<StreamKeyRow>(
    `SELECT * FROM stream_keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map(mapRow);
}

export async function findById(id: string): Promise<StreamKey | null> {
  const { rows } = await pool.query<StreamKeyRow>(
    `SELECT * FROM stream_keys WHERE id = $1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

// Returns true if a row was deactivated (existed and was owned by the user).
export async function revoke(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE stream_keys SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return (rowCount ?? 0) > 0;
}
