'use client';
import Link from 'next/link';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import { alpha, useTheme } from '@mui/material/styles';
import PlayCircleFilledRoundedIcon from '@mui/icons-material/PlayCircleFilledRounded';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { useAuth } from '@/components/Auth/AuthContext';

export function AppHeader() {
  const { isLoggedIn, logout, authReady } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const headerBg = isDark ? alpha('#111827', 0.85) : alpha('#ffffff', 0.9);

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        backgroundColor: headerBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${isDark ? alpha('#94A3B8', 0.08) : alpha('#E2E8F0', 1)}`,
        color: theme.palette.text.primary,
        zIndex: theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ minHeight: '64px !important', px: { xs: 2, sm: 3 }, maxWidth: 1400, width: '100%', mx: 'auto' }}>
        {/* Logo */}
        <Box component={Link} href="/" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', flexShrink: 0 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
            }}
          >
            <PlayCircleFilledRoundedIcon sx={{ fontSize: 18, color: '#fff' }} />
          </Box>
          <Typography
            sx={{
              color: theme.palette.text.primary,
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: '-0.01em',
              display: { xs: 'none', sm: 'block' },
            }}
          >
            StreamVid
          </Typography>
        </Box>

        {/* Nav links */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 3 }}>
          {[
            { label: 'Home', href: '/' },
            { label: 'Browse', href: '/?category=all' },
          ].map(({ label, href }) => (
            <Button
              key={label}
              component={Link}
              href={href}
              size="small"
              sx={{
                color: theme.palette.text.secondary,
                fontWeight: 500,
                fontSize: '0.875rem',
                px: 1.5,
                '&:hover': { color: theme.palette.text.primary, bgcolor: isDark ? alpha('#94A3B8', 0.08) : alpha('#64748B', 0.06) },
              }}
            >
              {label}
            </Button>
          ))}
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Right actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ThemeToggle />

          <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: isDark ? alpha('#94A3B8', 0.12) : '#E2E8F0', height: 24, my: 'auto' }} />

          <Box suppressHydrationWarning>
            {authReady && isLoggedIn ? (
              <>
                <Tooltip title="Account">
                  <IconButton
                    component={Link}
                    href="/account"
                    size="small"
                    sx={{
                      color: theme.palette.text.secondary,
                      '&:hover': { color: theme.palette.text.primary, bgcolor: isDark ? alpha('#94A3B8', 0.1) : alpha('#64748B', 0.08) },
                    }}
                  >
                    <AccountCircleRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Sign out">
                  <IconButton
                    onClick={logout}
                    size="small"
                    sx={{
                      color: theme.palette.text.secondary,
                      '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1), color: theme.palette.error.main },
                    }}
                  >
                    <LogoutRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            ) : authReady ? (
              <Button
                component={Link}
                href="/login"
                variant="contained"
                size="small"
                sx={{
                  background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  px: 2,
                  '&:hover': { background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' },
                }}
              >
                Sign In
              </Button>
            ) : null}
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
