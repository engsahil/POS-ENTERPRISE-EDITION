import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Spinner } from '@/components/ui';

/**
 * Route guard. Blocks rendering until the session has been resolved, then
 * redirects unauthenticated visitors to the login screen, remembering where
 * they were headed.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, isAuthenticated } = useAuth();
  const location = useLocation();

  if (status === 'initialising') {
    return <Spinner fullscreen label="Checking session" />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  return <>{children}</>;
}
