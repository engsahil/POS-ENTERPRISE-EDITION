import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { Spinner } from '@/components/ui';
import { AuthProvider } from './AuthContext';
import { RequireAuth } from './RequireAuth';
import { appRoutes } from './routes';

const LoginPage = lazy(() => import('@/pages/LoginPage'));

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<Spinner fullscreen label="Loading" />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Everything else requires an authenticated admin */}
            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              {appRoutes.map((route) =>
                route.index ? (
                  <Route key={route.id} index element={route.element} />
                ) : (
                  <Route
                    key={route.id}
                    path={route.path}
                    element={route.element}
                  />
                ),
              )}
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </ErrorBoundary>
  );
}
