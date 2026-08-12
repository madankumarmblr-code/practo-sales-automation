import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';

const emptyUser = {
  name: '',
  email: '',
  username: '',
  password: '',
  role: 'agent',
  active: true,
  permissions: [],
};

export default function SuperAdmin() {
  const toast = useToast();
  const { user, can } = useAuth();
  const [users, setUsers] = useState([]);
  const [rolesMeta, setRolesMeta] = useState({ roles: [], permissions: [] });
  const [events, setEvents] = useState([]);
  const [health, setHealth] = useState(null);
  const [form, setForm] = useState(emptyUser);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('users');

  const allowed = can('users:write') || user?.role === 'superadmin';

  const permissionGroups = useMemo(() => {
    const map = {};
    for (const p of rolesMeta.permissions || []) {
      if (!map[p.group]) map[p.group] = [];
      map[p.group].push(p);
    }
    return map;
  }, [rolesMeta.permissions]);

  async function load() {
    try {
      const [u, r, e, h] = await Promise.all([
        api.getUsers(),
        api.getRoles(),
        api.getSystemEvents({ limit: 80 }),
        api.getSystemHealth(),
      ]);
      setUsers(u);
      setRolesMeta(r);
      setEvents(e);
      setHealth(h);
    } catch (err) {
      toast(err.message);
    }
  }

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  function startCreate() {
    const role = rolesMeta.roles?.[0]?.id || 'agent';
    const perms = rolesMeta.roles?.find((r) => r.id === role)?.permissions || [];
    setEditingId(null);
    setForm({ ...emptyUser, role, permissions: [...perms] });
  }

  function startEdit(u) {
    setEditingId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      username: u.username || '',
      password: '',
      role: u.role,
      active: u.active,
      permissions: [...(u.permissions || [])].filter((p) => p !== '*'),
    });
  }

  function applyRoleDefaults(roleId) {
    const role = rolesMeta.roles.find((r) => r.id === roleId) || rolesMeta.allRoles?.find((r) => r.id === roleId);
    setForm((f) => ({
      ...f,
      role: roleId,
      permissions: [...(role?.permissions || [])].filter((p) => p !== '*'),
    }));
  }

  function togglePerm(id) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(id)
        ? f.permissions.filter((p) => p !== id)
        : [...f.permissions, id],
    }));
  }

  async function saveUser(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        username: form.username,
        role: form.role,
        active: form.active,
        permissions: form.permissions,
      };
      if (form.password) payload.password = form.password;
      if (editingId) {
        if (!form.password) delete payload.password;
        await api.updateUser(editingId, payload);
        toast('User updated');
      } else {
        if (!form.password) {
          toast('Password is required for new users');
          setBusy(false);
          return;
        }
        await api.createUser({ ...payload, password: form.password });
        toast('User created');
      }
      setForm(emptyUser);
      setEditingId(null);
      load();
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(id) {
    if (!confirm('Delete this user?')) return;
    try {
      await api.deleteUser(id);
      toast('User deleted');
      load();
    } catch (err) {
      toast(err.message);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Super Admin</h1>
          <p>
            Manage users, permission levels, passwords, and verify database logs/events are working.
          </p>
        </div>
        <div className="topbar-actions">
          <button type="button" className={`btn ${tab === 'users' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('users')}>
            Users & permissions
          </button>
          <button type="button" className={`btn ${tab === 'health' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('health')}>
            Health & logs
          </button>
          <button type="button" className="btn btn-ghost" onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      {tab === 'users' ? (
        <div className="grid grid-2">
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Users</h2>
              <button type="button" className="btn btn-primary" onClick={startCreate}>
                Add user
              </button>
            </div>
            <div className="table-wrap" style={{ marginTop: '1rem' }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>User ID</th>
                    <th>Role</th>
                    <th>Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name}</strong>
                        <div className="muted" style={{ fontSize: '0.8rem' }}>
                          {u.email}
                        </div>
                      </td>
                      <td>{u.username || '—'}</td>
                      <td>
                        <span className={`badge ${u.role === 'superadmin' ? 'badge-coral' : 'badge-teal'}`}>
                          {u.roleLabel}
                        </span>
                      </td>
                      <td>{u.active ? 'Yes' : 'No'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn btn-ghost" onClick={() => startEdit(u)}>
                          Edit
                        </button>
                        {u.role !== 'superadmin' ? (
                          <button type="button" className="btn btn-danger" onClick={() => removeUser(u.id)}>
                            Delete
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h2>{editingId ? 'Edit user' : 'Create user'}</h2>
            <form className="form-grid" onSubmit={saveUser}>
              <label className="field">
                Full name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <div className="form-grid two">
                <label className="field">
                  User ID
                  <input
                    required
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="e.g. sales.agent1"
                  />
                </label>
                <label className="field">
                  Email
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>
              </div>
              <label className="field">
                Password {editingId ? '(leave blank to keep)' : ''}
                <input
                  type="password"
                  required={!editingId}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>
              <label className="field">
                Permission level (role)
                <select
                  value={form.role}
                  disabled={form.role === 'superadmin' && editingId}
                  onChange={(e) => applyRoleDefaults(e.target.value)}
                >
                  {(form.role === 'superadmin'
                    ? [{ id: 'superadmin', label: 'Super Admin', level: 1000 }, ...(rolesMeta.roles || [])]
                    : rolesMeta.roles || []
                  ).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label} (L{r.level})
                    </option>
                  ))}
                </select>
              </label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={!!form.active}
                  disabled={form.role === 'superadmin'}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Active
              </label>

              {form.role !== 'superadmin' ? (
                <div>
                  <h3 style={{ margin: '0.5rem 0' }}>Fine-grained permissions</h3>
                  {Object.entries(permissionGroups)
                    .filter(([g]) => g !== 'Super Admin')
                    .map(([group, perms]) => (
                      <div key={group} style={{ marginBottom: '0.75rem' }}>
                        <strong style={{ fontSize: '0.85rem' }}>{group}</strong>
                        <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                          {perms.map((p) => (
                            <label className="switch" key={p.id}>
                              <input
                                type="checkbox"
                                checked={form.permissions.includes(p.id)}
                                onChange={() => togglePerm(p.id)}
                              />
                              {p.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="muted">Super Admin always has full access.</p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create user'}
                </button>
                {editingId ? (
                  <button type="button" className="btn btn-ghost" onClick={() => { setEditingId(null); setForm(emptyUser); }}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="grid grid-2">
          <div className="panel">
            <h2>Database & system health</h2>
            {!health ? (
              <div className="muted">Loading…</div>
            ) : (
              <>
                <div style={{ marginBottom: '0.85rem' }}>
                  <span className={`badge ${health.ok ? 'badge-green' : 'badge-coral'}`}>
                    {health.ok ? 'Healthy' : 'Issues detected'}
                  </span>
                  <span className="muted" style={{ marginLeft: 8, fontSize: '0.85rem' }}>
                    {health.time}
                  </span>
                </div>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Check</th>
                        <th>Status</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {health.checks.map((c) => (
                        <tr key={c.name}>
                          <td>{c.name}</td>
                          <td>
                            <span className={`badge ${c.ok ? 'badge-green' : 'badge-coral'}`}>
                              {c.ok ? 'OK' : 'FAIL'}
                            </span>
                          </td>
                          <td>{c.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h3>Table counts</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(health.counts || {}).map(([k, v]) => (
                    <span key={k} className="badge badge-blue">
                      {k}: {v}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="panel">
            <h2>System events & API logs</h2>
            <div className="table-wrap" style={{ maxHeight: 520, overflow: 'auto' }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                        {new Date(ev.created_at).toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            ev.type === 'error'
                              ? 'badge-coral'
                              : ev.type === 'warn'
                                ? 'badge-amber'
                                : 'badge-teal'
                          }`}
                        >
                          {ev.type}
                        </span>
                      </td>
                      <td>{ev.category}</td>
                      <td>
                        <strong>{ev.message}</strong>
                        <div className="muted" style={{ fontSize: '0.8rem' }}>
                          {ev.detail}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!events.length ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        No events yet — use the app to generate logs.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
