-- Up Migration

CREATE TABLE stream_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  key         VARCHAR(128) NOT NULL UNIQUE,   -- ULID string, user pastes into OBS
  title       VARCHAR(256) NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stream_keys_user ON stream_keys(user_id);

CREATE TABLE live_sessions (
  id                UUID PRIMARY KEY,          -- crypto.randomUUID() in app code
  stream_key_id     UUID NOT NULL REFERENCES stream_keys(id),
  user_id           UUID NOT NULL,
  status            VARCHAR(16) NOT NULL DEFAULT 'live',
    -- live | stitching | ended | stitch_failed | error
  title             VARCHAR(256) NOT NULL,
  description       TEXT,

  hls_master_url    TEXT NOT NULL,             -- CDN URL to sessions/{id}/master.m3u8
  s3_prefix         TEXT NOT NULL,             -- sessions/{id}

  vod_video_id      UUID,
  replay_url        TEXT,

  viewer_count      INT DEFAULT 0,
  peak_viewer_count INT DEFAULT 0,
  last_segment_at   TIMESTAMPTZ,

  started_at        TIMESTAMPTZ DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_live_sessions_status ON live_sessions(status);
CREATE INDEX idx_live_sessions_user   ON live_sessions(user_id);

-- one active session per key
CREATE UNIQUE INDEX idx_live_sessions_active_key
  ON live_sessions(stream_key_id) WHERE status = 'live';

-- Segment index: source of truth for replay playlists (accurate durations,
-- survives live-service crashes).
CREATE TABLE live_segments (
  session_id  UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  rendition   VARCHAR(8)   NOT NULL,
  seq         INT          NOT NULL,
  uri         VARCHAR(64)  NOT NULL,
  duration    NUMERIC(7,3) NOT NULL,
  PRIMARY KEY (session_id, rendition, seq)
);

-- Down Migration

DROP TABLE IF EXISTS live_segments;
DROP TABLE IF EXISTS live_sessions;
DROP TABLE IF EXISTS stream_keys;
