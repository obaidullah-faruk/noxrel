'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { fetchUsers } from '@/lib/api';
import { getToken } from '@/lib/auth-client';
import type { User } from '@/types/user';

const PAGE_SIZE = 20;

export default function UsersPage() {
  const [users, setUsers]     = useState<User[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback((p: number, q: string) => {
    setLoading(true);
    getToken().then(token =>
      fetchUsers(token, { page: p + 1, search: q || undefined })
        .then(data => {
          setUsers(data.results);
          setTotal(data.count);
          setError(null);
        })
        .catch(err => setError(String(err)))
        .finally(() => setLoading(false))
    );
  }, []);

  useEffect(() => { load(page, search); }, [load, page, search]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(0);
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Users
      </Typography>

      <Box sx={{ mb: 2 }}>
        <TextField
          label="Search users"
          value={search}
          onChange={handleSearch}
          size="small"
          sx={{ width: 300 }}
          placeholder="username, email…"
        />
      </Box>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>Backend unavailable — {error}</Alert>}

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Username</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Display Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Verified</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              )}
              {!loading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">No users found</TableCell>
                </TableRow>
              )}
              {!loading && users.map(u => (
                <TableRow key={u.id} hover>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.display_name || '—'}</TableCell>
                  <TableCell>
                    <Chip
                      label={u.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={u.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={u.is_email_verified ? 'Yes' : 'No'}
                      size="small"
                      color={u.is_email_verified ? 'info' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <IconButton size="small" component={Link} href={`/users/${u.id}`} title="View user">
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[PAGE_SIZE]}
          onPageChange={(_, p) => setPage(p)}
        />
      </Paper>
    </Box>
  );
}
