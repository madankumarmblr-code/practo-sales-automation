import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';

export default function Settings() {
  const toast = useToast();
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

  function patchIntegration(channel, key, value) {
    setSettings((s) => ({
      ...s,
      integrations: {
        ...s.integrations,
        [channel]: {
          ...s.integrations[channel],
          [key]: value,
        },
      },
    }));
  }

  if (!settings) {
    return <div className="panel muted">Loading settings…</div>;
  }

  const { profile, integrations, ai, notifications } = settings;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Settings</h1>
          <p>Workspace profile, channel integrations, and AI Autopilot preferences.</p>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn btn-primary" onClick={save}>
            Save settings
          </button>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="panel">
          <h2>Workspace profile</h2>
          <div className="form-grid">
            <label className="field">
              Organization
              <input
                value={profile.orgName}
                onChange={(e) => patch('profile', 'orgName', e.target.value)}
              />
            </label>
            <label className="field">
              Workspace
              <input
                value={profile.workspace}
                onChange={(e) => patch('profile', 'workspace', e.target.value)}
              />
            </label>
            <div className="form-grid two">
              <label className="field">
                Timezone
                <input
                  value={profile.timezone}
                  onChange={(e) => patch('profile', 'timezone', e.target.value)}
                />
              </label>
              <label className="field">
                Currency
                <input
                  value={profile.currency}
                  onChange={(e) => patch('profile', 'currency', e.target.value)}
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
              <input value={ai.model} onChange={(e) => patch('ai', 'model', e.target.value)} />
            </label>
            <label className="field">
              Tone
              <select value={ai.tone} onChange={(e) => patch('ai', 'tone', e.target.value)}>
                <option value="professional-warm">Professional warm</option>
                <option value="concise">Concise</option>
                <option value="consultative">Consultative</option>
              </select>
            </label>
            <label className="field">
              Auto follow-up (hours)
              <input
                type="number"
                value={ai.autoFollowUpHours}
                onChange={(e) => patch('ai', 'autoFollowUpHours', Number(e.target.value))}
              />
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={!!ai.personalizeWithCompany}
                onChange={(e) => patch('ai', 'personalizeWithCompany', e.target.checked)}
              />
              Personalize with company context
            </label>
          </div>
        </div>

        <div className="panel">
          <h2>Integrations</h2>
          {['whatsapp', 'gmail', 'calls'].map((channel) => {
            const item = integrations[channel];
            return (
              <div key={channel} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong style={{ textTransform: 'capitalize' }}>{channel}</strong>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={!!item.connected}
                      onChange={(e) => patchIntegration(channel, 'connected', e.target.checked)}
                    />
                    Connected
                  </label>
                </div>
                {channel === 'whatsapp' ? (
                  <>
                    <label className="field">
                      Business number
                      <input
                        value={item.businessNumber || ''}
                        onChange={(e) => patchIntegration(channel, 'businessNumber', e.target.value)}
                      />
                    </label>
                    <label className="field" style={{ marginTop: 8 }}>
                      Provider
                      <input
                        value={item.provider || ''}
                        onChange={(e) => patchIntegration(channel, 'provider', e.target.value)}
                      />
                    </label>
                  </>
                ) : null}
                {channel === 'gmail' ? (
                  <>
                    <label className="field">
                      Account
                      <input
                        value={item.account || ''}
                        onChange={(e) => patchIntegration(channel, 'account', e.target.value)}
                      />
                    </label>
                    <label className="field" style={{ marginTop: 8 }}>
                      Daily quota
                      <input
                        type="number"
                        value={item.dailyQuota || 0}
                        onChange={(e) =>
                          patchIntegration(channel, 'dailyQuota', Number(e.target.value))
                        }
                      />
                    </label>
                  </>
                ) : null}
                {channel === 'calls' ? (
                  <>
                    <label className="field">
                      Provider
                      <input
                        value={item.provider || ''}
                        onChange={(e) => patchIntegration(channel, 'provider', e.target.value)}
                      />
                    </label>
                    <label className="field" style={{ marginTop: 8 }}>
                      Number
                      <input
                        value={item.number || ''}
                        onChange={(e) => patchIntegration(channel, 'number', e.target.value)}
                      />
                    </label>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="panel">
          <h2>Notifications</h2>
          <label className="switch" style={{ marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={!!notifications.email}
              onChange={(e) => patch('notifications', 'email', e.target.checked)}
            />
            Email alerts
          </label>
          <label className="switch" style={{ marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={!!notifications.inApp}
              onChange={(e) => patch('notifications', 'inApp', e.target.checked)}
            />
            In-app alerts
          </label>
          <label className="field">
            Slack webhook
            <input
              placeholder="https://hooks.slack.com/..."
              value={notifications.slackWebhook || ''}
              onChange={(e) => patch('notifications', 'slackWebhook', e.target.value)}
            />
          </label>
        </div>
      </div>
    </>
  );
}
