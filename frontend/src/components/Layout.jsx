import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

const links = [
  { to: '/', label: 'Dashboard', icon: '◈' },
  { to: '/contacts', label: 'Contacts', icon: '◎' },
  { to: '/lead-generator', label: 'Lead Generator', icon: '✦' },
  { to: '/leads', label: 'Lead Management', icon: '▤' },
  { to: '/autopilot', label: 'Autopilot AI', icon: '⚡' },
  { to: '/lead-settings', label: 'Lead Settings', icon: '⚙' },
  { to: '/settings', label: 'Settings', icon: '◇' },
];

export default function Layout({ toast }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <span>PS</span>
          </div>
          <div className="brand-text">
            <strong>Practo Sales</strong>
            <small>Automation Suite</small>
          </div>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}>
              <span className="nav-icon">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          Workspace · India Growth
          <br />
          Autopilot channels live on WhatsApp & Gmail
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
