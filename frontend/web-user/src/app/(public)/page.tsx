'use client';
import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Pagination from '@mui/material/Pagination';
import Button from '@mui/material/Button';
import { alpha, useTheme } from '@mui/material/styles';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import { VideoCard } from '@/components/VideoCard/VideoCard';
import { LiveStrip } from '@/components/LiveStrip/LiveStrip';
import { fetchCatalogVideos } from '@/lib/api';
import { useAuth } from '@/components/Auth/AuthContext';
import type { Video } from '@/types/video';

const CATEGORIES = ['All', 'Education', 'Entertainment', 'Gaming', 'Music', 'News', 'Science & Tech', 'Sports', 'Travel'];
const PAGE_SIZE = 24;

function HomePageInner() {
  const searchParams = useSearchParams();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const category = searchParams.get('category') ?? '';
  const pageParam = Number(searchParams.get('page') ?? '1');
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;
  const { token, authReady } = useAuth();

  const [videos, setVideos]       = useState<Video[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [unauthenticated, setUnauthenticated] = useState(false);

  const load = useCallback((pg: number, cat: string, tok: string) => {
    setLoading(true);
    setUnauthenticated(false);
    fetchCatalogVideos(tok, { page: pg, page_size: PAGE_SIZE, category: cat && cat !== 'all' && cat !== 'All' ? cat : undefined })
      .then(data => {
        setVideos(data.results);
        setTotal(data.count);
      })
      .catch(err => {
        const msg = String(err);
        if (msg.includes('401') || msg.includes('403')) {
          setUnauthenticated(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!authReady) return;
    load(page, category, token ?? '');
  }, [load, page, category, token, authReady]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
      {/* Hero */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 800, letterSpacing: '-0.03em', mb: 0.5 }}
        >
          Discover Videos
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Stream the latest uploads in HD quality
        </Typography>
      </Box>

      {/* Live Now — renders only when streams are live */}
      <LiveStrip />

      {/* Category filter */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        {CATEGORIES.map(cat => {
          const active = cat === 'All' ? !category || category === 'all' : category === cat;
          const href = cat === 'All' ? '/' : `/?category=${encodeURIComponent(cat)}`;
          return (
            <Chip
              key={cat}
              label={cat}
              component="a"
              href={href}
              clickable
              size="small"
              sx={{
                fontWeight: active ? 700 : 500,
                bgcolor: active
                  ? (isDark ? alpha('#6366F1', 0.2) : alpha('#6366F1', 0.1))
                  : (isDark ? alpha('#94A3B8', 0.08) : alpha('#64748B', 0.07)),
                color: active ? '#6366F1' : 'text.secondary',
                border: active ? `1px solid ${alpha('#6366F1', 0.35)}` : `1px solid transparent`,
                '&:hover': {
                  bgcolor: active
                    ? (isDark ? alpha('#6366F1', 0.25) : alpha('#6366F1', 0.15))
                    : (isDark ? alpha('#94A3B8', 0.12) : alpha('#64748B', 0.1)),
                },
              }}
            />
          );
        })}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} thickness={3} sx={{ color: '#6366F1' }} />
        </Box>
      ) : unauthenticated ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: isDark ? alpha('#6366F1', 0.12) : alpha('#6366F1', 0.08),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 1,
            }}
          >
            <PlayCircleOutlineRoundedIcon sx={{ fontSize: 32, color: '#6366F1' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Sign in to browse videos
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 340 }}>
            Create a free account or sign in to start watching thousands of videos in HD quality.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
            <Button
              href="/login"
              variant="outlined"
              sx={{
                borderColor: alpha('#6366F1', 0.5),
                color: '#6366F1',
                '&:hover': { borderColor: '#6366F1', bgcolor: alpha('#6366F1', 0.06) },
              }}
            >
              Sign In
            </Button>
            <Button
              href="/signup"
              variant="contained"
              sx={{
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' },
              }}
            >
              Create Account
            </Button>
          </Box>
        </Box>
      ) : videos.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">No videos yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Check back soon for new content
          </Typography>
        </Box>
      ) : (
        <>
          <Grid container spacing={2.5}>
            {videos.map(video => (
              <Grid key={video.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <VideoCard video={video} />
              </Grid>
            ))}
          </Grid>
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={totalPages}
                page={page}
                shape="rounded"
                sx={{
                  '& .MuiPaginationItem-root': {
                    borderRadius: 2,
                    fontWeight: 500,
                  },
                  '& .MuiPaginationItem-root.Mui-selected': {
                    background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                    color: '#fff',
                    fontWeight: 700,
                    '&:hover': { background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' },
                  },
                }}
                onChange={(_, pg) => {
                  const params = new URLSearchParams();
                  params.set('page', String(pg));
                  if (category) params.set('category', category);
                  window.location.href = `/?${params}`;
                }}
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomePageInner />
    </Suspense>
  );
}
