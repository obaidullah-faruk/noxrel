'use client';
import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { darkTheme } from '@/lib/theme';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
