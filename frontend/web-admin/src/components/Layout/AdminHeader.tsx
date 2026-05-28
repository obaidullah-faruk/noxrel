'use client';
import { usePathname } from 'next/navigation';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import { alpha, useTheme } from '@mui/material/styles';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { useAuth } from '@/components/Auth/AuthContext';
import { DRAWER_WIDTH } from './AdminSidebar';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/videos':    'Video Library',
  '/users':     'User Management',
};

function useBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
    return { title: PAGE_TITLES['/dashboard'] ?? 'Dashboard', sub: null };
  }

  const base = `/${segments[0]}`;
  const title = PAGE_TITLES[base] ?? segments[0].charAt(0).toUpperCase() + segments[0].slice(1);

  if (segments.length > 1) {
    const id = segments[1];
    const sub = id.length > 8 ? `${id.substring(0, 8)}…` : id;
    return { title, sub };
  }

  return { title, sub: null };
}

export function AdminHeader() {
  const { logout } = useAuth();
  const { title, sub } = useBreadcrumb();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const headerBg = isDark
    ? alpha('#111827', 0.8)
    : alpha('#ffffff', 0.85);

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        ml: `${DRAWER_WIDTH}px`,
        width: `calc(100% - ${DRAWER_WIDTH}px)`,
        backgroundColor: headerBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${isDark ? alpha('#94A3B8', 0.08) : alpha('#E2E8F0', 1)}`,
        color: theme.palette.text.primary,
        zIndex: theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ minHeight: '64px !important', px: { xs: 2, sm: 3 } }}>
        {/* Page Title */}
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: '1rem',
                color: theme.palette.text.primary,
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </Typography>
            {sub && (
              <>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  /
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.875rem',
                    color: theme.palette.text.secondary,
                    fontFamily: 'monospace',
                    bgcolor: isDark ? alpha('#94A3B8', 0.1) : alpha('#64748B', 0.08),
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                  }}
                >
                  {sub}
                </Typography>
              </>
            )}
          </Box>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Notifications">
            <IconButton
              size="small"
              sx={{
                color: theme.palette.text.secondary,
                '&:hover': {
                  backgroundColor: isDark ? alpha('#94A3B8', 0.1) : alpha('#64748B', 0.08),
                  color: theme.palette.text.primary,
                },
              }}
            >
              <NotificationsNoneRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <ThemeToggle />

          <Divider
            orientation="vertical"
            flexItem
            sx={{ mx: 1, borderColor: isDark ? alpha('#94A3B8', 0.12) : '#E2E8F0', height: 24, my: 'auto' }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                fontSize: '0.8rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                cursor: 'pointer',
              }}
            >
              A
            </Avatar>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2, fontSize: '0.8rem' }}>
                Admin
              </Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.7rem' }}>
                Super Admin
              </Typography>
            </Box>
          </Box>

          <Tooltip title="Sign out">
            <IconButton
              onClick={logout}
              size="small"
              sx={{
                ml: 0.5,
                color: theme.palette.text.secondary,
                '&:hover': {
                  backgroundColor: alpha(theme.palette.error.main, 0.1),
                  color: theme.palette.error.main,
                },
              }}
            >
              <LogoutRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
