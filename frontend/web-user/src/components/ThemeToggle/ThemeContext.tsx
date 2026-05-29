'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

type Mode = 'light' | 'dark';

interface ThemeContextValue {
  mode: Mode;
  toggle: () => void;
}

const ThemeCtx = createContext<ThemeContextValue>({ mode: 'dark', toggle: () => {} });

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('user_theme') as Mode | null;
    if (saved === 'light' || saved === 'dark') setMode(saved);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = mode === 'light' ? 'dark' : 'light';
    setMode(next);
    localStorage.setItem('user_theme', next);
  };

  return (
    <ThemeCtx.Provider value={{ mode: mounted ? mode : 'dark', toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeCtx);
}
