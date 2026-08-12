import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({
    email: 'admin@practo.sales',
    password: 'Admin@123',
    role: 'admin',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getRoles().then(setRoles).catch(() => {});
  }, []);

  if (!loading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function selectRole(roleId) {
    const presets = {
      admin: { email: 'admin@practo.sales', password: 'Admin@123' },
      manager: { email: 'manager@practo.sales', password: 'Manager@123' },
      agent: { email: 'agent@practo.sales', password: 'Agent@123' },
      viewer: { email: 'viewer@practo.sales', password: 'Viewer@123' },
    };
    setForm({
      role: roleId,
      email: presets[roleId]?.email || form.email,
      password: presets[roleId]?.password || form.password,
    });
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/practo-logo.svg" alt="Practo" className="practo-logo-lg" />
          <h1>Sales Automation</h1>
          <p>Sign in with your permission level to access the workspace.</p>
        </div>

        <div className="role-grid">
          {roles.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`role-card ${form.role === r.id ? 'active' : ''}`}
              onClick={() => selectRole(r.id)}
            >
              <strong>{r.label}</strong>
              <span>Level {r.level}</span>
              <small>{r.description}</small>
            </button>
          ))}
        </div>

        <form className="form-grid" onSubmit={onSubmit}>
          <label className="field">
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          {error ? <div className="login-error">{error}</div> : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Signing in…' : `Sign in as ${roles.find((r) => r.id === form.role)?.label || 'user'}`}
          </button>
        </form>
      </div>
    </div>
  );
}
