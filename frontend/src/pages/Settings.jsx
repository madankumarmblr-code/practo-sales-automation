import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadExport } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';

export default function Settings() {
  const toast = useToast();
  const { can, user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'agent',
  });

  async function load() {
    try {
      const s = await api.getSettings();
      setSettings(s);
      if (can('users:read')) {
        setUsers(await api.getUsers());
        setRoles(await api.getRoles());
      }
    } catch (e) {
      toast(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      toast('Settings saved');
    } catch (e) {
      toast(e.message);
    }
  }

  function patch(section, key, value) {
    setSettings((s) => ({
      ...s,
      [section]: {
        ...s[section],
        [key]: value,
      },
    }));
  }

  async function exportResource(resource, format) {
    try {
      await downloadExport(resource, format);
      toast(`Exported ${resource} (${format})`);
    } catch (e) {
      toast(e.message);
    }
  }

  async function createUser(e) {
    e.preventDefault();
    try {
      await api.createUser(userForm);
      toast('User created');
      setUserForm({ name: '', email: '', password: '', role: 'agent' });
      load();
    } catch (err) {
      toast(err.message);
    }
  }

  if (!settings) {
    return <div className="panel muted">Loading settings…</div>;
  }

  const profile = settings.profile || {};
  const ai = settings.ai || {};
  const notifications = settings.notifications || {};

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Settings</h1>
          <p>Workspace profile, AI preferences, permission users, and data export.</p>
        </div>
        <div className="topbar-actions">
          {can('settings:write') ? (
            <button type="button" className="btn btn-primary" onClick={save}>
              Save settings
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="panel">
          <h2>Workspace profile</h2>
          <div className="form-grid">
            <label className="field">
              Organization
              <input
                value={profile.orgName || ''}
                onChange={(e) => patch('profile', 'orgName', e.target.value)}
                disabled={!can('settings:write')}
              />
            </label>
            <label className="field">
              Workspace
              <input
                value={profile.workspace || ''}
                onChange={(e) => patch('profile', 'workspace', e.target.value)}
                disabled={!can('settings:write')}
              />
            </label>
            <div className="form-grid two">
              <label className="field">
                Timezone
                <input
                  value={profile.timezone || ''}
                  onChange={(e) => patch('profile', 'timezone', e.target.value)}
                  disabled={!can('settings:write')}
                />
              </label>
              <label className="field">
                Currency
                <input
                  value={profile.currency || ''}
                  onChange={(e) => patch('profile', 'currency', e.target.value)}
                  disabled={!can('settings:write')}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>AI Autopilot</h2>
          <div className="form-grid">
            <label className="field">
              Model
              <input
                value={ai.model || ''}
                onChange={(e) => patch('ai', 'model', e.target.value)}
                disabled={!can('settings:write')}
              />
            </label>
            <label className="field">
              Tone
              <select
                value={ai.tone || 'professional-warm'}
                onChange={(e) => patch('ai', 'tone', e.target.value)}
                disabled={!can('settings:write')}
              >
                <option value="professional-warm">Professional warm</option>
                <option value="concise">Concise</option>
                <option value="consultative">Consultative</option>
              </select>
            </label>
            <label className="field">
              Auto follow-up (hours)
              <input
                type="number"
                value={ai.autoFollowUpHours || 48}
                onChange={(e) => patch('ai', 'autoFollowUpHours', Number(e.target.value))}
                disabled={!can('settings:write')}
              />
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={!!ai.personalizeWithCompany}
                onChange={(e) => patch('ai', 'personalizeWithCompany', e.target.checked)}
                disabled={!can('settings:write')}
              />
              Personalize with company context
            </label>
          </div>
        </div>

        <div className="panel">
          <h2>Notifications</h2>
          <label className="switch" style={{ marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={!!notifications.email}
              onChange={(e) => patch('notifications', 'email', e.target.checked)}
              disabled={!can('settings:write')}
            />
            Email alerts
          </label>
          <label className="switch" style={{ marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={!!notifications.inApp}
              onChange={(e) => patch('notifications', 'inApp', e.target.checked)}
              disabled={!can('settings:write')}
            />
            In-app alerts
          </label>
          <label className="field">
            Slack webhook
            <input
              placeholder="https://hooks.slack.com/..."
              value={notifications.slackWebhook || ''}
              onChange={(e) => patch('notifications', 'slackWebhook', e.target.value)}
              disabled={!can('settings:write')}
            />
          </label>
          <div style={{ marginTop: '1rem' }}>
            <Link className="btn btn-secondary" to="/api-integrations">
              Open API Integrations →
            </Link>
          </div>
        </div>

        <div className="panel">
          <h2>Export</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Download workspace data. Integration exports exclude secrets.
          </p>
          {!can('export:read') ? (
            <div className="muted">Your permission level cannot export data.</div>
          ) : (
            <div className="export-grid">
              {[
                ['leads', 'Leads'],
                ['contacts', 'Contacts'],
                ['campaigns', 'Campaigns'],
                ['activities', 'Activities'],
                ['integrations', 'API Integrations'],
                ['settings', 'Settings'],
                ['full', 'Full workspace'],
              ].map(([key, label]) => (
                <div key={key} className="export-row">
                  <strong>{label}</strong>
                  <div>
                    <button type="button" className="btn btn-ghost" onClick={() => exportResource(key, 'json')}>
                      JSON
                    </button>
                    {key !== 'settings' && key !== 'full' ? (
                      <button type="button" className="btn btn-ghost" onClick={() => exportResource(key, 'csv')}>
                        CSV
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {can('users:read') ? (
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <h2>Permission-level users</h2>
            <p className="muted">Signed in as {user?.email} ({user?.roleLabel})</p>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Level</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className="badge badge-teal">{u.roleLabel}</span>
                      </td>
                      <td>{u.level}</td>
                      <td>{u.active ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {can('users:write') ? (
              <form className="form-grid two" style={{ marginTop: '1rem' }} onSubmit={createUser}>
                <label className="field">
                  Name
                  <input
                    required
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  />
                </label>
                <label className="field">
                  Email
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  />
                </label>
                <label className="field">
                  Password
                  <input
                    type="password"
                    required
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  />
                </label>
                <label className="field">
                  Permission level
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label} (L{r.level})
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn btn-primary">
                  Add user
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
