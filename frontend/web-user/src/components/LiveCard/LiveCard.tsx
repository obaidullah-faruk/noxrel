'use client';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded';
import type { LiveSession } from '@/types/live';

export function LiveCard({ session }: { session: LiveSession }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Card
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
        },
      }}
    >
      <CardActionArea component={Link} href={`/live/${session.id}`}>
        <Box
          sx={{
            position: 'relative',
            aspectRatio: '16 / 9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.error.main, isDark ? 0.18 : 0.1),
          }}
        >
          <SensorsRoundedIcon sx={{ fontSize: 48, color: 'error.main' }} />
          <Chip label="LIVE" color="error" size="small"
                sx={{ position: 'absolute', top: 8, left: 8, fontWeight: 700 }} />
          <Chip label={`${session.viewerCount.toLocaleString()} watching`} size="small"
                sx={{ position: 'absolute', bottom: 8, right: 8 }} />
        </Box>
        <Box sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
            {session.title}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
}
