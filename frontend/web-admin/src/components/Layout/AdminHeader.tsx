'use client';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LogoutIcon from '@mui/icons-material/Logout';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { useAuth } from '@/components/Auth/AuthContext';

const DRAWER_WIDTH = 220;

export function AdminHeader({ title }: { title?: string }) {
  const { logout } = useAuth();

  return (
    <AppBar
      position="fixed"
      sx={{ zIndex: theme => theme.zIndex.drawer + 1, ml: `${DRAWER_WIDTH}px`, width: `calc(100% - ${DRAWER_WIDTH}px)` }}
      elevation={1}
    >
      <Toolbar>
        <Typography variant="h6" fontWeight={600} sx={{ flexGrow: 1 }}>
          {title ?? 'Video Streaming Admin'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ThemeToggle />
          <Tooltip title="Sign out">
            <IconButton color="inherit" onClick={logout} size="small">
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
