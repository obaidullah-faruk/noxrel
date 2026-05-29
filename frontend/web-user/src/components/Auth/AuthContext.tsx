'use client';
import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextValue {
  userId: string | null;
  token: string | null;
  isLoggedIn: boolean;
  authReady: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({ userId: null, token: null, isLoggedIn: false, authReady: false, logout: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userId, setUserId]     = useState<string | null>(null);
  const [token, setToken]       = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    setAuthReady(false);
    fetch('/api/auth/token', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((data: { token?: string; userId?: string } | null) => {
        setUserId(data?.userId ?? null);
        setToken(data?.token ?? null);
      })
      .catch(() => {
        setUserId(null);
        setToken(null);
      })
      .finally(() => setAuthReady(true));
  }, [pathname]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }, [router]);

  return (
    <AuthContext.Provider value={{ userId, token, isLoggedIn: !!userId, authReady, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
