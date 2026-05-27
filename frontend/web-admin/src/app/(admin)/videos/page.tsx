'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
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
import IconButton from '@mui/material/IconButton';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { fetchVideos } from '@/lib/api';
import { getToken } from '@/lib/auth-client';
import type { Video, VideoStatus } from '@/types/video';

function statusColor(status: VideoStatus): 'warning' | 'info' | 'success' | 'error' | 'default' {
  switch (status) {
    case 'processing': return 'warning';
    case 'uploading':  return 'info';
    case 'ready':      return 'success';
    case 'failed':     return 'error';
    default:           return 'default';
  }
}

const PAGE_SIZE = 20;

export default function VideosPage() {
  const [videos, setVideos]     = useState<Video[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback((p: number, q: string) => {
    setLoading(true);
    getToken().then(token =>
      fetchVideos(token, { page: p + 1, search: q || undefined })
        .then(data => {
          setVideos(data.results);
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
        Videos
      </Typography>

      <Box sx={{ mb: 2 }}>
        <TextField
          label="Search videos"
          value={search}
          onChange={handleSearch}
          size="small"
          sx={{ width: 300 }}
          placeholder="title, category…"
        />
      </Box>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>Backend unavailable — {error}</Alert>}

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Views</TableCell>
                <TableCell>Published</TableCell>
                <TableCell>Created</TableCell>
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
              {!loading && videos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">No videos found</TableCell>
                </TableRow>
              )}
              {!loading && videos.map(v => (
                <TableRow key={v.id} hover>
                  <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.title || '(untitled)'}
                  </TableCell>
                  <TableCell>
                    <Chip label={v.status} size="small" color={statusColor(v.status)} />
                  </TableCell>
                  <TableCell>{v.category || '—'}</TableCell>
                  <TableCell align="right">{v.view_count}</TableCell>
                  <TableCell>{v.is_published ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{new Date(v.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <IconButton size="small" component={Link} href={`/videos/${v.id}`} title="View detail">
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
