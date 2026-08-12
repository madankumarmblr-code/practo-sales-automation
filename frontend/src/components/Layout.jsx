import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const links = [
  { to: '/', label: 'Dashboard', icon: '◈', perm: 'dashboard:read' },
  { to: '/lead-generator', label: 'Lead Generator', icon: '✦', perm: 'lead_generator:read' },
  { to: '/commercial-suite', label: 'Commercial Suite', icon: '◎', perm: 'commercial_suite:read' },
  { to: '/leads', label: 'Lead Management', icon: '▤', perm: 'leads:read' },
  { to: '/autopilot', label: 'Autopilot AI', icon: '⚡', perm: 'autopilot:read' },
  { to: '/lead-settings', label: 'Lead Settings', icon: '⚙', perm: 'lead_settings:read' },
  { to: '/api-integrations', label: 'API Integrations', icon: '⧉', perm: 'api_integrations:read' },
  { to: '/settings', label: 'Settings', icon: '◇', perm: 'settings:read' },
  { to: '/super-admin', label: 'Super Admin', icon: '★', perm: 'users:write' },
];

export default function Layout({ toast }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user, can, logout, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (loading) {
    return <div className="login-page"><div className="muted">Loading workspace…</div></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const visible = links.filter(
    (l) =>
      can(l.perm) ||
      (l.perm === 'api_integrations:read' && can('settings:read')) ||
      (l.to === '/super-admin' && (user?.role === 'superadmin' || can('users:write')))
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src="/practo-logo-light.svg" alt="Practo" className="practo-logo" />
          <div className="brand-text">
            <strong>Sales Automation</strong>
            <small>{user?.roleLabel}{user?.username ? ` · @${user.username}` : ''}</small>
          </div>
        </div>
        <nav className="nav">
          {visible.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}>
              <span className="nav-icon">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div style={{ marginBottom: 8 }}>
            Signed in as <strong style={{ color: '#fff' }}>{user?.name}</strong>
            <div>{user?.email}</div>
          </div>
          <button type="button" className="btn btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }} onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="main">
        <button
          type="button"
          className="btn btn-secondary mobile-toggle"
          onClick={() => setOpen((v) => !v)}
          style={{ marginBottom: '0.75rem' }}
        >
          Menu
        </button>
        <Outlet />
      </div>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
