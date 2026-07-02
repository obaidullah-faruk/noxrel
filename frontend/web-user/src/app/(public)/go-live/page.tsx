'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { io, type Socket } from 'socket.io-client';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha, useTheme } from '@mui/material/styles';
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import ScreenShareRoundedIcon from '@mui/icons-material/ScreenShareRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded';
import { useAuth } from '@/components/Auth/AuthContext';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:8100';
const CHUNK_MS = 1000;
const MIME_CANDIDATES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

type Source = 'camera' | 'screen';
type Phase = 'setup' | 'preview' | 'connecting' | 'live';

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIME_CANDIDATES.find(t => MediaRecorder.isTypeSupported(t)) ?? null;
}

export default function GoLivePage() {
  const { token, isLoggedIn, authReady } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [title, setTitle] = useState('');
  // Starts unselected so the first click on either toggle is a real change —
  // an exclusive ToggleButtonGroup treats clicking the already-selected value
  // as a deselect (onChange fires null), which would swallow the first click.
  const [source, setSource] = useState<Source | null>(null);
  const [phase, setPhase] = useState<Phase>('setup');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const teardown = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    recorderRef.current = null;
    socketRef.current?.disconnect();
    socketRef.current = null;
    stopTracks();
  }, [stopTracks]);

  // Always tear down media + sockets when leaving the page.
  useEffect(() => teardown, [teardown]);

  const acquire = async (src: Source) => {
    setError(null);
    try {
      let stream: MediaStream;
      if (src === 'camera') {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
      } else {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        // Screen capture often has no audio — add the mic so the stream always
        // carries an audio track (the encoder maps one audio rung per rendition).
        let micTracks: MediaStreamTrack[] = [];
        if (display.getAudioTracks().length === 0) {
          try {
            const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
            micTracks = mic.getAudioTracks();
          } catch { /* no mic available — proceed video-only */ }
        }
        stream = new MediaStream([...display.getVideoTracks(), ...display.getAudioTracks(), ...micTracks]);
      }

      // If the user stops the OS screen-share, end the broadcast.
      stream.getVideoTracks()[0]?.addEventListener('ended', () => endBroadcast());

      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setSource(src);
      setPhase('preview');
    } catch {
      setError('Could not access your camera/screen. Check browser permissions and try again.');
    }
  };

  const goLive = () => {
    const stream = streamRef.current;
    if (!stream || !token || !title.trim()) return;

    const mimeType = pickMimeType();
    if (!mimeType) {
      setError('Your browser does not support in-browser broadcasting. Try Chrome, Edge, or Firefox.');
      return;
    }
    if (stream.getAudioTracks().length === 0) {
      setError('No microphone detected. Enable a mic so your stream has audio, then try again.');
      return;
    }

    setError(null);
    setPhase('connecting');

    const socket = io(`${GATEWAY}/live-ingest`, {
      path: '/api/v1/live/socket.io',
      auth: { token },
      query: { title: title.trim() },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect_error', () => {
      setError('Could not connect to the streaming server.');
      teardown();
      setPhase('preview');
    });

    socket.on('ingest_error', (e: { message?: string }) => {
      setError(e.message ?? 'The broadcast could not be started.');
      teardown();
      setPhase('setup');
    });

    socket.on('live_started', ({ sessionId: id }: { sessionId: string }) => {
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0 && socket.connected) {
          e.data.arrayBuffer().then(buf => socket.emit('chunk', buf)).catch(() => {});
        }
      };
      recorder.start(CHUNK_MS);
      recorderRef.current = recorder;
      setSessionId(id);
      setPhase('live');
    });
  };

  const endBroadcast = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    socketRef.current?.emit('stop');
    teardown();
    setSessionId(null);
    setPhase('setup');
    setTitle('');
  }, [teardown]);

  if (!authReady) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  }

  if (!isLoggedIn) {
    return (
      <Box sx={{ maxWidth: 560, mx: 'auto', px: 2, py: 8, textAlign: 'center' }}>
        <SensorsRoundedIcon color="error" sx={{ fontSize: 48, mb: 2 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Go Live</Typography>
        <Typography sx={{ color: 'text.secondary', mb: 3 }}>Sign in to start broadcasting.</Typography>
        <Button component={Link} href="/login?next=/go-live" variant="contained">Sign In</Button>
      </Box>
    );
  }

  const isLive = phase === 'live';
  const busy = phase === 'connecting';

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <SensorsRoundedIcon color="error" />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Go Live</Typography>
        {isLive && (
          <Box sx={{ ml: 1, px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#EF4444', animation: 'pulse 1.4s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#EF4444' }}>LIVE</Typography>
          </Box>
        )}
      </Box>
      <Typography sx={{ color: 'text.secondary', mb: 3 }}>
        Stream straight from your browser — no software to install.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Preview */}
      <Card variant="outlined" sx={{ borderRadius: 3, mb: 2, overflow: 'hidden' }}>
        <Box sx={{ position: 'relative', bgcolor: '#000', aspectRatio: '16 / 9' }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
          {phase === 'setup' && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, color: alpha('#fff', 0.7) }}>
              <VideocamRoundedIcon sx={{ fontSize: 40 }} />
              <Typography variant="body2">Choose a source to preview your stream</Typography>
            </Box>
          )}
        </Box>
      </Card>

      {!isLive ? (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <ToggleButtonGroup
              exclusive
              value={source}
              onChange={(_, v: Source | null) => v && acquire(v)}
              disabled={busy}
              sx={{ alignSelf: 'flex-start' }}
            >
              <ToggleButton value="camera" sx={{ gap: 1, px: 2 }}>
                <VideocamRoundedIcon fontSize="small" /> Camera
              </ToggleButton>
              <ToggleButton value="screen" sx={{ gap: 1, px: 2 }}>
                <ScreenShareRoundedIcon fontSize="small" /> Screen
              </ToggleButton>
            </ToggleButtonGroup>

            <TextField
              label="Stream title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              fullWidth
              size="small"
              disabled={busy}
            />

            <Button
              variant="contained"
              color="error"
              size="large"
              startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <SensorsRoundedIcon />}
              disabled={phase !== 'preview' || !title.trim() || busy}
              onClick={goLive}
              sx={{ alignSelf: 'flex-start', fontWeight: 700, px: 3 }}
            >
              {busy ? 'Connecting…' : 'Go Live'}
            </Button>
            {phase === 'setup' && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Pick <b>Camera</b> or <b>Screen</b> above, grant access, add a title, then Go Live.
              </Typography>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card variant="outlined" sx={{ borderRadius: 3, borderColor: alpha('#EF4444', 0.4) }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                You&apos;re broadcasting. Viewers can watch on the Live page.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {sessionId && (
                <Button
                  component={Link}
                  href={`/live/${sessionId}`}
                  target="_blank"
                  variant="outlined"
                  startIcon={<VisibilityRoundedIcon />}
                >
                  Watch
                </Button>
              )}
              <Button
                variant="contained"
                color="error"
                startIcon={<StopCircleRoundedIcon />}
                onClick={endBroadcast}
                sx={{ fontWeight: 700 }}
              >
                End stream
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
