import { useEffect, useMemo, useState } from 'react';
import { api, downloadExport } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { backupIntegration } from '../lib/workspaceBackup';

const CHANNEL_LABELS = {
  whatsapp: 'WhatsApp',
  gmail: 'Gmail / Email',
  calls: 'Calls / Voice',
  ai: 'AI',
  discovery: 'Discovery',
  automation: 'Automation',
};

function ConnectivitySymbol({ connectivity, testing }) {
  if (testing) {
    return (
      <span className="connectivity-pill connectivity-pill--busy" title="Running live API check…">
        <span className="connectivity-dot connectivity-dot--busy" aria-hidden />
        Verifying…
      </span>
    );
  }
  const c = connectivity || { code: 'idle', label: 'Untested', symbol: '○', tone: 'gray', hint: '' };
  return (
    <span className={`connectivity-pill connectivity-pill--${c.tone}`} title={c.hint || c.label}>
      <span className={`connectivity-dot connectivity-dot--${c.tone}`} aria-hidden>
        {c.symbol || '●'}
      </span>
      <span className="connectivity-label">{c.label}</span>
    </span>
  );
}

function secretEntries(item) {
  return Object.keys(item.secrets || {});
}

function configEntries(item) {
  return Object.entries(item.config || {}).filter(([key]) => key !== 'pricing');
}

function IntegrationCard({
  item,
  canWrite,
  testing,
  onVerify,
  onSaved,
  onSelfTest,
  toast,
}) {
  const secrets = secretEntries(item);
  const advancedOptions = configEntries(item);
  const [enabled, setEnabled] = useState(!!item.enabled);
  const [secretDrafts, setSecretDrafts] = useState(() =>
    Object.fromEntries(secrets.map((k) => [k, '']))
  );
  const [advancedKey, setAdvancedKey] = useState(advancedOptions[0]?.[0] || '');
  const [advancedValue, setAdvancedValue] = useState(
    advancedOptions[0] ? String(advancedOptions[0][1] ?? '') : ''
  );
  const [configDraft, setConfigDraft] = useState({ ...(item.config || {}) });
  const [openAdvanced, setOpenAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirtySecrets = secrets.some((k) => String(secretDrafts[k] || '').trim());
  const needsKey = item.availability === 'needs_key';

  useEffect(() => {
    setEnabled(!!item.enabled);
    setSecretDrafts(Object.fromEntries(secretEntries(item).map((k) => [k, ''])));
    setConfigDraft({ ...(item.config || {}) });
    const opts = configEntries(item);
    const nextKey = opts.find(([k]) => k === advancedKey)?.[0] || opts[0]?.[0] || '';
    setAdvancedKey(nextKey);
    setAdvancedValue(nextKey ? String((item.config || {})[nextKey] ?? '') : '');
  }, [item.id, item.updated_at]);

  function pickAdvanced(key) {
    setAdvancedKey(key);
    setAdvancedValue(String(configDraft[key] ?? item.config?.[key] ?? ''));
  }

  function applyAdvancedValue(value) {
    setAdvancedValue(value);
    if (!advancedKey) return;
    setConfigDraft((c) => ({ ...c, [advancedKey]: value }));
  }

  async function saveAndVerify() {
    if (!canWrite) {
      toast('You do not have permission to edit integrations');
      return;
    }
    setSaving(true);
    try {
      const secretsPayload = {};
      for (const [k, v] of Object.entries(secretDrafts)) {
        if (String(v || '').trim()) secretsPayload[k] = String(v).trim();
      }
      await api.updateIntegration(item.id, {
        enabled,
        config: configDraft,
        secrets: secretsPayload,
      });
      backupIntegration(item.provider, {
        enabled,
        config: configDraft,
        secrets: secretsPayload,
        notes: item.notes,
        status: item.status,
        is_default: item.is_default,
      });
      setSecretDrafts(Object.fromEntries(secrets.map((k) => [k, ''])));
      toast('Saved — verifying API…');
      const res = await onVerify(item.id);
      if (res?.ok || res?.status === 'connected') {
        backupIntegration(item.provider, {
          enabled: true,
          status: 'connected',
          config: configDraft,
          secrets: secretsPayload,
          notes: item.notes,
          is_default: item.is_default,
        });
        toast(res.message || 'Connected');
      } else {
        toast(res?.message || 'Saved — check connectivity status');
      }
      onSaved();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`integ-card ${item.connectivity?.code === 'live' ? 'integ-card--live' : ''}`}>
      <header className="integ-card__header">
        <div>
          <div className="integ-card__title-row">
            <h3>{item.label}</h3>
            {item.is_default ? <span className="badge badge-blue">Selected</span> : null}
            <span
              className={`badge ${
                item.pricing === 'free'
                  ? 'badge-green'
                  : item.pricing === 'freemium'
                    ? 'badge-teal'
                    : 'badge-coral'
              }`}
            >
              {item.pricing || 'paid'}
            </span>
          </div>
          <p className="muted integ-card__notes">{item.notes || item.provider}</p>
        </div>
        <ConnectivitySymbol connectivity={item.connectivity} testing={testing || saving} />
      </header>

      {item.last_test_message ? (
        <p className="integ-card__probe muted">{item.last_test_message}</p>
      ) : null}

      <div className="integ-card__body">
        <label className="switch integ-card__enable">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!canWrite}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enabled
        </label>

        {needsKey && secrets.length ? (
          <div className="integ-card__keys">
            <div className="integ-card__keys-title">API credentials</div>
            {secrets.map((key) => (
              <label className="field" key={key}>
                {key}
                <input
                  type="password"
                  autoComplete="off"
                  placeholder={
                    item.hasSecrets ? '•••••••• pasted — leave blank to keep' : `Paste ${key} here`
                  }
                  value={secretDrafts[key] || ''}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setSecretDrafts((s) => ({
                      ...s,
                      [key]: e.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        ) : (
          <div className="integ-card__keys integ-card__keys--free">
            <div className="integ-card__keys-title">No API key required</div>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              Free connector — use Verify to confirm live connectivity.
            </p>
          </div>
        )}

        <details
          className="integ-advanced"
          open={openAdvanced}
          onToggle={(e) => setOpenAdvanced(e.currentTarget.open)}
        >
          <summary>Advanced options</summary>
          {advancedOptions.length ? (
            <div className="integ-advanced__body">
              <label className="field">
                Choose setting to configure
                <select
                  value={advancedKey}
                  disabled={!canWrite}
                  onChange={(e) => pickAdvanced(e.target.value)}
                >
                  {advancedOptions.map(([key]) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </label>
              {advancedKey ? (
                <label className="field">
                  Value for <strong>{advancedKey}</strong>
                  <input
                    value={advancedValue}
                    disabled={!canWrite}
                    placeholder={`Enter ${advancedKey}`}
                    onChange={(e) => applyAdvancedValue(e.target.value)}
                  />
                </label>
              ) : null}
              <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>
                Pick only the advanced fields you need (e.g. phoneNumberId, fromEmail, model). Saved
                with Verify.
              </p>
            </div>
          ) : (
            <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
              No advanced settings for this connector.
            </p>
          )}
        </details>
      </div>

      <footer className="integ-card__footer">
        {canWrite ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || testing}
            onClick={saveAndVerify}
          >
            {saving || testing
              ? 'Verifying…'
              : dirtySecrets || needsKey
                ? 'Save API key & verify'
                : 'Save & verify'}
          </button>
        ) : null}
        {canWrite ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving || testing}
            onClick={async () => {
              const res = await onVerify(item.id);
              if (res?.message) toast(res.message);
              onSaved();
            }}
          >
            Verify only
          </button>
        ) : null}
        {['whatsapp', 'gmail', 'calls'].includes(item.channel) ? (
          <button type="button" className="btn btn-ghost" onClick={() => onSelfTest(item)}>
            Test on my {item.channel === 'gmail' ? 'email' : 'number'}
          </button>
        ) : null}
      </footer>
    </article>
  );
}

export default function ApiIntegrations() {
  const toast = useToast();
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [selfTest, setSelfTest] = useState(null);
  const [selfForm, setSelfForm] = useState({ phone: '', email: '', product: 'prime' });
  const [selfBusy, setSelfBusy] = useState(false);
  const [testAllBusy, setTestAllBusy] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [durableStore, setDurableStore] = useState(null);

  async function load() {
    try {
      setItems(await api.getIntegrations());
    } catch (e) {
      toast(e.message);
    }
  }

  useEffect(() => {
    load();
    fetch('/api/health')
      .then((r) => r.json())
      .then((h) => setDurableStore(Boolean(h.durableStore)))
      .catch(() => setDurableStore(null));
  }, []);

  const counts = useMemo(() => {
    const live = items.filter((i) => i.connectivity?.code === 'live').length;
    const ready = items.filter((i) => i.connectivity?.code === 'ready').length;
    const needsKey = items.filter((i) => i.connectivity?.code === 'needs_key').length;
    const failed = items.filter((i) => i.connectivity?.code === 'error').length;
    return { live, ready, needsKey, failed, total: items.length };
  }, [items]);

  const channels = useMemo(() => {
    const set = new Set(items.map((i) => i.channel || 'other'));
    return ['all', ...[...set].sort()];
  }, [items]);

  const grouped = useMemo(() => {
    const filtered = items.filter((item) => {
      if (channelFilter !== 'all' && (item.channel || 'other') !== channelFilter) return false;
      const code = item.connectivity?.code;
      if (filter === 'working') return code === 'live' || code === 'ready';
      if (filter === 'needs_key') return code === 'needs_key';
      if (filter === 'failed') return code === 'error';
      return true;
    });
    const map = {};
    for (const item of filtered) {
      const key = item.channel || item.category || 'other';
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [items, filter, channelFilter]);

  async function verify(id) {
    if (!can('api_integrations:write')) {
      toast('You do not have permission to test integrations');
      return null;
    }
    setTestingId(id);
    try {
      const res = await api.testIntegration(id);
      return res;
    } catch (e) {
      toast(e.message);
      return null;
    } finally {
      setTestingId(null);
    }
  }

  async function testAll() {
    if (!can('api_integrations:write')) {
      toast('You do not have permission to test integrations');
      return;
    }
    setTestAllBusy(true);
    try {
      const res = await api.testAllIntegrations();
      toast(
        `Live check: ${res.passed} connected · ${res.needsCredentials} need keys · ${res.failed} failed`
      );
      load();
    } catch (e) {
      toast(e.message);
    } finally {
      setTestAllBusy(false);
    }
  }

  async function selectProvider(channel, id) {
    if (!can('api_integrations:write')) return;
    try {
      await api.updateIntegration(id, { is_default: true, enabled: true });
      const row = items.find((i) => i.id === id);
      if (row?.provider) {
        backupIntegration(row.provider, {
          enabled: true,
          is_default: true,
          config: row.config,
          secrets: {},
          notes: row.notes,
          status: row.status,
        });
      }
      toast('Provider selected for this channel');
      load();
    } catch (e) {
      toast(e.message);
    }
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

  return (
    <>
      <div className="topbar">
        <div>
          <h1>API Integrations</h1>
          <p>
            Paste an API key, save & verify to mark <strong>Connected</strong>. Use each card’s{' '}
            <strong>Advanced options</strong> dropdown to configure only the settings you need.
          </p>
        </div>
        <div className="topbar-actions">
          {can('api_integrations:write') ? (
            <button type="button" className="btn btn-primary" disabled={testAllBusy} onClick={testAll}>
              {testAllBusy ? 'Checking APIs…' : 'Refresh all connectivity'}
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={() => exportIntegrations('json')}>
            Export JSON
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => exportIntegrations('csv')}>
            Export CSV
          </button>
        </div>
      </div>

      {durableStore === false ? (
        <div className="panel" style={{ marginBottom: '1rem', borderColor: 'var(--amber, #d4a017)' }}>
          <strong>API keys are kept in this browser.</strong>{' '}
          <span className="muted">
            After a server restart they are re-applied automatically. For shared/multi-device
            durability, add <code>BLOB_READ_WRITE_TOKEN</code> (see VERCEL.md).
          </span>
        </div>
      ) : null}

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="connectivity-summary">
          <div className="connectivity-stat">
            <ConnectivitySymbol connectivity={{ code: 'live', label: 'Connected', symbol: '●', tone: 'green' }} />
            <strong>{counts.live}</strong>
          </div>
          <div className="connectivity-stat">
            <ConnectivitySymbol connectivity={{ code: 'ready', label: 'Ready', symbol: '●', tone: 'teal' }} />
            <strong>{counts.ready}</strong>
          </div>
          <div className="connectivity-stat">
            <ConnectivitySymbol
              connectivity={{ code: 'needs_key', label: 'Needs key', symbol: '●', tone: 'amber' }}
            />
            <strong>{counts.needsKey}</strong>
          </div>
          <div className="connectivity-stat">
            <ConnectivitySymbol connectivity={{ code: 'error', label: 'Failed', symbol: '●', tone: 'coral' }} />
            <strong>{counts.failed}</strong>
          </div>
        </div>
        <div className="toolbar" style={{ marginTop: 12, marginBottom: 0, flexWrap: 'wrap', gap: 8 }}>
          <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
            {channels.map((ch) => (
              <option key={ch} value={ch}>
                {ch === 'all' ? 'All channels' : CHANNEL_LABELS[ch] || ch}
              </option>
            ))}
          </select>
          {[
            { id: 'all', label: `All (${counts.total})` },
            { id: 'working', label: `Working (${counts.live + counts.ready})` },
            { id: 'needs_key', label: `Needs key (${counts.needsKey})` },
            { id: 'failed', label: `Failed (${counts.failed})` },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`btn ${filter === opt.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            No integrations match this filter.
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([channel, list]) => {
          const selectedId = list.find((i) => i.is_default)?.id || list[0]?.id || '';
          return (
            <div className="panel" key={channel} style={{ marginBottom: '1rem' }}>
              <div className="integ-channel-bar">
                <h2 style={{ margin: 0 }}>{CHANNEL_LABELS[channel] || list[0]?.category || channel}</h2>
                {list.length > 1 && can('api_integrations:write') ? (
                  <label className="field integ-channel-select">
                    Active provider
                    <select
                      value={selectedId}
                      onChange={(e) => selectProvider(channel, e.target.value)}
                    >
                      {list.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                          {item.connectivity?.code === 'live' ? ' · Connected' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <div className="integ-card-grid">
                {list.map((item) => (
                  <IntegrationCard
                    key={item.id}
                    item={item}
                    canWrite={can('api_integrations:write')}
                    testing={testingId === item.id || testAllBusy}
                    toast={toast}
                    onVerify={verify}
                    onSaved={load}
                    onSelfTest={setSelfTest}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {selfTest ? (
        <div className="modal-backdrop" onClick={() => setSelfTest(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>
                Test {selfTest.label} on your {selfTest.channel === 'gmail' ? 'email' : 'number'}
              </h2>
              <button type="button" className="btn btn-ghost" onClick={() => setSelfTest(null)}>
                Close
              </button>
            </header>
            <div className="form-grid">
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
