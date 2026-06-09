'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { alpha, useTheme } from '@mui/material/styles';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import PlayCircleFilledRoundedIcon from '@mui/icons-material/PlayCircleFilledRounded';

export const DRAWER_WIDTH = 240;
export const DRAWER_COLLAPSED_WIDTH = 68;

const NAV = [
  {
    section: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: DashboardRoundedIcon },
      { label: 'Videos',    href: '/videos',    icon: VideoLibraryRoundedIcon },
      { label: 'Users',     href: '/users',     icon: PeopleRoundedIcon },
      { label: 'Subscriptions', href: '/subscriptions', icon: CreditCardRoundedIcon },
    ],
  },
];

interface Props {
  collapsed?: boolean;
}

export function AdminSidebar({ collapsed = false }: Props) {
  const pathname = usePathname();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const drawerWidth = collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH;

  const sidebarBg = isDark
    ? '#0D1117'
    : '#1E1B4B';

  const activeBg = isDark
    ? alpha(theme.palette.primary.main, 0.15)
    : alpha('#ffffff', 0.12);

  const activeColor = isDark ? theme.palette.primary.light : '#C7D2FE';
  const inactiveColor = isDark ? '#64748B' : alpha('#ffffff', 0.55);
  const inactiveHoverBg = isDark ? alpha(theme.palette.primary.main, 0.07) : alpha('#ffffff', 0.07);
  const inactiveHoverColor = isDark ? '#94A3B8' : alpha('#ffffff', 0.85);
  const sectionColor = isDark ? '#334155' : alpha('#ffffff', 0.3);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        transition: 'width 0.25s ease',
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: sidebarBg,
          borderRight: 'none',
          overflowX: 'hidden',
          transition: 'width 0.25s ease',
        },
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: collapsed ? 1.5 : 2.5,
          py: 2.5,
          minHeight: 64,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
          }}
        >
          <PlayCircleFilledRoundedIcon sx={{ fontSize: 20, color: '#fff' }} />
        </Box>
        {!collapsed && (
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.95rem',
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
              }}
            >
              noxrel
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: alpha('#ffffff', 0.4), fontSize: '0.68rem', letterSpacing: '0.05em' }}
            >
              PLATFORM
            </Typography>
          </Box>
        )}
      </Box>

      {/* Nav Sections */}
      <Box sx={{ px: collapsed ? 1 : 1.5, flex: 1, mt: 0.5 }}>
        {NAV.map(({ section, items }) => (
          <Box key={section} sx={{ mb: 2 }}>
            {!collapsed && (
              <Typography
                variant="caption"
                sx={{
                  color: sectionColor,
                  fontWeight: 600,
                  fontSize: '0.68rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  px: 1.5,
                  mb: 0.75,
                  display: 'block',
                }}
              >
                {section}
              </Typography>
            )}
            {items.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              const item = (
                <Box
                  component={Link}
                  href={href}
                  key={href}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: collapsed ? 1.5 : 1.5,
                    py: 1,
                    mb: 0.25,
                    borderRadius: 2,
                    textDecoration: 'none',
                    color: active ? activeColor : inactiveColor,
                    backgroundColor: active ? activeBg : 'transparent',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      backgroundColor: active ? activeBg : inactiveHoverBg,
                      color: active ? activeColor : inactiveHoverColor,
                    },
                  }}
                >
                  {active && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        top: '20%',
                        height: '60%',
                        width: 3,
                        borderRadius: '0 2px 2px 0',
                        backgroundColor: theme.palette.primary.main,
                      }}
                    />
                  )}
                  <Icon
                    sx={{
                      fontSize: 20,
                      flexShrink: 0,
                      color: active ? (isDark ? theme.palette.primary.light : '#A5B4FC') : 'inherit',
                    }}
                  />
                  {!collapsed && (
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: active ? 600 : 500,
                        fontSize: '0.875rem',
                        color: 'inherit',
                      }}
                    >
                      {label}
                    </Typography>
                  )}
                </Box>
              );

              return collapsed ? (
                <Tooltip key={href} title={label} placement="right" arrow>
                  {item}
                </Tooltip>
              ) : item;
            })}
          </Box>
        ))}
      </Box>

    </Drawer>
  );
}
