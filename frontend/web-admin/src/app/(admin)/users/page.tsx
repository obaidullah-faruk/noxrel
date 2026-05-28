'use client';
import { useCallback, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import InputAdornment from '@mui/material/InputAdornment';
import { alpha, useTheme } from '@mui/material/styles';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import { fetchUsers } from '@/lib/api';
import { getToken } from '@/lib/auth-client';
import { PaginatedTable } from '@/components/DataTable/PaginatedTable';
import type { User } from '@/types/user';
import { useState } from 'react';

const DEFAULT_PAGE_SIZE = 20;
const VALID_PAGE_SIZES = [10, 20, 50];
const SEARCH_DEBOUNCE_MS = 300;

function initials(user: User): string {
  if (user.display_name) {
    return user.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  return user.username.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#0284C7',
];

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
  const pageSize = VALID_PAGE_SIZES.includes(rawPageSize as typeof VALID_PAGE_SIZES[number])
    ? rawPageSize
    : DEFAULT_PAGE_SIZE;
  const search   = searchParams.get('search') ?? '';

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
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
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

      <PaginatedTable
        count={total}
        page={page}
        pageSize={pageSize}
        onPageChange={(p) => navigate(p, pageSize, search)}
        onPageSizeChange={(ps) => navigate(0, ps, search)}
      >
        <TableHead>
          <TableRow>
            <TableCell>User</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Verified</TableCell>
            <TableCell>Joined</TableCell>
            <TableCell align="right" sx={{ width: 52 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={6}>
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress size={28} thickness={3} />
                </Box>
              </TableCell>
            </TableRow>
          )}
          {!loading && users.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <PeopleRoundedIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3, mb: 1.5 }} />
                  <Typography variant="body1" color="text.secondary">
                    No users found
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          )}
          {!loading && users.map(u => (
            <TableRow key={u.id}>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar
                    src={u.avatar_url ?? undefined}
                    sx={{
                      width: 32,
                      height: 32,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      bgcolor: avatarColor(u.username),
                    }}
                  >
                    {initials(u)}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                      {u.display_name || u.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      @{u.username}
                    </Typography>
                  </Box>
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {u.email}
                </Typography>
              </TableCell>
              <TableCell>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.25,
                    borderRadius: 1.5,
                    bgcolor: u.is_active ? 'rgba(16,185,129,0.1)' : isDark ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.08)',
                  }}
                >
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: u.is_active ? '#10B981' : '#64748B' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: u.is_active ? '#10B981' : 'text.secondary', fontSize: '0.72rem' }}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 1,
                    py: 0.25,
                    borderRadius: 1.5,
                    bgcolor: u.is_email_verified ? 'rgba(2,132,199,0.1)' : isDark ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.08)',
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 600, color: u.is_email_verified ? '#0284C7' : 'text.secondary', fontSize: '0.72rem' }}>
                    {u.is_email_verified ? 'Verified' : 'Pending'}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <IconButton
                  size="small"
                  component={Link}
                  href={`/users/${u.id}`}
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

export default function UsersPage() {
  return (
    <Suspense>
      <UsersPageInner />
    </Suspense>
  );
}
