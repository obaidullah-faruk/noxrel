'use client';
import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { loadSession } from '@/lib/auth-client';

interface AuthContextValue {
  userId: string | null;
  token: string | null;
  isLoggedIn: boolean;
  authReady: boolean;
  refreshAuth: () => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  userId: null,
  token: null,
  isLoggedIn: false,
  authReady: false,
  refreshAuth: async () => null,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const refreshAuth = useCallback(async (): Promise<string | null> => {
    const session = await loadSession();
    setUserId(session.userId);
    setToken(session.token);
    return session.token;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAuthReady(false);
    loadSession()
      .then(session => {
        if (cancelled) return;
        setUserId(session.userId);
        setToken(session.token);
      })
      .catch(() => {
        if (!cancelled) {
          setUserId(null);
          setToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    return () => { cancelled = true; };
  }, [pathname]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }, [router]);

  const isLoggedIn = Boolean(userId && token);

  return (
    <AuthContext.Provider value={{ userId, token, isLoggedIn, authReady, refreshAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
