'use client';
import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { alpha, useTheme } from '@mui/material/styles';
import { StatsCards } from '@/components/Dashboard/StatsCards';
import { ViewsChart, type DailyViews } from '@/components/Dashboard/ViewsChart';
import { SignupsChart, type DailySignups } from '@/components/Dashboard/SignupsChart';
import { TranscodeQueueTable } from '@/components/Dashboard/TranscodeQueueTable';
import { fetchVideos } from '@/lib/api';
import { getToken } from '@/lib/auth-client';
import type { Video } from '@/types/video';
import WavingHandRoundedIcon from '@mui/icons-material/WavingHandRounded';

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

function SkeletonCard() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Card>
      <CardContent sx={{ p: '20px !important' }}>
        <Skeleton variant="text" width="40%" sx={{ mb: 1 }} />
        <Skeleton variant="text" width="60%" height={40} />
        <Skeleton variant="text" width="30%" />
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [videos, setVideos]   = useState<Video[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    getToken().then(token =>
      fetchVideos(token, { page: 1, page_size: 100 })
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

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <Box>
      {/* Page Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          mb: 3,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <WavingHandRoundedIcon sx={{ fontSize: 22, color: '#F59E0B' }} />
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}
            >
              Welcome back, Admin
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {today} · Here&apos;s what&apos;s happening on your platform.
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert
          severity="warning"
          sx={{
            mb: 3,
            borderRadius: 2,
            border: `1px solid ${alpha('#F59E0B', 0.3)}`,
            bgcolor: alpha('#F59E0B', 0.05),
          }}
        >
          Backend unavailable — showing cached data. ({error})
        </Alert>
      )}

      {loading ? (
        <Grid container spacing={2.5}>
          {[0, 1, 2, 3].map(i => (
            <Grid item xs={12} sm={6} xl={3} key={i}>
              <SkeletonCard />
            </Grid>
          ))}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent sx={{ p: '20px !important' }}>
                <Skeleton variant="text" width="30%" sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ p: '20px !important' }}>
                <Skeleton variant="text" width="40%" sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={2.5}>
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
