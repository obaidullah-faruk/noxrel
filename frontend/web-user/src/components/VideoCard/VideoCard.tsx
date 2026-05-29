'use client';
import { useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import type { Video } from '@/types/video';

function formatDuration(secs: number | null): string {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K views`;
  return `${n} views`;
}

export function VideoCard({ video }: { video: Video }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [thumbError, setThumbError] = useState(false);

  return (
    <Card
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: isDark
            ? `0 8px 24px rgba(0,0,0,0.5)`
            : `0 8px 24px rgba(0,0,0,0.12)`,
        },
      }}
    >
      <CardActionArea component={Link} href={`/videos/${video.id}`}>
        {/* Thumbnail */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            paddingTop: '56.25%',
            bgcolor: isDark ? '#161D2E' : '#E2E8F0',
            overflow: 'hidden',
          }}
        >
          {video.thumbnail_url && !thumbError ? (
            <Box
              component="img"
              src={video.thumbnail_url}
              alt={video.title}
              onError={() => setThumbError(true)}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isDark
                  ? 'linear-gradient(135deg, #1E2535 0%, #161D2E 100%)'
                  : 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)',
              }}
            >
              <PlayArrowRoundedIcon
                sx={{ fontSize: 40, color: isDark ? alpha('#94A3B8', 0.3) : alpha('#64748B', 0.3) }}
              />
            </Box>
          )}
          {video.duration_seconds && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 6,
                right: 6,
                px: 0.75,
                py: 0.25,
                borderRadius: 1,
                bgcolor: 'rgba(0,0,0,0.75)',
              }}
            >
              <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.72rem' }}>
                {formatDuration(video.duration_seconds)}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Info */}
        <Box sx={{ p: 1.5 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              lineHeight: 1.4,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              mb: 0.5,
            }}
          >
            {video.title || '(untitled)'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {video.category && (
              <Typography variant="caption" color="text.secondary">
                {video.category}
              </Typography>
            )}
            {video.view_count > 0 && (
              <Typography variant="caption" color="text.secondary">
                · {formatViews(video.view_count)}
              </Typography>
            )}
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
}
