'use client';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

export function AdminFooter() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      component="footer"
      sx={{
        px: { xs: 2, sm: 3 },
        py: 2,
        borderTop: `1px solid ${isDark ? alpha('#94A3B8', 0.08) : '#E2E8F0'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.75rem' }}>
        © {new Date().getFullYear()} noxrel. All rights reserved.
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.75rem' }}>
        Admin Panel · v1.0.0
      </Typography>
    </Box>
  );
}
