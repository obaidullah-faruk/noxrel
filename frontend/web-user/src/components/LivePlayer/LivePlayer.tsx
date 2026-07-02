'use client';
import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Chip from '@mui/material/Chip';
import { sendViewerHeartbeat, getOrCreateViewerId } from '@/lib/live';

interface LivePlayerProps {
  sessionId: string;
  hlsMasterUrl: string;
}

const HEARTBEAT_MS = 15_000;

export function LivePlayer({ sessionId, hlsMasterUrl }: LivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef   = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<{ height: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);

  // Viewer-count heartbeat — this is how the platform counts watchers.
  useEffect(() => {
    const viewerId = getOrCreateViewerId();
    const beat = () => { void sendViewerHeartbeat(sessionId, viewerId).catch(() => {}); };
    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [sessionId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!Hls.isSupported()) {
      video.src = hlsMasterUrl; // Safari native HLS
      return;
    }

    const hls = new Hls({
      // Tuned for short-segment live HLS (not LL-HLS — no EXT-X-PART).
      liveSyncDurationCount: 3,        // ~6 s behind the live edge
      liveMaxLatencyDurationCount: 6,
      maxBufferLength: 10,
      enableWorker: true,
    });
    hlsRef.current = hls;
    hls.loadSource(hlsMasterUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
      setLevels(data.levels.map(l => ({ height: l.height })));
      void video.play().catch(() => {});
    });
    hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => setCurrentLevel(data.level));

    return () => { hls.destroy(); hlsRef.current = null; };
  }, [hlsMasterUrl]);

  const selectLevel = (level: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = level;
    setCurrentLevel(level);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ position: 'relative' }}>
        <video ref={videoRef} controls style={{ width: '100%', borderRadius: 8, background: '#000' }} />
        <Chip label="LIVE" color="error" size="small"
              sx={{ position: 'absolute', top: 8, left: 8, fontWeight: 700 }} />
      </Box>
      {levels.length > 0 && (
        <ButtonGroup size="small" sx={{ mt: 1 }}>
          <Button variant={currentLevel === -1 ? 'contained' : 'outlined'} onClick={() => selectLevel(-1)}>
            Auto
          </Button>
          {levels.map((l, i) => (
            <Button key={i} variant={currentLevel === i ? 'contained' : 'outlined'} onClick={() => selectLevel(i)}>
              {l.height}p
            </Button>
          ))}
        </ButtonGroup>
      )}
    </Box>
  );
}
