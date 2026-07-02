'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { LivePlayer } from '@/components/LivePlayer/LivePlayer';
import { LiveChat } from '@/components/LiveChat/LiveChat';
import { LiveMeta } from '@/components/LiveMeta/LiveMeta';
import { fetchLiveSession } from '@/lib/live';
import type { LiveSession } from '@/types/live';

const POLL_MS = 10_000;

export default function LiveWatchPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const s = await fetchLiveSession(sessionId);
        if (cancelled) return;
        // Stream ended — send the viewer to the VOD replay on the normal page.
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
    const interval = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [sessionId, router]);

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

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <LivePlayer sessionId={session.id} hlsMasterUrl={session.hlsMasterUrl} />
          <LiveMeta session={session} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <LiveChat sessionId={session.id} />
        </Grid>
      </Grid>
    </Box>
  );
}
