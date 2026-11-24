import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router';
import { useAuth } from './auth/AuthContext';
import { AuthProvider } from './auth/AuthProvider';
import { SessionGate } from './auth/SessionGate';
import { AppLayout } from './components/AppLayout';
import { GroupDetailsPage } from './pages/GroupDetailsPage';
import { GroupFormPage } from './pages/GroupFormPage';
import { GroupImportPage } from './pages/GroupImportPage';
import { ImportPage } from './pages/ImportPage';
import { LecturerGroupsPage } from './pages/LecturerGroupsPage';
import { LoginPage } from './pages/LoginPage';
import { RoleHomePage } from './pages/RoleHomePage';
import { ProtectedRoute, type RedirectState } from './routes/ProtectedRoute';
import { GROUP_VIEW_ROLES, IMPORT_ROLES, ROLE_HOME, groupPath } from './routes/roles';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SessionGate>
          <AppRoutes />
        </SessionGate>
      </AuthProvider>
    </BrowserRouter>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomeRedirect />} />
          <Route element={<ProtectedRoute roles={['student']} />}>
            <Route path="/student" element={<RoleHomePage role="student" />} />
          </Route>
          {/* Group list, view, create, edit and import: lecturers and admins (same as the API). */}
          <Route element={<ProtectedRoute roles={GROUP_VIEW_ROLES} />}>
            <Route path="/lecturer" element={<LecturerGroupsPage />} />
            <Route path="/lecturer/groups/new" element={<GroupFormPage mode="create" />} />
            <Route path="/lecturer/groups/:groupId/edit" element={<GroupFormPage mode="edit" />} />
            <Route path="/lecturer/groups/:groupId/import" element={<GroupImportPage />} />
            <Route path="/lecturer/groups/:groupId" element={<GroupDetailsRoute />} />
            <Route path="/groups/:id" element={<LegacyGroupDetailsRedirect />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin" element={<RoleHomePage role="admin" />} />
          </Route>
          {/* POST /api/users/import is allowed only for lecturers and admins (RolesGuard). */}
          <Route element={<ProtectedRoute roles={IMPORT_ROLES} />}>
            <Route path="/import" element={<ImportRoute />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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

/** CSV import view (SCRUM-57); "back" returns to the user's start page. */
function ImportRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return <ImportPage onBack={() => void navigate(user ? ROLE_HOME[user.role] : '/')} />;
}

/** Group view (SCRUM-78); a new id starts from a fresh page state instead of the previous group. */
function GroupDetailsRoute() {
  const { groupId = '' } = useParams();
  return <GroupDetailsPage key={groupId} groupId={groupId} />;
}

/** Old group view path from #29; keeps bookmarks and older links working. */
function LegacyGroupDetailsRedirect() {
  const { id = '' } = useParams();
  return <Navigate to={groupPath(id)} replace />;
}
