'use client';
import Hls from 'hls.js';
import { useEffect, useRef, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Slider from '@mui/material/Slider';
import { alpha, useTheme } from '@mui/material/styles';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import VolumeMuteRoundedIcon from '@mui/icons-material/VolumeMuteRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

interface VideoPlayerProps {
  videoId: string;
  manifestUrl?: string;
  onProgress?: (positionSeconds: number) => void;
  initialBandwidthEstimate?: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VideoPlayer({ videoId, manifestUrl, onProgress, initialBandwidthEstimate }: VideoPlayerProps) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef       = useRef<Hls | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideControlsRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [levels, setLevels]             = useState<{ height: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [error, setError]               = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);

  // Playback state
  const [playing, setPlaying]           = useState(false);
  const [currentTime, setCurrentTime]   = useState(0);
  const [duration, setDuration]         = useState(0);
  const [volume, setVolume]             = useState(1);
  const [muted, setMuted]               = useState(false);
  const [fullscreen, setFullscreen]     = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [anchorEl, setAnchorEl]         = useState<HTMLButtonElement | null>(null);

  // ── Quality ──────────────────────────────────────────────────────────────
  const setQuality = useCallback((idx: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = idx;
    setCurrentLevel(idx);
  }, []);

  // ── Controls auto-hide ───────────────────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsRef.current) clearTimeout(hideControlsRef.current);
    hideControlsRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 2500);
  }, []);

  // ── HLS init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const useDirectManifest = Boolean(manifestUrl);
        const sourceUrl = manifestUrl ?? `/api/stream/${videoId}/manifest`;
        let position = 0;
        if (!useDirectManifest) {
          const resumeRes = await fetch(`/api/stream/${videoId}/resume`);
          const resumeData = resumeRes.ok ? await resumeRes.json() : {};
          position = resumeData.position ?? 0;
        }
        if (cancelled) return;

        const video = videoRef.current!;
        setLoading(false);

        const startPlayback = () => {
          if (!useDirectManifest && position > 0) {
            video.currentTime = position;
          }
          video.play().catch(() => {});
        };

        if (Hls.isSupported()) {
          const hlsConfig: Partial<Hls['config']> = { maxBufferLength: 30, enableWorker: true };
          if (initialBandwidthEstimate !== undefined) {
            (hlsConfig as Record<string, unknown>).abrEwmaDefaultEstimate = initialBandwidthEstimate;
          }
          const hls = new Hls(hlsConfig);
          hlsRef.current = hls;
          hls.loadSource(sourceUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
            if (cancelled) return;
            setLevels(data.levels);
            startPlayback();
          });
          hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => setCurrentLevel(data.level));
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) setError('Playback error — please refresh.');
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = sourceUrl;
          video.addEventListener('loadedmetadata', startPlayback, { once: true });
        } else {
          setError('HLS is not supported in this browser.');
        }

        if (!useDirectManifest) {
          heartbeatRef.current = setInterval(() => {
            const pos = video.currentTime;
            fetch(`/api/stream/${videoId}/heartbeat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ position: pos }),
            }).catch(() => {});
            onProgress?.(pos);
          }, 30_000);
        }
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
      if (hideControlsRef.current) clearTimeout(hideControlsRef.current);
    };
  }, [videoId, manifestUrl, onProgress, initialBandwidthEstimate]);

  // ── Video event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay        = () => setPlaying(true);
    const onPause       = () => { setPlaying(false); setControlsVisible(true); };
    const onTimeUpdate  = () => setCurrentTime(video.currentTime);
    const onDuration    = () => setDuration(video.duration);
    const onVolumeChange = () => { setVolume(video.volume); setMuted(video.muted); };

    video.addEventListener('play',         onPlay);
    video.addEventListener('pause',        onPause);
    video.addEventListener('timeupdate',   onTimeUpdate);
    video.addEventListener('durationchange', onDuration);
    video.addEventListener('volumechange', onVolumeChange);
    return () => {
      video.removeEventListener('play',           onPlay);
      video.removeEventListener('pause',          onPause);
      video.removeEventListener('timeupdate',     onTimeUpdate);
      video.removeEventListener('durationchange', onDuration);
      video.removeEventListener('volumechange',   onVolumeChange);
    };
  }, [loading]);

  // ── Fullscreen listener ───────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ── Controls ─────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  const handleVolumeChange = (_: Event, val: number | number[]) => {
    const v = videoRef.current;
    if (!v) return;
    const newVol = val as number;
    v.volume = newVol;
    v.muted  = newVol === 0;
  };

  const handleSeek = (_: Event, val: number | number[]) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = val as number;
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const VolumeIcon = muted || volume === 0
    ? VolumeOffRoundedIcon
    : volume < 0.5
    ? VolumeMuteRoundedIcon
    : VolumeUpRoundedIcon;

  // ── Quality options ───────────────────────────────────────────────────────
  const qualityOptions = levels
    .map((l, i) => ({ idx: i, label: l.height > 0 ? `${l.height}p` : `Level ${i + 1}` }))
    .filter((opt, pos, arr) => arr.findIndex(o => o.label === opt.label) === pos)
    .sort((a, b) => (parseInt(b.label) || 0) - (parseInt(a.label) || 0));

  const activeLabel = currentLevel === -1
    ? (qualityOptions[0]?.label ?? '')
    : (qualityOptions.find(o => o.idx === currentLevel)?.label ?? '');

  const popoverOpen = Boolean(anchorEl);

  // ── Render ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Box sx={{ p: 3, bgcolor: alpha(theme.palette.error.main, 0.1), border: `1px solid ${alpha(theme.palette.error.main, 0.25)}`, borderRadius: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="error">{error}</Typography>
      </Box>
    );
  }

  const ctrlBg   = 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)';
  const iconSx   = { fontSize: 18, color: '#fff' };
  const btnSx    = {
    p: 0.75,
    color: '#fff',
    '&:hover': { bgcolor: alpha('#fff', 0.12) },
  };

  return (
    <Box
      ref={containerRef}
      onMouseMove={showControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
      sx={{
        width: '100%',
        position: 'relative',
        bgcolor: '#000',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: controlsVisible ? 'default' : 'none',
        '&:fullscreen': { borderRadius: 0 },
      }}
    >
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <CircularProgress size={28} thickness={3} sx={{ color: '#fff' }} />
        </Box>
      )}

      {/* Raw video — no native controls */}
      <video
        ref={videoRef}
        onClick={togglePlay}
        style={{ width: '100%', display: loading ? 'none' : 'block', cursor: 'pointer' }}
      />

      {/* Control overlay */}
      {!loading && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: ctrlBg,
            px: 1.5,
            pt: 3,
            pb: 1,
            opacity: controlsVisible ? 1 : 0,
            transition: 'opacity 0.25s ease',
            pointerEvents: controlsVisible ? 'auto' : 'none',
          }}
        >
          {/* Seek bar */}
          <Slider
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            size="small"
            sx={{
              color: '#6366F1',
              height: 3,
              py: 0.5,
              mb: 0.25,
              '& .MuiSlider-thumb': {
                width: 12,
                height: 12,
                transition: 'none',
                '&:hover, &.Mui-active': { boxShadow: `0 0 0 6px ${alpha('#6366F1', 0.25)}` },
              },
              '& .MuiSlider-rail': { bgcolor: alpha('#fff', 0.25) },
              '& .MuiSlider-track': { border: 'none' },
            }}
          />

          {/* Bottom row: play · volume · time ··· settings · fullscreen */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {/* Play / Pause */}
            <IconButton size="small" onClick={togglePlay} sx={btnSx}>
              {playing ? <PauseRoundedIcon sx={iconSx} /> : <PlayArrowRoundedIcon sx={iconSx} />}
            </IconButton>

            {/* Volume */}
            <IconButton size="small" onClick={toggleMute} sx={btnSx}>
              <VolumeIcon sx={iconSx} />
            </IconButton>
            <Slider
              min={0}
              max={1}
              step={0.02}
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              size="small"
              sx={{
                width: 72,
                color: '#fff',
                height: 3,
                '& .MuiSlider-thumb': {
                  width: 10,
                  height: 10,
                  bgcolor: '#fff',
                  '&:hover, &.Mui-active': { boxShadow: `0 0 0 5px ${alpha('#fff', 0.2)}` },
                },
                '& .MuiSlider-rail': { bgcolor: alpha('#fff', 0.3) },
                '& .MuiSlider-track': { bgcolor: '#fff', border: 'none' },
              }}
            />

            {/* Time */}
            <Typography
              variant="caption"
              sx={{ color: alpha('#fff', 0.85), fontVariantNumeric: 'tabular-nums', mx: 0.75, fontSize: '0.75rem', whiteSpace: 'nowrap' }}
            >
              {formatTime(currentTime)} / {formatTime(duration)}
            </Typography>

            {/* Spacer */}
            <Box sx={{ flex: 1 }} />

            {/* Quality (gear) */}
            {levels.length > 0 && (
              <IconButton
                size="small"
                onClick={e => setAnchorEl(e.currentTarget)}
                sx={btnSx}
              >
                <SettingsRoundedIcon sx={{ ...iconSx, fontSize: 17 }} />
              </IconButton>
            )}

            {/* Fullscreen */}
            <IconButton size="small" onClick={toggleFullscreen} sx={btnSx}>
              {fullscreen
                ? <FullscreenExitRoundedIcon sx={iconSx} />
                : <FullscreenRoundedIcon sx={iconSx} />
              }
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Quality popover */}
      <Popover
        open={popoverOpen}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: isDark ? '#1E2535' : '#fff',
              border: `1px solid ${isDark ? alpha('#94A3B8', 0.12) : '#E2E8F0'}`,
              borderRadius: 2,
              boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
              minWidth: 140,
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${isDark ? alpha('#94A3B8', 0.1) : '#F1F5F9'}` }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem' }}>
            Quality
          </Typography>
        </Box>

        <QualityItem
          label="Auto"
          sublabel={activeLabel}
          selected={currentLevel === -1}
          isDark={isDark}
          onClick={() => { setQuality(-1); setAnchorEl(null); }}
        />
        {qualityOptions.map(opt => (
          <QualityItem
            key={opt.idx}
            label={opt.label}
            selected={currentLevel === opt.idx}
            isDark={isDark}
            onClick={() => { setQuality(opt.idx); setAnchorEl(null); }}
          />
        ))}
      </Popover>
    </Box>
  );
}

function QualityItem({
  label, sublabel, selected, isDark, onClick,
}: {
  label: string;
  sublabel?: string;
  selected: boolean;
  isDark: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        px: 2,
        py: 1,
        gap: 2,
        border: 'none',
        cursor: 'pointer',
        bgcolor: selected ? (isDark ? alpha('#6366F1', 0.12) : alpha('#6366F1', 0.07)) : 'transparent',
        color: selected ? '#6366F1' : (isDark ? '#E2E8F0' : '#1E293B'),
        textAlign: 'left',
        transition: 'background 0.12s',
        '&:hover': {
          bgcolor: selected
            ? (isDark ? alpha('#6366F1', 0.18) : alpha('#6366F1', 0.1))
            : (isDark ? alpha('#94A3B8', 0.08) : '#F8FAFC'),
        },
      }}
    >
      <Box>
        <Typography variant="body2" sx={{ fontWeight: selected ? 700 : 500, fontSize: '0.875rem', color: 'inherit', lineHeight: 1.3 }}>
          {label}
        </Typography>
        {sublabel && (
          <Typography variant="caption" sx={{ color: isDark ? '#64748B' : '#94A3B8', fontSize: '0.72rem' }}>
            {sublabel}
          </Typography>
        )}
      </Box>
      {selected && <CheckRoundedIcon sx={{ fontSize: 15, color: '#6366F1', flexShrink: 0 }} />}
    </Box>
  );
}
