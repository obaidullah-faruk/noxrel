'use client';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { alpha, useTheme } from '@mui/material/styles';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import { useThemeMode } from './ThemeContext';

export function ThemeToggle() {
  const { mode, toggle } = useThemeMode();
  const theme = useTheme();
  const isDark = mode === 'dark';

  return (
    <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton
        onClick={toggle}
        size="small"
        sx={{
          color: theme.palette.text.secondary,
          '&:hover': {
            backgroundColor: isDark ? alpha('#94A3B8', 0.1) : alpha('#64748B', 0.08),
            color: theme.palette.text.primary,
          },
        }}
      >
        {isDark
          ? <LightModeRoundedIcon fontSize="small" />
          : <DarkModeRoundedIcon fontSize="small" />
        }
      </IconButton>
    </Tooltip>
  );
}
