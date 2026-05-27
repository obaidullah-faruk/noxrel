'use client';
import Hls from 'hls.js';
import { useEffect, useRef, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

interface VideoPlayerProps {
  videoId: string;
  onProgress?: (positionSeconds: number) => void;
}

export function VideoPlayer({ videoId, onProgress }: VideoPlayerProps) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const hlsRef       = useRef<Hls | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [levels, setLevels]               = useState<{ height: number }[]>([]);
  const [currentLevel, setCurrentLevel]   = useState<number>(-1);
  const [error, setError]                 = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);

  const setQuality = useCallback((idx: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = idx;
    setCurrentLevel(idx);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const manifestRes = await fetch(`/api/stream/${videoId}/manifest`);
        if (!manifestRes.ok) throw new Error(`Manifest fetch failed: ${manifestRes.status}`);
        const manifestText = await manifestRes.text();

        const blobUrl = URL.createObjectURL(
          new Blob([manifestText], { type: 'application/vnd.apple.mpegurl' }),
        );

        const resumeRes = await fetch(`/api/stream/${videoId}/resume`);
        const { position = 0 } = resumeRes.ok ? await resumeRes.json() : {};

        if (cancelled) return;
        const video = videoRef.current!;
        setLoading(false);

        if (Hls.isSupported()) {
          const hls = new Hls({ maxBufferLength: 30, enableWorker: true });
          hlsRef.current = hls;
          hls.loadSource(blobUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
            if (cancelled) return;
            setLevels(data.levels);
            video.currentTime = position as number;
            video.play().catch(() => {});
          });
          hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => setCurrentLevel(data.level));
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) setError('Playback error — please refresh.');
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = blobUrl;
          video.currentTime = position as number;
          video.play().catch(() => {});
        } else {
          setError('HLS is not supported in this browser.');
        }

        heartbeatRef.current = setInterval(() => {
          const pos = video.currentTime;
          fetch(`/api/stream/${videoId}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position: pos }),
          }).catch(() => {});
          onProgress?.(pos);
        }, 30_000);
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          setError(err instanceof Error ? err.message : 'Unknown playback error');
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [videoId, onProgress]);

  if (error) {
    return (
      <Box sx={{ p: 2, bgcolor: 'error.dark', borderRadius: 1 }}>
        <Typography color="error.contrastText">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', position: 'relative' }}>
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}
      <video
        ref={videoRef}
        controls
        style={{ width: '100%', borderRadius: 8, display: loading ? 'none' : 'block' }}
      />
      {levels.length > 0 && (
        <ButtonGroup size="small" sx={{ mt: 1 }}>
          <Button
            variant={currentLevel === -1 ? 'contained' : 'outlined'}
            onClick={() => setQuality(-1)}
          >
            Auto
          </Button>
          {levels.map((level, i) => (
            <Button
              key={i}
              variant={currentLevel === i ? 'contained' : 'outlined'}
              onClick={() => setQuality(i)}
            >
              {level.height}p
            </Button>
          ))}
        </ButtonGroup>
      )}
    </Box>
  );
}
