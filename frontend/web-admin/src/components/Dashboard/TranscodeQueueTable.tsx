'use client';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import type { Video } from '@/types/video';

function statusColor(status: string): 'warning' | 'info' | 'success' | 'error' | 'default' {
  switch (status) {
    case 'processing': return 'warning';
    case 'uploading':  return 'info';
    case 'ready':      return 'success';
    case 'failed':     return 'error';
    default:           return 'default';
  }
}

export function TranscodeQueueTable({ rows }: { rows: Video[] }) {
  return (
    <Paper>
      <Typography variant="h6" sx={{ p: 2, pb: 1 }}>
        Recent Videos
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Views</TableCell>
              <TableCell>Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">No videos yet</TableCell>
              </TableRow>
            )}
            {rows.map(row => (
              <TableRow key={row.id} hover>
                <TableCell>{row.title || '(untitled)'}</TableCell>
                <TableCell>
                  <Chip label={row.status} size="small" color={statusColor(row.status)} />
                </TableCell>
                <TableCell>{row.view_count}</TableCell>
                <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
