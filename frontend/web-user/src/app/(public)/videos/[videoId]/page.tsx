'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import RemoveRedEyeRoundedIcon from '@mui/icons-material/RemoveRedEyeRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import { VideoPlayer } from '@/components/VideoPlayer/VideoPlayer';
import { fetchVideo, fetchCatalogVideos } from '@/lib/api';
import { useAuth } from '@/components/Auth/AuthContext';
import type { Video } from '@/types/video';

function formatDuration(secs: number | null): string {
  if (!secs) return 'N/A';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}

export default function VideoWatchPage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = use(params);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const { token, authReady } = useAuth();
  const [video, setVideo]         = useState<Video | null>(null);
  const [related, setRelated]     = useState<Video[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) return;
    setLoading(true);
    const tok = token ?? '';
    Promise.allSettled([
      fetchVideo(tok, videoId),
      fetchCatalogVideos(tok, { page: 1, page_size: 8 }),
    ]).then(([videoRes, relatedRes]) => {
      if (videoRes.status === 'fulfilled') {
        setVideo(videoRes.value);
      } else {
        const msg = String(videoRes.reason);
        setError(msg.startsWith('404:') ? 'This video is no longer available.' : 'Failed to load video. Please try again.');
      }
      if (relatedRes.status === 'fulfilled') {
        setRelated(relatedRes.value.results.filter((v: Video) => v.id !== videoId).slice(0, 6));
      }
    }).finally(() => setLoading(false));
  }, [videoId, token, authReady]);

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
        <Skeleton variant="rectangular" width={100} height={32} sx={{ borderRadius: 2, mb: 3 }} />
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Skeleton variant="rectangular" sx={{ width: '100%', paddingTop: '56.25%', borderRadius: 2 }} />
            <Skeleton variant="text" width="70%" height={40} sx={{ mt: 2 }} />
            <Skeleton variant="text" width="40%" />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            {[1,2,3,4].map(i => (
              <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                <Skeleton variant="rectangular" width={120} height={68} sx={{ borderRadius: 1, flexShrink: 0 }} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" />
                  <Skeleton variant="text" width="60%" />
                </Box>
              </Box>
            ))}
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error || !video) {
    return (
      <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
        <Button startIcon={<ArrowBackRoundedIcon />} component={Link} href="/" sx={{ mb: 2, color: 'text.secondary' }}>
          Back
        </Button>
        <Alert severity="error" sx={{ borderRadius: 2 }}>{error ?? 'Video not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
      <Button
        startIcon={<ArrowBackRoundedIcon />}
        component={Link}
        href="/"
        size="small"
        sx={{ mb: 2, color: 'text.secondary', fontWeight: 500 }}
      >
        Back to Browse
      </Button>

      <Grid container spacing={3}>
        {/* Main: Player + Info */}
        <Grid size={{ xs: 12, md: 8 }}>
          {/* Player */}
          {video.status === 'ready' ? (
            video.is_live && video.hls_manifest_url ? (
              <VideoPlayer videoId={video.id} manifestUrl={video.hls_manifest_url} />
            ) : (
              <VideoPlayer videoId={video.id} />
            )
          ) : (
            <Box
              sx={{
                width: '100%',
                paddingTop: '56.25%',
                position: 'relative',
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: isDark ? '#161D2E' : '#F1F5F9',
                border: `1px solid ${isDark ? alpha('#94A3B8', 0.1) : '#E2E8F0'}`,
              }}
            >
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">Video not available for playback</Typography>
                <Typography variant="caption" color="text.secondary">Status: {video.status}</Typography>
              </Box>
            </Box>
          )}

          {/* Video info */}
          <Box sx={{ mt: 2.5 }}>
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.3, mb: 1 }}
            >
              {video.title}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <RemoveRedEyeRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  {video.view_count.toLocaleString()} views
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  {formatDuration(video.duration_seconds)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CalendarTodayRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  {new Date(video.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </Typography>
              </Box>
            </Box>

            {video.category && (
              <Chip
                label={video.category}
                size="small"
                component={Link}
                href={`/?category=${encodeURIComponent(video.category)}`}
                clickable
                sx={{
                  mb: 2,
                  fontWeight: 600,
                  bgcolor: isDark ? alpha('#6366F1', 0.12) : alpha('#6366F1', 0.08),
                  color: '#6366F1',
                  border: `1px solid ${alpha('#6366F1', 0.2)}`,
                }}
              />
            )}

            {video.description && (
              <>
                <Divider sx={{ borderColor: isDark ? alpha('#94A3B8', 0.1) : '#F1F5F9', mb: 2 }} />
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {video.description}
                </Typography>
              </>
            )}

            {video.tags?.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 2 }}>
                {video.tags.map(tag => (
                  <Chip
                    key={tag}
                    label={`#${tag}`}
                    size="small"
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      bgcolor: isDark ? alpha('#94A3B8', 0.08) : alpha('#64748B', 0.06),
                      color: 'text.secondary',
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Grid>

        {/* Sidebar: Related videos */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
            More Videos
          </Typography>
          {related.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No related videos</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {related.map(v => (
                <Box
                  key={v.id}
                  component={Link}
                  href={`/videos/${v.id}`}
                  sx={{
                    display: 'flex',
                    gap: 1.5,
                    textDecoration: 'none',
                    p: 1,
                    borderRadius: 2,
                    transition: 'background 0.12s',
                    '&:hover': { bgcolor: isDark ? alpha('#94A3B8', 0.06) : alpha('#64748B', 0.04) },
                  }}
                >
                  {/* Thumbnail */}
                  <Box
                    sx={{
                      width: 120,
                      height: 68,
                      borderRadius: 1.5,
                      flexShrink: 0,
                      overflow: 'hidden',
                      bgcolor: isDark ? '#161D2E' : '#E2E8F0',
                      position: 'relative',
                    }}
                  >
                    {v.thumbnail_url ? (
                      <Box
                        component="img"
                        src={v.thumbnail_url}
                        alt={v.title}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <Box sx={{ width: '100%', height: '100%', background: isDark ? 'linear-gradient(135deg, #1E2535, #161D2E)' : 'linear-gradient(135deg, #E2E8F0, #CBD5E1)' }} />
                    )}
                  </Box>
                  {/* Info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        color: 'text.primary',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.4,
                        mb: 0.5,
                        fontSize: '0.8rem',
                      }}
                    >
                      {v.title}
                    </Typography>
                    {v.category && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {v.category}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
