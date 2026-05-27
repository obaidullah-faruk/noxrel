'use client';
import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import { StatsCards } from '@/components/Dashboard/StatsCards';
import { ViewsChart, type DailyViews } from '@/components/Dashboard/ViewsChart';
import { SignupsChart, type DailySignups } from '@/components/Dashboard/SignupsChart';
import { TranscodeQueueTable } from '@/components/Dashboard/TranscodeQueueTable';
import { fetchVideos } from '@/lib/api';
import { getToken } from '@/lib/auth-client';
import type { Video } from '@/types/video';

function buildViewsSeed(): DailyViews[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), views: 0 };
  });
}

function buildSignupsSeed(): DailySignups[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), signups: 0 };
  });
}

export default function DashboardPage() {
  const [videos, setVideos]   = useState<Video[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    getToken().then(token =>
      fetchVideos(token, { page: 1 })
        .then(data => {
          setVideos(data.results);
          setTotal(data.count);
        })
        .catch(err => setError(String(err)))
        .finally(() => setLoading(false))
    );
  }, []);

  const videosReady      = videos.filter(v => v.status === 'ready').length;
  const videosProcessing = videos.filter(v => v.status === 'processing' || v.status === 'uploading').length;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Dashboard
      </Typography>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Could not reach backend services — showing available data. ({error})
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <StatsCards
              totalVideos={total}
              totalUsers={0}
              videosReady={videosReady}
              videosProcessing={videosProcessing}
            />
          </Grid>
          <Grid item xs={12} md={8}>
            <ViewsChart data={buildViewsSeed()} />
          </Grid>
          <Grid item xs={12} md={4}>
            <SignupsChart data={buildSignupsSeed()} />
          </Grid>
          <Grid item xs={12}>
            <TranscodeQueueTable rows={videos.slice(0, 10)} />
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
