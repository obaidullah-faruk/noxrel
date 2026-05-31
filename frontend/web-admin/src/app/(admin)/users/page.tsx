'use client';
import { useCallback, useEffect, useRef, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Card from '@mui/material/Card';
import { alpha, useTheme } from '@mui/material/styles';
import { DataGrid, type GridColDef, type GridPaginationModel } from '@mui/x-data-grid';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { fetchUsers } from '@/lib/api';
import { getToken } from '@/lib/auth-client';
import type { User } from '@/types/user';

const DEFAULT_PAGE_SIZE = 20;
const VALID_PAGE_SIZES = [10, 20, 50];
const SEARCH_DEBOUNCE_MS = 300;

const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#0284C7',
];

function initials(user: User): string {
  if (user.display_name) {
    return user.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  return user.username.slice(0, 2).toUpperCase();
}

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function UsersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const rawPage     = Number(searchParams.get('page') ?? '0');
  const rawPageSize = Number(searchParams.get('page_size') ?? String(DEFAULT_PAGE_SIZE));
  const page     = Number.isFinite(rawPage) && rawPage >= 0 ? rawPage : 0;
  const pageSize = VALID_PAGE_SIZES.includes(rawPageSize as (typeof VALID_PAGE_SIZES)[number])
    ? rawPageSize
    : DEFAULT_PAGE_SIZE;
  const search = searchParams.get('search') ?? '';

  const [users, setUsers]     = useState<User[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const searchDebounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      fetchUsers(token, { page: p + 1, page_size: ps, search: q || undefined })
        .then(data => {
          setUsers(data.results);
          setTotal(data.count);
          setError(null);
        })
        .catch(err => setError(String(err)))
        .finally(() => setLoading(false))
    );
  }, []);

  useEffect(() => { load(page, pageSize, search); }, [load, page, pageSize, search]);

  const columns = useMemo<GridColDef<User>[]>(() => [
    {
      field: 'display_name',
      headerName: 'User',
      flex: 2,
      minWidth: 220,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            src={row.avatar_url ?? undefined}
            sx={{
              width: 32,
              height: 32,
              fontSize: '0.75rem',
              fontWeight: 700,
              bgcolor: avatarColor(row.username),
            }}
          >
            {initials(row)}
          </Avatar>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
              {row.display_name || row.username}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              @{row.username}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 2,
      minWidth: 200,
      renderCell: ({ value }) => (
        <Typography variant="body2" color="text.secondary">
          {value as string}
        </Typography>
      ),
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 110,
      renderCell: ({ value }) => (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.25,
            borderRadius: 1.5,
            bgcolor: value ? 'rgba(16,185,129,0.1)' : isDark ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.08)',
          }}
        >
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: value ? '#10B981' : '#64748B' }} />
          <Typography variant="caption" sx={{ fontWeight: 600, color: value ? '#10B981' : 'text.secondary', fontSize: '0.72rem' }}>
            {value ? 'Active' : 'Inactive'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'is_email_verified',
      headerName: 'Verified',
      width: 110,
      renderCell: ({ value }) => (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            px: 1,
            py: 0.25,
            borderRadius: 1.5,
            bgcolor: value ? 'rgba(2,132,199,0.1)' : isDark ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.08)',
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600, color: value ? '#0284C7' : 'text.secondary', fontSize: '0.72rem' }}>
            {value ? 'Verified' : 'Pending'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'created_at',
      headerName: 'Joined',
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
          href={`/users/${row.id}`}
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
  ], [theme, isDark]);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          User Management
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {total.toLocaleString()} {total === 1 ? 'user' : 'users'} registered
        </Typography>
      </Box>

      <Box sx={{ mb: 2.5 }}>
        <TextField
          defaultValue={search}
          onChange={handleSearchChange}
          placeholder="Search by username or email…"
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
          rows={users}
          columns={columns}
          loading={loading}
          rowCount={total}
          paginationMode="server"
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={handlePaginationChange}
          pageSizeOptions={VALID_PAGE_SIZES}
          disableRowSelectionOnClick
          autoHeight
          sx={{
            border: 'none',
            '--DataGrid-overlayHeight': '300px',
            '& .MuiDataGrid-columnHeaders': {
              bgcolor: isDark ? alpha('#94A3B8', 0.04) : '#F8FAFC',
              borderBottom: `1px solid ${isDark ? alpha('#94A3B8', 0.1) : '#E2E8F0'}`,
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 600,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'text.secondary',
            },
            '& .MuiDataGrid-cell': {
              borderColor: isDark ? alpha('#94A3B8', 0.06) : '#F1F5F9',
              alignItems: 'center',
            },
            '& .MuiDataGrid-row:hover': {
              bgcolor: isDark ? alpha('#6366F1', 0.06) : alpha('#6366F1', 0.03),
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop: `1px solid ${isDark ? alpha('#94A3B8', 0.08) : '#F1F5F9'}`,
            },
          }}
        />
      </Card>
    </Box>
  );
}

export default function UsersPage() {
  return (
    <Suspense>
      <UsersPageInner />
    </Suspense>
  );
}
