import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthPage } from '@/components/AuthPage';
import { useAuth } from '@/hooks/AuthContext';
import { CategoryAdminPage } from '@/pages/CategoryAdminPage';
import { GlossaryHomePage } from '@/pages/GlossaryHomePage';
import { SemanticSearchPage } from '@/pages/SemanticSearchPage';
import { TermDetailsPage } from '@/pages/TermDetailsPage';
import { TermEditorPage } from '@/pages/TermEditorPage';

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

function OptionalAuthPage({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
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
          path="/"
          element={
            <OptionalAuthPage>
              <GlossaryHomePage />
            </OptionalAuthPage>
          }
        />
        <Route
          path="/search"
          element={
            <OptionalAuthPage>
              <SemanticSearchPage />
            </OptionalAuthPage>
          }
        />
        <Route
          path="/terms/:termId"
          element={
            <OptionalAuthPage>
              <TermDetailsPage />
            </OptionalAuthPage>
          }
        />
        <Route
          path="/admin/terms/new"
          element={
            <AuthGuard requireAuth={true}>
              <TermEditorPage />
            </AuthGuard>
          }
        />
        <Route
          path="/admin/terms/:termId/edit"
          element={
            <AuthGuard requireAuth={true}>
              <TermEditorPage />
            </AuthGuard>
          }
        />
        <Route
          path="/admin/categories"
          element={
            <AuthGuard requireAuth={true}>
              <CategoryAdminPage />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
