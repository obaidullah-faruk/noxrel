'use client';
import { createTheme } from '@mui/material/styles';

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: '#1565c0' },
    secondary: { main: '#7b1fa2' },
    background: { default: '#f5f5f5', paper: '#ffffff' },
  },
  typography: { fontFamily: '"Inter", "Roboto", sans-serif' },
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary:   { main: '#90caf9' },
    secondary: { main: '#ce93d8' },
    background: { default: '#121212', paper: '#1e1e1e' },
  },
  typography: { fontFamily: '"Inter", "Roboto", sans-serif' },
});
