'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Avatar from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import { ActivityTimeline } from '@/components/UserActivity/ActivityTimeline';
import { fetchUser, fetchVideos } from '@/lib/api';
import { getToken } from '@/lib/auth-client';
import type { User } from '@/types/user';
import type { Video } from '@/types/video';

const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#0284C7'];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(user: User): string {
  if (user.display_name) return user.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return user.username.slice(0, 2).toUpperCase();
}

export default function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

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
        setVideos(videosResult.value.results.slice(0, 8));
      }
    }).finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rectangular" width={120} height={32} sx={{ borderRadius: 2, mb: 3 }} />
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card><CardContent sx={{ textAlign: 'center', pt: 3 }}>
              <Skeleton variant="circular" width={80} height={80} sx={{ mx: 'auto', mb: 2 }} />
              <Skeleton variant="text" width="60%" sx={{ mx: 'auto', mb: 1 }} />
              <Skeleton variant="text" width="40%" sx={{ mx: 'auto' }} />
            </CardContent></Card>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card><CardContent>
              {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="rectangular" height={56} sx={{ borderRadius: 2, mb: 1.5 }} />)}
            </CardContent></Card>
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error || !user) {
    return (
      <Box>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => router.back()} sx={{ mb: 2, color: 'text.secondary' }}>
          Back
        </Button>
        <Alert severity="error" sx={{ borderRadius: 2 }}>{error ?? 'User not found'}</Alert>
      </Box>
    );
  }

  const color = avatarColor(user.username);

  return (
    <Box>
      {/* Back button */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton
          onClick={() => router.back()}
          size="small"
          sx={{
            bgcolor: isDark ? alpha('#94A3B8', 0.1) : '#F1F5F9',
            '&:hover': { bgcolor: isDark ? alpha('#94A3B8', 0.15) : '#E2E8F0' },
          }}
        >
          <ArrowBackRoundedIcon fontSize="small" />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          User Profile
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Profile card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ p: '24px !important' }}>
              {/* Avatar with glow */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                <Box
                  sx={{
                    position: 'relative',
                    mb: 2,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      inset: -4,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${color}, ${alpha(color, 0.3)})`,
                      opacity: 0.3,
                    },
                  }}
                >
                  <Avatar
                    src={user.avatar_url ?? undefined}
                    sx={{
                      width: 80,
                      height: 80,
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      bgcolor: color,
                      position: 'relative',
                    }}
                  >
                    {initials(user)}
                  </Avatar>
                </Box>

                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {user.display_name || user.username}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  @{user.username}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1,
                      py: 0.3,
                      borderRadius: 1.5,
                      bgcolor: user.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                    }}
                  >
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: user.is_active ? '#10B981' : '#64748B' }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, color: user.is_active ? '#10B981' : 'text.secondary', fontSize: '0.72rem' }}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      px: 1,
                      py: 0.3,
                      borderRadius: 1.5,
                      bgcolor: user.is_email_verified ? 'rgba(2,132,199,0.1)' : 'rgba(100,116,139,0.1)',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600, color: user.is_email_verified ? '#0284C7' : 'text.secondary', fontSize: '0.72rem' }}>
                      {user.is_email_verified ? 'Email Verified' : 'Unverified'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ borderColor: isDark ? alpha('#94A3B8', 0.1) : '#F1F5F9', mb: 2 }} />

              {/* Contact details */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: 1.5,
                      bgcolor: isDark ? alpha('#6366F1', 0.12) : alpha('#6366F1', 0.08),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <EmailRoundedIcon sx={{ fontSize: 15, color: '#6366F1' }} />
                  </Box>
                  <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                    {user.email}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: 1.5,
                      bgcolor: isDark ? alpha('#10B981', 0.12) : alpha('#10B981', 0.08),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CalendarTodayRoundedIcon sx={{ fontSize: 15, color: '#10B981' }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Joined
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </Typography>
                  </Box>
                </Box>

                {(user.profile?.country_code || user.profile?.preferred_language) && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: 1.5,
                        bgcolor: isDark ? alpha('#F59E0B', 0.12) : alpha('#F59E0B', 0.08),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <LanguageRoundedIcon sx={{ fontSize: 15, color: '#F59E0B' }} />
                    </Box>
                    <Box>
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
                    </Box>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Activity */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent sx={{ p: '20px !important' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
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
