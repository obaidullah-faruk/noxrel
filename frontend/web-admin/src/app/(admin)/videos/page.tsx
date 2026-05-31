'use client';
import { useCallback, useEffect, useState, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Card from '@mui/material/Card';
import { alpha, useTheme } from '@mui/material/styles';
import { DataGrid, type GridColDef, type GridPaginationModel } from '@mui/x-data-grid';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { fetchVideos } from '@/lib/api';
import { getToken } from '@/lib/auth-client';
import { VideoUploadDialog } from '@/components/VideoUpload/VideoUploadDialog';
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

function PublishedBadge({ published }: { published: boolean }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: 0.25,
        borderRadius: 1.5,
        bgcolor: published ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.08)',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          color: published ? '#10B981' : 'text.secondary',
          fontSize: '0.72rem',
        }}
      >
        {published ? 'Live' : 'Draft'}
      </Typography>
    </Box>
  );
}

function VideosPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();

  const rawPage     = Number(searchParams.get('page') ?? '0');
  const rawPageSize = Number(searchParams.get('page_size') ?? String(DEFAULT_PAGE_SIZE));
  const page     = Number.isFinite(rawPage) && rawPage >= 0 ? rawPage : 0;
  const pageSize = VALID_PAGE_SIZES.includes(rawPageSize as (typeof VALID_PAGE_SIZES)[number])
    ? rawPageSize
    : DEFAULT_PAGE_SIZE;
  const search = searchParams.get('search') ?? '';

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

  function handlePaginationChange(model: GridPaginationModel) {
    navigate(model.page, model.pageSize, search);
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

  const columns = useMemo<GridColDef<Video>[]>(() => [
    {
      field: 'title',
      headerName: 'Title',
      flex: 2,
      minWidth: 200,
      renderCell: ({ value }) => (
        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
          {value || '(untitled)'}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: ({ value }) => <StatusBadge status={value} />,
    },
    {
      field: 'category',
      headerName: 'Category',
      width: 140,
      renderCell: ({ value }) => (
        <Typography variant="body2" color="text.secondary">
          {value || '—'}
        </Typography>
      ),
    },
    {
      field: 'view_count',
      headerName: 'Views',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      type: 'number',
      renderCell: ({ value }) => (
        <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', width: '100%', textAlign: 'right' }}>
          {(value as number).toLocaleString()}
        </Typography>
      ),
    },
    {
      field: 'is_published',
      headerName: 'Published',
      width: 110,
      renderCell: ({ value }) => <PublishedBadge published={Boolean(value)} />,
    },
    {
      field: 'created_at',
      headerName: 'Created',
      width: 140,
      renderCell: ({ value }) => (
        <Typography variant="body2" color="text.secondary">
          {new Date(value as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 56,
      sortable: false,
      disableColumnMenu: true,
      renderCell: ({ row }) => (
        <IconButton
          size="small"
          component={Link}
          href={`/videos/${row.id}`}
          sx={{
            color: 'text.secondary',
            '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08) },
          }}
        >
          <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [theme]);

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
            '&:hover': { background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' },
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
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
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

      <Card sx={{ borderRadius: 2 }}>
        <DataGrid
          rows={videos}
          columns={columns}
          loading={loading}
          rowCount={total}
          paginationMode="server"
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={handlePaginationChange}
          pageSizeOptions={VALID_PAGE_SIZES}
          disableRowSelectionOnClick
          autoHeight
          rowHeight={52}
          sx={{
            border: 'none',
            '--DataGrid-overlayHeight': '300px',
            '& .MuiDataGrid-columnHeaders': {
              bgcolor: theme.palette.mode === 'dark' ? alpha('#94A3B8', 0.04) : '#F8FAFC',
              borderBottom: `1px solid ${theme.palette.mode === 'dark' ? alpha('#94A3B8', 0.1) : '#E2E8F0'}`,
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 600,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'text.secondary',
            },
            '& .MuiDataGrid-cell': {
              borderColor: theme.palette.mode === 'dark' ? alpha('#94A3B8', 0.06) : '#F1F5F9',
              display: 'flex',
              alignItems: 'center',
            },
            '& .MuiDataGrid-row:hover': {
              bgcolor: theme.palette.mode === 'dark' ? alpha('#6366F1', 0.06) : alpha('#6366F1', 0.03),
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop: `1px solid ${theme.palette.mode === 'dark' ? alpha('#94A3B8', 0.08) : '#F1F5F9'}`,
            },
          }}
        />
      </Card>
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
