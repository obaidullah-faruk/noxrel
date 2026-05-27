'use client';
import IconButton from '@mui/material/IconButton';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { useThemeMode } from './ThemeContext';

export function ThemeToggle() {
  const { mode, toggle } = useThemeMode();
  return (
    <IconButton onClick={toggle} color="inherit" title={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}>
      {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
    </IconButton>
  );
}
