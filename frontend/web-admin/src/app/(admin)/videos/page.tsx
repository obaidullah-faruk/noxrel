'use client';
import { useCallback, useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import { alpha, useTheme } from '@mui/material/styles';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import VideoFileRoundedIcon from '@mui/icons-material/VideoFileRounded';
import { fetchVideos } from '@/lib/api';
import { getToken } from '@/lib/auth-client';
import { VideoUploadDialog } from '@/components/VideoUpload/VideoUploadDialog';
import { PaginatedTable } from '@/components/DataTable/PaginatedTable';
import type { Video, VideoStatus } from '@/types/video';

const DEFAULT_PAGE_SIZE = 20;
const VALID_PAGE_SIZES = [10, 20, 50];
const SEARCH_DEBOUNCE_MS = 300;

function StatusBadge({ status }: { status: VideoStatus | string }) {
  const configs: Record<string, { label: string; color: string; bg: string }> = {
    processing: { label: 'Processing', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    uploading:  { label: 'Uploading',  color: '#38BDF8', bg: 'rgba(56,189,248,0.1)' },
    ready:      { label: 'Ready',      color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
    failed:     { label: 'Failed',     color: '#EF4444', bg: 'rgba(239,68,68,0.1)'  },
  };
  const cfg = configs[status] ?? { label: status, color: '#64748B', bg: 'rgba(100,116,139,0.1)' };

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.25,
        borderRadius: 1.5,
        bgcolor: cfg.bg,
      }}
    >
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: cfg.color,
          ...(status === 'processing' && {
            animation: 'pulse 1.5s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.4 },
            },
          }),
        }}
      />
      <Typography variant="caption" sx={{ fontWeight: 600, color: cfg.color, fontSize: '0.72rem' }}>
        {cfg.label}
      </Typography>
    </Box>
  );
}

function VideosPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const rawPage     = Number(searchParams.get('page') ?? '0');
  const rawPageSize = Number(searchParams.get('page_size') ?? String(DEFAULT_PAGE_SIZE));
  const page     = Number.isFinite(rawPage) && rawPage >= 0 ? rawPage : 0;
  const pageSize = VALID_PAGE_SIZES.includes(rawPageSize as typeof VALID_PAGE_SIZES[number])
    ? rawPageSize
    : DEFAULT_PAGE_SIZE;
  const search   = searchParams.get('search') ?? '';

  const [videos, setVideos]         = useState<Video[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const searchDebounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navigate(p: number, ps: number, q: string) {
    const params = new URLSearchParams({ page: String(p), page_size: String(ps) });
    if (q) params.set('search', q);
    router.replace(`?${params}`);
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => navigate(0, pageSize, q), SEARCH_DEBOUNCE_MS);
  }

  const load = useCallback((p: number, ps: number, q: string) => {
    setLoading(true);
    getToken().then(token =>
      fetchVideos(token, { page: p + 1, page_size: ps, search: q || undefined })
        .then(data => {
          setVideos(data.results);
          setTotal(data.count);
          setError(null);
        })
        .catch(err => setError(String(err)))
        .finally(() => setLoading(false))
    );
  }, []);

  useEffect(() => { load(page, pageSize, search); }, [load, page, pageSize, search]);

  const handleUploaded = (videoId: string) => {
    router.push(`/videos/${videoId}`);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
            Video Library
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {total.toLocaleString()} {total === 1 ? 'video' : 'videos'} total
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setUploadOpen(true)}
          sx={{
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
            },
          }}
        >
          Upload Video
        </Button>
      </Box>

      <Box sx={{ mb: 2.5 }}>
        <TextField
          defaultValue={search}
          onChange={handleSearchChange}
          placeholder="Search by title, category…"
          size="small"
          sx={{ width: { xs: '100%', sm: 360 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <VideoUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={handleUploaded}
      />

      {error && (
        <Alert
          severity="warning"
          sx={{ mb: 2, borderRadius: 2, border: `1px solid ${alpha('#F59E0B', 0.3)}`, bgcolor: alpha('#F59E0B', 0.05) }}
        >
          Backend unavailable — {error}
        </Alert>
      )}

      <PaginatedTable
        count={total}
        page={page}
        pageSize={pageSize}
        onPageChange={(p) => navigate(p, pageSize, search)}
        onPageSizeChange={(ps) => navigate(0, ps, search)}
      >
        <TableHead>
          <TableRow>
            <TableCell>Title</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Category</TableCell>
            <TableCell align="right">Views</TableCell>
            <TableCell>Published</TableCell>
            <TableCell>Created</TableCell>
            <TableCell align="right" sx={{ width: 52 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={7}>
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress size={28} thickness={3} />
                </Box>
              </TableCell>
            </TableRow>
          )}
          {!loading && videos.length === 0 && (
            <TableRow>
              <TableCell colSpan={7}>
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <VideoFileRoundedIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3, mb: 1.5 }} />
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    No videos found
                  </Typography>
                  {search && (
                    <Typography variant="body2" color="text.secondary">
                      Try adjusting your search
                    </Typography>
                  )}
                </Box>
              </TableCell>
            </TableRow>
          )}
          {!loading && videos.map(v => (
            <TableRow key={v.id}>
              <TableCell
                sx={{
                  maxWidth: 260,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                }}
              >
                {v.title || '(untitled)'}
              </TableCell>
              <TableCell>
                <StatusBadge status={v.status} />
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {v.category || '—'}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {v.view_count.toLocaleString()}
                </Typography>
              </TableCell>
              <TableCell>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 1,
                    py: 0.25,
                    borderRadius: 1.5,
                    bgcolor: v.is_published ? 'rgba(16,185,129,0.1)' : isDark ? 'rgba(148,163,184,0.1)' : 'rgba(100,116,139,0.08)',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: v.is_published ? '#10B981' : 'text.secondary',
                      fontSize: '0.72rem',
                    }}
                  >
                    {v.is_published ? 'Live' : 'Draft'}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <IconButton
                  size="small"
                  component={Link}
                  href={`/videos/${v.id}`}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': {
                      color: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                    },
                  }}
                >
                  <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </PaginatedTable>
    </Box>
  );
}

export default function VideosPage() {
  return (
    <Suspense>
      <VideosPageInner />
    </Suspense>
  );
}
