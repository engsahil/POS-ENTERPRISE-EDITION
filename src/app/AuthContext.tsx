import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authService } from '@/services/authService';
import type { AuthStatus, AuthUser, LoginResult } from '@/types/auth';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** Set when bootstrap/restore fails (e.g. storage unavailable). */
  error: string | null;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  /** Re-read the user after a credential change. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('initialising');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore any existing session on mount so a refresh keeps the user in.
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const restored = await authService.restore();
        if (!active) return;
        setUser(restored);
        setStatus(restored ? 'authenticated' : 'unauthenticated');
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : 'Failed to start authentication.',
        );
        setStatus('error');
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<LoginResult> => {
      const result = await authService.login(username, password);
      if (result.ok) {
        const current = await authService.currentUser();
        setUser(current);
        setStatus(current ? 'authenticated' : 'unauthenticated');
      }
      return result;
    },
    [],
  );

  const logout = useCallback(() => {
    // Clear local state immediately; token invalidation is best effort and
    // must never delay signing out.
    void authService.logout();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const refresh = useCallback(async () => {
    const current = await authService.currentUser();
    setUser(current);
    setStatus(current ? 'authenticated' : 'unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAuthenticated: status === 'authenticated' && user !== null,
      error,
      login,
      logout,
      refresh,
    }),
    [status, user, error, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
