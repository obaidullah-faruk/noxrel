'use client';
import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import { lightTheme, darkTheme } from '@/lib/theme';
import { ThemeContextProvider, useThemeMode } from '@/components/ThemeToggle/ThemeContext';
import { AdminSidebar, DRAWER_WIDTH } from '@/components/Layout/AdminSidebar';
import { AdminHeader } from '@/components/Layout/AdminHeader';
import { AuthProvider } from '@/components/Auth/AuthContext';

function AppShell({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode();
  const theme = mode === 'light' ? lightTheme : darkTheme;
  const isDark = mode === 'dark';

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <AdminSidebar />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          <AdminHeader />
          <Toolbar sx={{ minHeight: '64px !important' }} />
          <Box
            sx={{
              p: { xs: 2, sm: 3 },
              flexGrow: 1,
              bgcolor: isDark ? '#0B0F1A' : '#F1F5F9',
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContextProvider>
      <AuthProvider>
        <AppShell>{children}</AppShell>
      </AuthProvider>
    </ThemeContextProvider>
  );
}
