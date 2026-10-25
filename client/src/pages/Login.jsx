import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Radiation, ShieldCheck, ArrowRight, Activity, LockKeyhole, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { homeFor } from '../components/Routes';
import { usePWA } from '../hooks/usePWA';
export default function Login() {
  const { login, user, loading, message } = useAuth();
  const { canInstall, installApp } = usePWA();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (loading) return <div className="full-state">Loading…</div>;
  if (user) return <Navigate to={homeFor(user)} replace />;
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const account = await login(form.get('email'), form.get('password'));
      navigate(homeFor(account));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-icon">
            <Radiation />
          </span>
          <span>
            RadSafe<span className="brand-sub">FACILITY SAFETY PLATFORM</span>
          </span>
        </div>
        <div className="login-story-body">
          <span className="eyebrow">A CLEARER VIEW OF FACILITY SAFETY</span>
          <h1>
            Awareness.
            <br />
            Accountability.
            <br />
            <span>Every zone.</span>
          </h1>
          <p>
            One workspace for radiation monitoring, safety inspections, and incident management.
          </p>
          <div className="login-diagram">
            <div className="diagram-orbit" />
            <div className="diagram-center">
              <Radiation size={62} />
            </div>
            <span className="diagram-tag tag-one">
              <Activity size={16} /> Radiation monitoring
            </span>
            <span className="diagram-tag tag-two">
              <ShieldCheck size={16} /> Safety oversight
            </span>
          </div>
        </div>
        <div className="login-foot">
          <span>Facility safety platform · Operational monitoring</span>
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-form">
          <div className="icon-tile">
            <LockKeyhole size={24} />
          </div>
          <span className="eyebrow">AUTHORIZED PERSONNEL</span>
          <h2>Welcome to RadSafe</h2>
          <p>Sign in to your facility safety workspace.</p>
          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}
          <form onSubmit={submit}>
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@facility.example"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
            </label>
            <button className="btn primary login-submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in to workspace'}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="access-note">
            <ShieldCheck size={19} />
            <span>
              Account access is managed by your administrator.
              <br />
              Contact them if you need help signing in.
            </span>
          </div>
          {canInstall && (
            <div style={{ textAlign: 'center', marginTop: '14px' }}>
              <button
                type="button"
                onClick={installApp}
                className="login-pwa-btn"
                title="Install RadSafe on your home screen or desktop"
              >
                <Download size={14} />
                Install Field PWA App
              </button>
            </div>
          )}
        </div>
        <div className="login-disclaimer">
          Demonstration thresholds and readings are synthetic.
          <br />
          This application does not control nuclear equipment.
        </div>
      </section>
    </div>
  );
}
