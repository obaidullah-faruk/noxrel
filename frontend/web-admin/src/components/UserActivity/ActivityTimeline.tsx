'use client';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import type { Video } from '@/types/video';

interface Props {
  watchedVideos: Video[];
}

export function ActivityTimeline({ watchedVideos }: Props) {
  if (watchedVideos.length === 0) {
    return <Typography color="text.secondary">No activity recorded yet.</Typography>;
  }

  return (
    <Box>
      {watchedVideos.map((video, idx) => (
        <Box key={video.id}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, py: 1.5 }}>
            <Box
              sx={{
                bgcolor: 'primary.main',
                borderRadius: '50%',
                p: 0.6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mt: 0.3,
                flexShrink: 0,
              }}
            >
              <OndemandVideoIcon sx={{ fontSize: 16, color: 'primary.contrastText' }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                {video.title || '(untitled)'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(video.updated_at).toLocaleString()} · {video.view_count} views
              </Typography>
            </Box>
          </Box>
          {idx < watchedVideos.length - 1 && <Divider />}
        </Box>
      ))}
    </Box>
  );
}
