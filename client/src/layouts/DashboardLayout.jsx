import { useState, useEffect } from 'react';
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
  MoreVertical,
  RotateCw,
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
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { canInstall, isInstalled, isOnline, installApp } = usePWA();

  function toggleSidebar() {
    if (window.innerWidth <= 960) {
      setOpen((prev) => !prev);
    } else {
      setCollapsed((prev) => !prev);
    }
  }

  useEffect(() => {
    setOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);
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
      <aside className={`sidebar ${open ? 'is-open' : ''} ${collapsed ? 'desktop-collapsed' : ''}`}>
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
      <div className={`main-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              type="button"
              className="menu-button"
              aria-label="Toggle navigation menu"
              title="Toggle navigation"
              onClick={toggleSidebar}
            >
              <Menu size={20} />
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

            <span className="role-badge">{admin ? 'ADMIN' : 'SAFETY OFFICER'}</span>

            {/* In-app Three-Dot Action Menu */}
            <div className="topbar-menu-wrapper">
              <button
                type="button"
                className="topbar-dot-menu-btn"
                aria-label="More actions"
                title="Application menu"
                onClick={() => setMenuOpen((prev) => !prev)}
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <>
                  <div className="dropdown-overlay" onClick={() => setMenuOpen(false)} />
                  <div className="topbar-dropdown-menu">
                    <div className="dropdown-header">
                      <strong>RadSafe Mobile</strong>
                      <small>
                        {admin ? 'Admin' : 'Officer'} Mode · {isOnline ? 'Online' : 'Offline'}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        setMenuOpen(false);
                        window.location.reload();
                      }}
                    >
                      <RotateCw size={14} />
                      <span>Refresh App</span>
                    </button>
                    {canInstall && (
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => {
                          setMenuOpen(false);
                          installApp();
                        }}
                      >
                        <Download size={14} />
                        <span>Install to Home Screen</span>
                      </button>
                    )}
                    <div className="dropdown-divider" />
                    <button
                      type="button"
                      className="dropdown-item danger"
                      onClick={() => {
                        setMenuOpen(false);
                        signOut();
                      }}
                      disabled={signingOut}
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>
            RadSafe <span className="muted">/</span> Facility safety monitoring
          </span>
          <span>Operational safety management</span>
        </footer>
      </div>
    </div>
  );
}
