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
                        Test
                      </button>
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
    </>
  );
}
