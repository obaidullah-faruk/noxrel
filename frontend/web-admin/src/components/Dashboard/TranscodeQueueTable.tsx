'use client';
import Link from 'next/link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { alpha, useTheme } from '@mui/material/styles';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import VideoFileRoundedIcon from '@mui/icons-material/VideoFileRounded';
import type { Video, VideoStatus } from '@/types/video';

function StatusChip({ status }: { status: string }) {
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

export function TranscodeQueueTable({ rows }: { rows: Video[] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Card>
      <CardContent sx={{ p: '20px !important', pb: '0 !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
              Recent Videos
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              Latest {rows.length} uploads
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              bgcolor: isDark ? alpha('#6366F1', 0.12) : alpha('#6366F1', 0.08),
              px: 1.25,
              py: 0.5,
              borderRadius: 2,
            }}
          >
            <VideoFileRoundedIcon sx={{ fontSize: 14, color: '#6366F1' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#6366F1' }}>
              {rows.length} total
            </Typography>
          </Box>
        </Box>
      </CardContent>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Views</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right" sx={{ width: 48 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <VideoFileRoundedIcon sx={{ fontSize: 40, color: theme.palette.text.secondary, opacity: 0.3, mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No videos yet
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
            {rows.map(row => (
              <TableRow key={row.id}>
                <TableCell
                  sx={{
                    maxWidth: 280,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                  }}
                >
                  {row.title || '(untitled)'}
                </TableCell>
                <TableCell>
                  <StatusChip status={row.status} />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {row.view_count.toLocaleString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    component={Link}
                    href={`/videos/${row.id}`}
                    sx={{
                      color: theme.palette.text.secondary,
                      '&:hover': {
                        color: theme.palette.primary.main,
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
        </Table>
      </TableContainer>
    </Card>
  );
}
