'use client';
import { createTheme, alpha } from '@mui/material/styles';

const baseTypography = {
  fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
  h1: { fontWeight: 700, letterSpacing: '-0.02em' },
  h2: { fontWeight: 700, letterSpacing: '-0.01em' },
  h3: { fontWeight: 600, letterSpacing: '-0.01em' },
  h4: { fontWeight: 600 },
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
  subtitle1: { fontWeight: 500 },
  subtitle2: { fontWeight: 500 },
  button: { fontWeight: 600, textTransform: 'none' as const, letterSpacing: '0.01em' },
};

const baseShape = { borderRadius: 10 };

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#4F46E5',
      light: '#818CF8',
      dark: '#3730A3',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#7C3AED',
      light: '#A78BFA',
      dark: '#5B21B6',
    },
    success: { main: '#059669', light: '#34D399', dark: '#065F46' },
    warning: { main: '#D97706', light: '#FCD34D', dark: '#92400E' },
    error:   { main: '#DC2626', light: '#F87171', dark: '#991B1B' },
    info:    { main: '#0284C7', light: '#38BDF8', dark: '#075985' },
    background: {
      default: '#F1F5F9',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0F172A',
      secondary: '#64748B',
    },
    divider: '#E2E8F0',
  },
  typography: baseTypography,
  shape: baseShape,
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
          border: '1px solid #E2E8F0',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, padding: '7px 16px' },
        contained: {
          boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.1)',
          '&:hover': { boxShadow: '0 4px 8px 0 rgb(0 0 0 / 0.15)' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 500, fontSize: '0.75rem' },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#64748B',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: '#F8FAFC' },
          '&:last-child .MuiTableCell-body': { borderBottom: 'none' },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 6 },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '& fieldset': { borderColor: '#E2E8F0' },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16, backgroundImage: 'none' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 6,
          fontSize: '0.75rem',
          fontWeight: 500,
          backgroundColor: '#0F172A',
        },
      },
    },
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366F1',
      light: '#818CF8',
      dark: '#4338CA',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#8B5CF6',
      light: '#A78BFA',
      dark: '#6D28D9',
    },
    success: { main: '#10B981', light: '#34D399', dark: '#059669' },
    warning: { main: '#F59E0B', light: '#FCD34D', dark: '#D97706' },
    error:   { main: '#EF4444', light: '#F87171', dark: '#DC2626' },
    info:    { main: '#38BDF8', light: '#7DD3FC', dark: '#0284C7' },
    background: {
      default: '#0B0F1A',
      paper: '#111827',
    },
    text: {
      primary: '#F1F5F9',
      secondary: '#94A3B8',
    },
    divider: alpha('#94A3B8', 0.12),
  },
  typography: baseTypography,
  shape: baseShape,
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1E2535',
          boxShadow: 'none',
          border: `1px solid ${alpha('#94A3B8', 0.1)}`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, padding: '7px 16px' },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: `0 4px 20px 0 ${alpha('#6366F1', 0.35)}` },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 500, fontSize: '0.75rem' },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#64748B',
            backgroundColor: '#161D2E',
            borderBottom: `1px solid ${alpha('#94A3B8', 0.1)}`,
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: alpha('#6366F1', 0.04) },
          '&:last-child .MuiTableCell-body': { borderBottom: 'none' },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: alpha('#94A3B8', 0.08) },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 6 },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: alpha('#94A3B8', 0.05),
            '& fieldset': { borderColor: alpha('#94A3B8', 0.15) },
            '&:hover fieldset': { borderColor: alpha('#94A3B8', 0.3) },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          backgroundImage: 'none',
          backgroundColor: '#1E2535',
          border: `1px solid ${alpha('#94A3B8', 0.1)}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 6,
          fontSize: '0.75rem',
          fontWeight: 500,
          backgroundColor: '#1E2535',
          border: `1px solid ${alpha('#94A3B8', 0.15)}`,
        },
      },
    },
  },
});
