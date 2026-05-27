'use client';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import PeopleIcon from '@mui/icons-material/People';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import Box from '@mui/material/Box';

interface Props {
  totalVideos: number;
  totalUsers: number;
  videosReady: number;
  videosProcessing: number;
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ color, fontSize: 40 }}>{icon}</Box>
          <Box>
            <Typography variant="h4" fontWeight={700}>
              {value.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export function StatsCards({ totalVideos, totalUsers, videosReady, videosProcessing }: Props) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard label="Total Videos" value={totalVideos} icon={<VideoLibraryIcon fontSize="inherit" />} color="#1976d2" />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard label="Total Users" value={totalUsers} icon={<PeopleIcon fontSize="inherit" />} color="#388e3c" />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard label="Videos Ready" value={videosReady} icon={<CheckCircleIcon fontSize="inherit" />} color="#0288d1" />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard label="Processing" value={videosProcessing} icon={<HourglassEmptyIcon fontSize="inherit" />} color="#f57c00" />
      </Grid>
    </Grid>
  );
}
