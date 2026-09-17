import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/AppShell';
import { AuthPage } from '@/components/AuthPage';
import { SeedGate } from '@/components/SeedGate';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { canOpenRoute } from '@/domain/policy';
import { useAuth } from '@/hooks/AuthContext';
import { DataProvider, useData } from '@/hooks/DataContext';
import { SessionProvider, useSession } from '@/hooks/SessionContext';
import { Administration } from '@/pages/Administration';
import { AuditTrail } from '@/pages/AuditTrail';
import { AuthCallback } from '@/pages/AuthCallback';
import { CommandCenter } from '@/pages/CommandCenter';
import { CustomerDetail } from '@/pages/CustomerDetail';
import { CustomerHealth } from '@/pages/CustomerHealth';
import { ExceptionDetail } from '@/pages/ExceptionDetail';
import { ExceptionWorkbench } from '@/pages/ExceptionWorkbench';
import { VendorInsights } from '@/pages/VendorInsights';

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      {children}
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <FullScreen>
        <LoadingState label="Checking your session…" />
      </FullScreen>
    );
  }
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function RequireRoute({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  const { activeRole } = useSession();
  if (!activeRole) return null;
  if (!canOpenRoute(activeRole, path)) {
    return (
      <EmptyState
        icon={<Lock className="h-8 w-8" />}
        title="This page is not available to your role"
        description="Ask an Operations Manager if you need access to this area."
      />
    );
  }
  return <>{children}</>;
}

/** Loads the identity and working set once the user is signed in. */
function Workspace() {
  const { loading: sessionLoading, error: sessionError, operator, reload } =
    useSession();
  const { loading: dataLoading, isEmpty, customers, error: dataError, refresh } =
    useData();

  if (sessionError) {
    return (
      <FullScreen>
        <ErrorState message={sessionError} onRetry={() => void reload()} />
      </FullScreen>
    );
  }
  if (dataError && customers.length === 0) {
    return (
      <FullScreen>
        <ErrorState message={dataError} onRetry={() => void refresh()} />
      </FullScreen>
    );
  }
  if ((sessionLoading && !operator) || (dataLoading && customers.length === 0)) {
    return (
      <FullScreen>
        <LoadingState label="Opening the control center…" />
      </FullScreen>
    );
  }
  if (isEmpty) return <SeedGate />;
  if (!operator) {
    return (
      <FullScreen>
        <LoadingState label="Resolving your operator profile…" />
      </FullScreen>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<CommandCenter />} />
        <Route
          path="/exceptions"
          element={
            <RequireRoute path="/exceptions">
              <ExceptionWorkbench />
            </RequireRoute>
          }
        />
        <Route
          path="/exceptions/:id"
          element={
            <RequireRoute path="/exceptions">
              <ExceptionDetail />
            </RequireRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <RequireRoute path="/customers">
              <CustomerHealth />
            </RequireRoute>
          }
        />
        <Route
          path="/customers/:id"
          element={
            <RequireRoute path="/customers">
              <CustomerDetail />
            </RequireRoute>
          }
        />
        <Route
          path="/vendors"
          element={
            <RequireRoute path="/vendors">
              <VendorInsights />
            </RequireRoute>
          }
        />
        <Route
          path="/audit"
          element={
            <RequireRoute path="/audit">
              <AuditTrail />
            </RequireRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireRoute path="/admin">
              <Administration />
            </RequireRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <FullScreen>
        <LoadingState label="Checking your session…" />
      </FullScreen>
    );
  }
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/auth"
          element={
            <PublicOnly>
              <AuthPage />
            </PublicOnly>
          }
        />
        <Route
          path="*"
          element={
            <RequireAuth>
              <SessionProvider>
                <DataProvider>
                  <Workspace />
                </DataProvider>
              </SessionProvider>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
