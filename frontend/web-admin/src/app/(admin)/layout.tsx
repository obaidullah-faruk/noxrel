'use client';
import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import { lightTheme, darkTheme } from '@/lib/theme';
import { ThemeContextProvider, useThemeMode } from '@/components/ThemeToggle/ThemeContext';
import { AdminSidebar } from '@/components/Layout/AdminSidebar';
import { AdminHeader } from '@/components/Layout/AdminHeader';
import { AuthProvider } from '@/components/Auth/AuthContext';

function AppShell({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode();
  return (
    <ThemeProvider theme={mode === 'light' ? lightTheme : darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <AdminSidebar />
        <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <AdminHeader />
          <Toolbar />
          <Box sx={{ p: 3, flexGrow: 1 }}>{children}</Box>
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
