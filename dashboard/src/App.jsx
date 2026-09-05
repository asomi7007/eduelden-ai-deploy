import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import StudentsPage from './pages/StudentsPage';
import StudentDetailPage from './pages/StudentDetailPage';
import ControlPage from './pages/ControlPage';
import AlertsPage from './pages/AlertsPage';
import WorkshopsPage from './pages/WorkshopsPage';
import AccessKeysPage from './pages/AccessKeysPage';
import ModelsPage from './pages/ModelsPage';
import UsagePage from './pages/UsagePage';
import AuditLogsPage from './pages/AuditLogsPage';
import SharePage from './pages/SharePage';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/share/:keyId" element={<SharePage />} />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/:id" element={<StudentDetailPage />} />
        <Route path="control" element={<ControlPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="workshops" element={<WorkshopsPage />} />
        <Route path="keys" element={<AccessKeysPage />} />
        <Route path="models" element={<ModelsPage />} />
        <Route path="usage" element={<UsagePage />} />
        <Route path="audit" element={<AuditLogsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
