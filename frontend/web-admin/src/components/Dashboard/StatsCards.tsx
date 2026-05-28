'use client';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { alpha, useTheme } from '@mui/material/styles';
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  trend?: number;
  suffix?: string;
}

function StatCard({ label, value, icon: Icon, color, trend, suffix }: StatCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Accent glow */}
      <Box
        sx={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 100,
          height: 100,
          borderRadius: '50%',
          backgroundColor: alpha(color, 0.08),
          pointerEvents: 'none',
        }}
      />
      <CardContent sx={{ p: '20px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.secondary,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontSize: '0.7rem',
              }}
            >
              {label}
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                mt: 0.75,
                fontSize: { xs: '1.5rem', md: '1.75rem' },
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {value.toLocaleString()}{suffix}
            </Typography>
            {trend !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                <TrendingUpRoundedIcon
                  sx={{ fontSize: 14, color: trend >= 0 ? '#10B981' : '#EF4444' }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: trend >= 0 ? '#10B981' : '#EF4444',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                >
                  {trend >= 0 ? '+' : ''}{trend}% this week
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2.5,
              backgroundColor: alpha(color, isDark ? 0.15 : 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon sx={{ fontSize: 22, color }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

interface Props {
  totalVideos: number;
  totalUsers: number;
  videosReady: number;
  videosProcessing: number;
}

export function StatsCards({ totalVideos, totalUsers, videosReady, videosProcessing }: Props) {
  return (
    <Grid container spacing={2.5}>
      <Grid item xs={12} sm={6} xl={3}>
        <StatCard
          label="Total Videos"
          value={totalVideos}
          icon={VideoLibraryRoundedIcon}
          color="#6366F1"
        />
      </Grid>
      <Grid item xs={12} sm={6} xl={3}>
        <StatCard
          label="Total Users"
          value={totalUsers}
          icon={PeopleRoundedIcon}
          color="#10B981"
        />
      </Grid>
      <Grid item xs={12} sm={6} xl={3}>
        <StatCard
          label="Videos Ready"
          value={videosReady}
          icon={CheckCircleRoundedIcon}
          color="#0284C7"
        />
      </Grid>
      <Grid item xs={12} sm={6} xl={3}>
        <StatCard
          label="Processing"
          value={videosProcessing}
          icon={AutorenewRoundedIcon}
          color="#F59E0B"
        />
      </Grid>
    </Grid>
  );
}
