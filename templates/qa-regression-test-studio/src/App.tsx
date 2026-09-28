import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/AppShell';
import { AuthPage } from '@/components/AuthPage';
import { useAuth } from '@/hooks/AuthContext';
import { AzureAiProvider } from '@/hooks/AzureAiContext';
import { ApplicationsPage } from '@/pages/ApplicationsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ImportTestPage } from '@/pages/ImportTestPage';
import { RunDetailPage } from '@/pages/RunDetailPage';
import { RunsPage } from '@/pages/RunsPage';
import { SuitesPage } from '@/pages/SuitesPage';
import { TestEditorPage } from '@/pages/TestEditorPage';
import { TestsPage } from '@/pages/TestsPage';

function AuthGuard({
  children,
  requireAuth,
}: {
  children: React.ReactNode;
  requireAuth: boolean;
}) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) return <Navigate to="/auth" replace />;
  if (!requireAuth && isAuthenticated) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      {/* ensure all new routes require auth */}
      <Routes>
        <Route
          path="/auth"
          element={
            <AuthGuard requireAuth={false}>
              <AuthPage />
            </AuthGuard>
          }
        />
        <Route
          element={
            <AuthGuard requireAuth={true}>
              <AzureAiProvider>
                <AppShell />
              </AzureAiProvider>
            </AuthGuard>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tests" element={<TestsPage />} />
          <Route path="/tests/:testId" element={<TestEditorPage />} />
          <Route path="/import" element={<ImportTestPage />} />
          <Route path="/suites" element={<SuitesPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/runs/:runId" element={<RunDetailPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
