'use client';
import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import { lightTheme, darkTheme } from '@/lib/theme';
import { ThemeContextProvider, useThemeMode } from '@/components/ThemeToggle/ThemeContext';
import { AppHeader } from '@/components/Layout/AppHeader';
import { AuthProvider } from '@/components/Auth/AuthContext';

function AppShell({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode();
  const theme = mode === 'light' ? lightTheme : darkTheme;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppHeader />
      <Toolbar sx={{ minHeight: '64px !important' }} />
      <Box
        component="main"
        sx={{
          minHeight: 'calc(100vh - 64px)',
          bgcolor: 'background.default',
        }}
      >
        {children}
      </Box>
    </ThemeProvider>
  );
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContextProvider>
      <AuthProvider>
        <AppShell>{children}</AppShell>
      </AuthProvider>
    </ThemeContextProvider>
  );
}
