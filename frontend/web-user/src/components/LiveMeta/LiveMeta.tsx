'use client';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import type { LiveSession } from '@/types/live';

export function LiveMeta({ session }: { session: LiveSession }) {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>{session.title}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
        <Chip
          icon={<VisibilityRoundedIcon />}
          label={`${session.viewerCount.toLocaleString()} watching`}
          size="small"
        />
      </Box>
      {session.description && (
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
          {session.description}
        </Typography>
      )}
    </Box>
  );
}
