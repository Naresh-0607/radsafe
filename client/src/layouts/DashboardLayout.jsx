import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Radiation,
  LayoutDashboard,
  Users,
  MapPin,
  Radio,
  FileChartColumn,
  ScrollText,
  Activity,
  ClipboardCheck,
  Bell,
  TriangleAlert,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Download,
  Smartphone,
  WifiOff,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePWA } from '../hooks/usePWA';
const adminLinks = [
  ['dashboard', 'Overview', LayoutDashboard],
  ['users', 'User management', Users],
  ['zones', 'Zones', MapPin],
  ['sensors', 'Sensors', Radio],
  ['reports', 'Reports', FileChartColumn],
  ['audit-logs', 'Audit logs', ScrollText],
];
const officerLinks = [
  ['dashboard', 'Overview', LayoutDashboard],
  ['radiation', 'Radiation monitoring', Activity],
  ['personnel', 'Personnel', Users],
  ['inspections', 'Inspections', ClipboardCheck],
  ['alerts', 'Alerts', Bell],
  ['incidents', 'Incidents', TriangleAlert],
  ['reports', 'Reports', FileChartColumn],
];
export default function DashboardLayout({ role }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { canInstall, isInstalled, isOnline, installApp } = usePWA();
  const admin = role === 'ADMIN';
  const base = admin ? '/admin' : '/officer';
  const links = admin ? adminLinks : officerLinks;
  const active = links.find(([path]) => location.pathname.endsWith('/' + path));
  async function signOut() {
    setSigningOut(true);
    try {
      await logout();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <div className="app-shell">
      {!isOnline && (
        <div className="offline-banner" role="alert">
          <WifiOff size={15} />
          <span>
            <strong>Shielded Offline Mode</strong>: Network connection lost. Operating from local cache.
          </span>
        </div>
      )}
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <NavLink to={`${base}/dashboard`} className="brand">
          <span className="brand-icon">
            <Radiation size={26} />
          </span>
          <span>
            RadSafe<span className="brand-sub">SAFETY. IN SIGHT.</span>
          </span>
        </NavLink>
        <button
          className="mobile-close"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <div className="workspace-label">{admin ? 'ADMIN WORKSPACE' : 'SAFETY WORKSPACE'}</div>
        <nav>
          {links.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={`${base}/${path}`}
              onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <Icon size={19} />
              <span>{label}</span>
              {path === 'dashboard' && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {canInstall && (
            <div className="pwa-sidebar-card">
              <div className="pwa-sidebar-card-header">
                <Smartphone size={15} />
                <span>Field Officer PWA</span>
              </div>
              <p>Install to home screen for fast 1-tap mobile inspections.</p>
              <button
                type="button"
                onClick={installApp}
                className="pwa-sidebar-btn"
                title="Install RadSafe on your home screen or desktop"
              >
                <Download size={13} />
                Install App
              </button>
            </div>
          )}
          {isInstalled && (
            <div className="pwa-badge-installed">
              <CheckCircle2 size={13} />
              <span>Field PWA Active</span>
            </div>
          )}
          <div className="simulation-card">
            <ShieldCheck size={22} />
            <strong>Built for learning</strong>
            <p>
              Academic simulation.
              <br />
              Synthetic readings only.
            </p>
            <span>PHASE 1</span>
          </div>
          <div className="sidebar-user">
            <span className="avatar">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{admin ? 'Administrator' : 'Safety Officer'}</small>
            </div>
            <button title="Sign out" aria-label="Sign out" disabled={signingOut} onClick={signOut}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="menu-button"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>Facility workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{active?.[1] || 'Overview'}</strong>
          </div>
          <div className="topbar-right">
            {!isOnline && (
              <span className="offline-pill">
                <WifiOff size={13} /> Offline
              </span>
            )}
            {canInstall && (
              <button
                type="button"
                onClick={installApp}
                className="pwa-install-topbar-btn"
                title="Install RadSafe PWA"
              >
                <Download size={13} />
                <span>Install App</span>
              </button>
            )}
            <span className="simulation-pill">
              <span /> Simulation mode
            </span>
            <span className="role-badge">{admin ? 'ADMIN' : 'SAFETY OFFICER'}</span>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>
            RadSafe <span className="muted">/</span> Academic safety monitoring
          </span>
          <span>Demo data · No equipment integration</span>
        </footer>
      </div>
    </div>
  );
}
