import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    login: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login({ login: form.login, password: form.password });
      navigate(user?.role === 'superadmin' ? '/super-admin' : '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ width: 'min(440px, 100%)' }}>
        <div className="login-brand">
          <img src="/practo-logo.svg" alt="Practo" className="practo-logo-lg" />
          <h1>Sales Automation</h1>
          <p>Sign in with your user ID or email and password.</p>
        </div>

        <form className="form-grid" onSubmit={onSubmit}>
          <label className="field">
            User ID / Email
            <input
              required
              name="username"
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="username or email"
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          {error ? <div className="login-error">{error}</div> : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
