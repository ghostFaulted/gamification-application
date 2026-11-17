import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './auth/AuthContext';
import { AuthProvider } from './auth/AuthProvider';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RoleHomePage } from './pages/RoleHomePage';
import { ProtectedRoute, type RedirectState } from './routes/ProtectedRoute';
import { ROLE_HOME } from './routes/roles';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<HomeRedirect />} />
              <Route element={<ProtectedRoute roles={['student']} />}>
                <Route path="/student" element={<RoleHomePage role="student" />} />
              </Route>
              <Route element={<ProtectedRoute roles={['lecturer']} />}>
                <Route path="/lecturer" element={<RoleHomePage role="lecturer" />} />
              </Route>
              <Route element={<ProtectedRoute roles={['admin']} />}>
                <Route path="/admin" element={<RoleHomePage role="admin" />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

/** "/" sends a signed-in user to the start page of their role. */
function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />;
}

/** The login form; once signed in, goes back to the page the user wanted or to their start page. */
function LoginRoute() {
  const { user } = useAuth();
  const location = useLocation();

  if (user) {
    const from = (location.state as RedirectState | null)?.from;
    return <Navigate to={from ?? ROLE_HOME[user.role]} replace />;
  }
  return <LoginPage />;
}
