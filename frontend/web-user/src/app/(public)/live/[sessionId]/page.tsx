'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { alpha, useTheme } from '@mui/material/styles';
import { LivePlayer } from '@/components/LivePlayer/LivePlayer';
import { LiveChat } from '@/components/LiveChat/LiveChat';
import { LiveMeta } from '@/components/LiveMeta/LiveMeta';
import { fetchLiveSession } from '@/lib/live';
import type { LiveSession } from '@/types/live';

const LIVE_POLL_MS = 10_000;
const STITCHING_POLL_MS = 2_000;

export default function LiveWatchPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [session, setSession] = useState<LiveSession | null>(null);
  const [notFound, setNotFound] = useState(false);

  const pollMs = session?.status === 'stitching' ? STITCHING_POLL_MS : LIVE_POLL_MS;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const s = await fetchLiveSession(sessionId);
        if (cancelled) return;

        if (s.status === 'ended' && s.vodVideoId) {
          router.replace(`/videos/${s.vodVideoId}`);
          return;
        }

        setSession(s);
      } catch {
        if (!cancelled) setNotFound(true);
      }
    };

    void load();
    const interval = setInterval(load, pollMs);
    return () => { cancelled = true; clearInterval(interval); };
  }, [sessionId, router, pollMs]);

  if (notFound) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6">This stream is not available.</Typography>
      </Box>
    );
  }

  if (!session) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const isStitching = session.status === 'stitching';
  const isFailed = session.status === 'stitch_failed' || session.status === 'error';
  const endedWithoutReplay = session.status === 'ended' && !session.vodVideoId;

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          {isStitching ? (
            <Box
              sx={{
                width: '100%',
                aspectRatio: '16 / 9',
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                bgcolor: isDark ? '#161D2E' : '#F1F5F9',
                border: `1px solid ${isDark ? alpha('#94A3B8', 0.1) : '#E2E8F0'}`,
              }}
            >
              <CircularProgress size={32} />
              <Typography variant="body1" color="text.secondary">
                Stream ended — preparing replay…
              </Typography>
            </Box>
          ) : isFailed || endedWithoutReplay ? (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {isFailed
                ? 'This stream replay could not be prepared. Please try again later.'
                : 'This stream has ended but no replay is available.'}
            </Alert>
          ) : (
            <LivePlayer sessionId={session.id} hlsMasterUrl={session.hlsMasterUrl} />
          )}
          <LiveMeta session={session} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <LiveChat sessionId={session.id} />
        </Grid>
      </Grid>
    </Box>
  );
}
