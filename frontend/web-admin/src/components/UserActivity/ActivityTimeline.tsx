'use client';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import OndemandVideoRoundedIcon from '@mui/icons-material/OndemandVideoRounded';
import type { Video } from '@/types/video';

interface Props {
  watchedVideos: Video[];
}

export function ActivityTimeline({ watchedVideos }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (watchedVideos.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 4,
          bgcolor: isDark ? alpha('#94A3B8', 0.04) : '#FAFAFA',
          borderRadius: 2,
          border: `1px dashed ${isDark ? alpha('#94A3B8', 0.15) : '#E2E8F0'}`,
        }}
      >
        <OndemandVideoRoundedIcon sx={{ fontSize: 36, color: 'text.secondary', opacity: 0.3, mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No activity recorded yet.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Vertical line */}
      <Box
        sx={{
          position: 'absolute',
          left: 15,
          top: 16,
          bottom: 16,
          width: 1,
          bgcolor: isDark ? alpha('#94A3B8', 0.1) : '#E2E8F0',
        }}
      />

      {watchedVideos.map((video, idx) => (
        <Box
          key={video.id}
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 2,
            py: 1.5,
            pl: 0.5,
            position: 'relative',
          }}
        >
          {/* Icon dot */}
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              bgcolor: isDark ? '#1E2535' : '#fff',
              border: `2px solid ${isDark ? alpha('#6366F1', 0.3) : alpha('#6366F1', 0.2)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              zIndex: 1,
            }}
          >
            <OndemandVideoRoundedIcon sx={{ fontSize: 15, color: '#6366F1' }} />
          </Box>

          {/* Content */}
          <Box
            sx={{
              flex: 1,
              bgcolor: isDark ? alpha('#94A3B8', 0.04) : '#FAFAFA',
              border: `1px solid ${isDark ? alpha('#94A3B8', 0.08) : '#F1F5F9'}`,
              borderRadius: 2,
              px: 2,
              py: 1.25,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {video.title || '(untitled)'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">
                {new Date(video.updated_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Typography>
              <Typography variant="caption" sx={{ color: '#6366F1', fontWeight: 600 }}>
                {video.view_count.toLocaleString()} views
              </Typography>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
