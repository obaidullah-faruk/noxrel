'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import { ActivityTimeline } from '@/components/UserActivity/ActivityTimeline';
import { fetchUser, fetchVideos } from '@/lib/api';
import { getToken } from '@/lib/auth-client';
import type { User } from '@/types/user';
import type { Video } from '@/types/video';

export default function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const router = useRouter();
  const [user, setUser]         = useState<User | null>(null);
  const [videos, setVideos]     = useState<Video[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    getToken().then(token => Promise.allSettled([
      fetchUser(token, userId),
      fetchVideos(token, { page: 1 }),
    ])).then(([userResult, videosResult]) => {
      if (userResult.status === 'fulfilled') {
        setUser(userResult.value);
      } else {
        setError(String(userResult.reason));
      }
      if (videosResult.status === 'fulfilled') {
        // Show recently updated videos as a proxy for watch activity
        // until a dedicated watch-history projection endpoint exists (Phase 08)
        setVideos(videosResult.value.results.slice(0, 8));
      }
    }).finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !user) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.back()} sx={{ mb: 2 }}>
          Back
        </Button>
        <Alert severity="error">{error ?? 'User not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => router.back()} sx={{ mb: 2 }}>
        Back to Users
      </Button>

      <Grid container spacing={3}>
        {/* Profile Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center', pt: 3 }}>
              <Avatar
                src={user.avatar_url ?? undefined}
                sx={{ width: 80, height: 80, mx: 'auto', mb: 2, bgcolor: 'primary.main' }}
              >
                <PersonIcon sx={{ fontSize: 40 }} />
              </Avatar>
              <Typography variant="h6" fontWeight={700}>
                {user.display_name || user.username}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                @{user.username}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user.email}
              </Typography>

              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={user.is_active ? 'Active' : 'Inactive'}
                  size="small"
                  color={user.is_active ? 'success' : 'default'}
                />
                <Chip
                  label={user.is_email_verified ? 'Verified' : 'Unverified'}
                  size="small"
                  color={user.is_email_verified ? 'info' : 'default'}
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="caption" color="text.secondary" display="block">
                Joined: {new Date(user.created_at).toLocaleDateString()}
              </Typography>
              {user.profile?.country_code && (
                <Typography variant="caption" color="text.secondary" display="block">
                  Country: {user.profile.country_code}
                </Typography>
              )}
              {user.profile?.preferred_language && (
                <Typography variant="caption" color="text.secondary" display="block">
                  Language: {user.profile.preferred_language}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Activity Timeline */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Recent Activity
              </Typography>
              <ActivityTimeline watchedVideos={videos} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
