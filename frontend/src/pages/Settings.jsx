import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadExport } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';

export default function Settings() {
  const toast = useToast();
  const { can, user } = useAuth();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api
      .getSettings()
      .then(setSettings)
      .catch((e) => toast(e.message));
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
          <p>Workspace profile, AI preferences, and data export.</p>
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
          <div style={{ marginTop: '1rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn btn-secondary" to="/api-integrations">
              Open API Integrations →
            </Link>
            {user?.role === 'superadmin' || can('users:write') ? (
              <Link className="btn btn-primary" to="/super-admin">
                Super Admin dashboard →
              </Link>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <h2>Export</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Download workspace data. Integration exports exclude secrets.
          </p>
          {!can('export:read') ? (
            <div className="muted">Your account cannot export data.</div>
          ) : (
            <div className="export-grid">
              {[
                ['leads', 'Leads'],
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
      </div>
    </>
  );
}
