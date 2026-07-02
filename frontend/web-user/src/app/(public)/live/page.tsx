'use client';
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded';
import { LiveCard } from '@/components/LiveCard/LiveCard';
import { fetchLiveSessions } from '@/lib/live';
import type { LiveSession } from '@/types/live';

const POLL_MS = 15_000;

export default function LiveNowPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchLiveSessions()
        .then(data => { if (!cancelled) setSessions(data); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const interval = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <SensorsRoundedIcon color="error" />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Live Now</Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : sessions.length === 0 ? (
        <Typography variant="body1" sx={{ color: 'text.secondary', py: 4 }}>
          No one is live right now. Check back soon.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {sessions.map(s => (
            <Grid key={s.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <LiveCard session={s} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
