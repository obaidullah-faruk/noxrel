'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded';
import { LiveCard } from '@/components/LiveCard/LiveCard';
import { fetchLiveSessions } from '@/lib/live';
import type { LiveSession } from '@/types/live';

const POLL_MS = 20_000;
const MAX_PREVIEW = 4;

// "Live Now" preview shown on the home page above the catalog. Renders nothing
// when no one is live, so it never adds empty chrome to the page.
export function LiveStrip() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchLiveSessions()
        .then(data => { if (!cancelled) setSessions(data); })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (sessions.length === 0) return null;

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SensorsRoundedIcon color="error" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Live Now</Typography>
        </Box>
        <Button component={Link} href="/live" size="small">See all</Button>
      </Box>
      <Grid container spacing={2}>
        {sessions.slice(0, MAX_PREVIEW).map(s => (
          <Grid key={s.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <LiveCard session={s} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
