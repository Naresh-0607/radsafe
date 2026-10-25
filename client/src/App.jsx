import { lazy, Suspense } from 'react';
import { Loading } from './components/UI';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute, RoleRoute } from './components/Routes';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Management = lazy(() => import('./pages/admin/Management'));
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const Radiation = lazy(() => import('./pages/officer/Radiation'));
const Alerts = lazy(() => import('./pages/officer/Alerts'));
const Workflows = lazy(() => import('./pages/officer/Workflows'));
const Personnel = lazy(() => import('./pages/officer/Personnel'));
const Reports = lazy(() => import('./pages/Reports'));
export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<RoleRoute role="ADMIN" />}>
                  <Route path="/admin" element={<DashboardLayout role="ADMIN" />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    {['users', 'zones', 'sensors'].map((kind) => (
                      <Route
                        key={kind}
                        path={kind}
                        element={<Management key={kind} kind={kind} />}
                      />
                    ))}
                    <Route path="reports" element={<Reports />} />
                    <Route path="audit-logs" element={<AuditLogs />} />
                  </Route>
                </Route>
                <Route element={<RoleRoute role="SAFETY_OFFICER" />}>
                  <Route path="/officer" element={<DashboardLayout role="SAFETY_OFFICER" />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="radiation" element={<Radiation />} />
                    <Route path="alerts" element={<Alerts />} />
                    <Route path="personnel" element={<Personnel />} />
                    <Route
                      path="inspections"
                      element={<Workflows key="inspections" kind="inspections" />}
                    />
                    <Route
                      path="incidents"
                      element={<Workflows key="incidents" kind="incidents" />}
                    />
                    <Route path="reports" element={<Reports />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
