import { useEffect, useMemo, useState } from 'react';
import { api, downloadExport } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';

export default function ApiIntegrations() {
  const toast = useToast();
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selfTest, setSelfTest] = useState(null);
  const [selfForm, setSelfForm] = useState({ phone: '', email: '', product: 'prime' });
  const [selfBusy, setSelfBusy] = useState(false);

  async function load() {
    try {
      setItems(await api.getIntegrations());
    } catch (e) {
      toast(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = {};
    for (const item of items) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return map;
  }, [items]);

  function openEdit(item) {
    setEditing(item.id);
    setForm({
      enabled: item.enabled,
      status: item.status,
      notes: item.notes || '',
      config: { ...item.config },
      secrets: Object.fromEntries(Object.keys(item.secrets || {}).map((k) => [k, ''])),
    });
  }

  async function save() {
    if (!can('api_integrations:write')) {
      toast('You do not have permission to edit integrations');
      return;
    }
    setBusy(true);
    try {
      const secrets = {};
      for (const [k, v] of Object.entries(form.secrets || {})) {
        if (v) secrets[k] = v;
      }
      await api.updateIntegration(editing, {
        enabled: form.enabled,
        status: form.status,
        notes: form.notes,
        config: form.config,
        secrets,
      });
      toast('Integration saved — ready to use');
      setEditing(null);
      load();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function test(id) {
    if (!can('api_integrations:write')) {
      toast('You do not have permission to test integrations');
      return;
    }
    try {
      const res = await api.testIntegration(id);
      toast(res.message);
      load();
    } catch (e) {
      toast(e.message);
    }
  }

  function openSelfTest(item) {
    if (!['whatsapp', 'gmail', 'calls'].includes(item.channel)) {
      toast('Self-test to your number/email is for WhatsApp, Gmail, and Calls');
      return;
    }
    setSelfTest(item);
    setSelfForm({ phone: '', email: '', product: 'prime' });
  }

  async function runSelfTest() {
    if (!can('api_integrations:write')) {
      toast('You do not have permission to test integrations');
      return;
    }
    setSelfBusy(true);
    try {
      const res = await api.selfTestIntegration(selfTest.id, selfForm);
      toast(res.message);
      setSelfTest(null);
      load();
    } catch (e) {
      toast(e.message);
    } finally {
      setSelfBusy(false);
    }
  }

  async function exportIntegrations(format) {
    try {
      await downloadExport('integrations', format);
      toast(`Exported integrations as ${format.toUpperCase()}`);
    } catch (e) {
      toast(e.message);
    }
  }

  const current = items.find((i) => i.id === editing);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>API Integrations</h1>
          <p>
            Ready connectors for WhatsApp (Meta / Gupshup / Exotel), Gmail (OAuth / SendGrid / SES),
            Calls (Twilio / Exotel / Knowlarity), AI, Discovery, and webhooks. Add credentials to go
            live — configs export without secrets.
          </p>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn btn-secondary" onClick={() => exportIntegrations('json')}>
            Export JSON
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => exportIntegrations('csv')}>
            Export CSV
          </button>
        </div>
      </div>

      {Object.entries(grouped).map(([category, list]) => (
        <div className="panel" key={category} style={{ marginBottom: '1rem' }}>
          <h2>{category}</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Integration</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Enabled</th>
                  <th>Last tested</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.label}</strong>
                      <div className="muted" style={{ fontSize: '0.82rem' }}>
                        {item.provider}
                        {item.is_default ? ' · default' : ''} · {item.notes}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-gray">{item.channel || '—'}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          item.status === 'connected'
                            ? 'badge-green'
                            : item.status === 'ready'
                              ? 'badge-teal'
                              : 'badge-gray'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td>{item.enabled ? 'Yes' : 'No'}</td>
                    <td className="muted">{item.last_tested_at || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-ghost" onClick={() => openEdit(item)}>
                        Configure
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => test(item.id)}>
                        Test creds
                      </button>
                      {['whatsapp', 'gmail', 'calls'].includes(item.channel) ? (
                        <button type="button" className="btn btn-primary" onClick={() => openSelfTest(item)}>
                          Test on my {item.channel === 'gmail' ? 'email' : 'number'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {editing && form && current ? (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, 100%)' }}>
            <header>
              <h2>{current.label}</h2>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
                Close
              </button>
            </header>
            <div className="form-grid">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={!!form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  disabled={!can('api_integrations:write')}
                />
                Enabled
              </label>
              <label className="field">
                Status
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  disabled={!can('api_integrations:write')}
                >
                  <option value="ready">Ready</option>
                  <option value="connected">Connected</option>
                  <option value="error">Error</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
              <h3 style={{ margin: '0.5rem 0 0' }}>Config</h3>
              {Object.entries(form.config || {}).map(([key, value]) => (
                <label className="field" key={key}>
                  {key}
                  <input
                    value={value ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, config: { ...form.config, [key]: e.target.value } })
                    }
                    disabled={!can('api_integrations:write')}
                  />
                </label>
              ))}
              <h3 style={{ margin: '0.5rem 0 0' }}>Secrets</h3>
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                Leave blank to keep existing values. Secrets are never included in exports.
              </p>
              {Object.keys(current.secrets || {}).map((key) => (
                <label className="field" key={key}>
                  {key}
                  <input
                    type="password"
                    placeholder={current.hasSecrets ? '•••••••• (unchanged)' : 'Paste credential'}
                    value={form.secrets[key] || ''}
                    onChange={(e) =>
                      setForm({ ...form, secrets: { ...form.secrets, [key]: e.target.value } })
                    }
                    disabled={!can('api_integrations:write')}
                  />
                </label>
              ))}
              <label className="field">
                Notes
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  disabled={!can('api_integrations:write')}
                />
              </label>
              {can('api_integrations:write') ? (
                <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
                  {busy ? 'Saving…' : 'Save integration'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {selfTest ? (
        <div className="modal-backdrop" onClick={() => setSelfTest(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>Test {selfTest.label} on your {selfTest.channel === 'gmail' ? 'email' : 'number'}</h2>
              <button type="button" className="btn btn-ghost" onClick={() => setSelfTest(null)}>
                Close
              </button>
            </header>
            <div className="form-grid">
              <p className="muted" style={{ margin: 0 }}>
                Sends a self-test {selfTest.channel === 'calls' ? 'call script log' : selfTest.channel === 'gmail' ? 'email' : 'WhatsApp message'}
                {' '}and stores it under Autopilot → Sent records.
              </p>
              {selfTest.channel === 'gmail' ? (
                <label className="field">
                  Your email
                  <input
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={selfForm.email}
                    onChange={(e) => setSelfForm({ ...selfForm, email: e.target.value })}
                  />
                </label>
              ) : (
                <label className="field">
                  Your mobile number
                  <input
                    required
                    placeholder="+91 9XXXXXXXXX"
                    value={selfForm.phone}
                    onChange={(e) => setSelfForm({ ...selfForm, phone: e.target.value })}
                  />
                </label>
              )}
              <label className="field">
                Product pitching in test
                <select
                  value={selfForm.product}
                  onChange={(e) => setSelfForm({ ...selfForm, product: e.target.value })}
                >
                  <option value="prime">Practo Prime</option>
                  <option value="reach">Practo Reach</option>
                  <option value="video">Video Shoot</option>
                  <option value="prime_reach">Prime + Reach</option>
                  <option value="full_suite">Full Enterprise Suite</option>
                </select>
              </label>
              <button type="button" className="btn btn-primary" disabled={selfBusy} onClick={runSelfTest}>
                {selfBusy ? 'Sending…' : 'Send self-test'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
