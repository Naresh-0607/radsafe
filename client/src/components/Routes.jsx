import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export const homeFor = (user) =>
  user?.role === 'ADMIN' ? '/admin/dashboard' : '/officer/dashboard';
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="full-state">
        <span className="spinner" /> Verifying your session…
      </div>
    );
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
export function RoleRoute({ role }) {
  const { user } = useAuth();
  return user?.role === role ? <Outlet /> : <Navigate to={homeFor(user)} replace />;
}
