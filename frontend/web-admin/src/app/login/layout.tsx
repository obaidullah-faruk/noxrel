'use client';
import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { lightTheme } from '@/lib/theme';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
