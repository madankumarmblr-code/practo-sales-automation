import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';
import { channelBadge, formatDate } from '../utils/format';

const PILOTS = [
  {
    id: 'whatsapp',
    title: 'WhatsApp AI Pilot',
    blurb: 'Warm intros & follow-ups on WhatsApp Business APIs.',
    providersHint: 'Meta Cloud · Gupshup · Exotel',
  },
  {
    id: 'gmail',
    title: 'Gmail AI Pilot',
    blurb: 'Multi-touch email nurture with subject + body templates.',
    providersHint: 'Gmail OAuth · SendGrid · Amazon SES',
  },
  {
    id: 'calls',
    title: 'Calls AI Pilot',
    blurb: 'AI qualifier scripts and dial queues for high-intent leads.',
    providersHint: 'Twilio · Exotel · Knowlarity',
  },
];

function emptyForm(channel, playbook) {
  return {
    name: playbook ? `${playbook.short} campaign` : '',
    channel,
    status: 'paused',
    goal: playbook?.defaultGoal || '',
    subject: playbook?.defaultSubject || '',
    message_template: playbook?.defaultTemplate || '',
    daily_limit: playbook?.defaultDailyLimit || 50,
    integration_id: '',
    ai_personalize: true,
    run_mode: 'live',
  };
}

export default function Autopilot() {
  const toast = useToast();
  const [tab, setTab] = useState('whatsapp');
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);
  const [playbooks, setPlaybooks] = useState({});
  const [integrations, setIntegrations] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm('whatsapp'));
  const [running, setRunning] = useState(null);
  const [lastRun, setLastRun] = useState(null);

  const playbook = playbooks[tab];

  const channelIntegrations = useMemo(
    () => integrations.filter((i) => i.channel === tab),
    [integrations, tab]
  );

  const channelCampaigns = useMemo(
    () => campaigns.filter((c) => c.channel === tab),
    [campaigns, tab]
  );

  async function load(channel = tab) {
    try {
      const [c, s, p, integ] = await Promise.all([
        api.getCampaigns({ channel }),
        api.getAutopilotStats(),
        api.getAutopilotPlaybooks().catch(() => ({ channels: {} })),
        api.getIntegrations({ channel }).catch(() => []),
      ]);
      // Keep all campaigns for KPIs; also load unfiltered for tab switches efficiency
      const all = await api.getCampaigns().catch(() => c);
      setCampaigns(all);
      setStats(s);
      setPlaybooks(p.channels || s.playbooks || {});
      // merge channel-specific + from stats
      const fromStats = (s.integrations || []).filter((i) =>
        ['whatsapp', 'gmail', 'calls', 'ai'].includes(i.channel)
      );
      const map = new Map();
      for (const row of [...fromStats, ...integ]) map.set(row.id || row.provider, row);
      // full list for form
      const allInteg = await api.getIntegrations().catch(() => [...map.values()]);
      setIntegrations(allInteg);
    } catch (e) {
      toast(e.message);
    }
  }

  useEffect(() => {
    load(tab);
  }, []);

  useEffect(() => {
    setForm(emptyForm(tab, playbooks[tab]));
  }, [tab, playbooks]);

  async function save(e) {
    e.preventDefault();
    try {
      await api.createCampaign({
        ...form,
        channel: tab,
        integration_id: form.integration_id || null,
      });
      toast(`${PILOTS.find((p) => p.id === tab)?.title || 'Campaign'} created`);
      setOpen(false);
      load(tab);
    } catch (err) {
      toast(err.message);
    }
  }

  async function toggleStatus(c) {
    const status = c.status === 'active' ? 'paused' : 'active';
    try {
      await api.updateCampaign(c.id, { status });
      toast(`Campaign ${status}`);
      load(tab);
    } catch (err) {
      toast(err.message);
    }
  }

  async function run(c, mode) {
    setRunning(`${c.id}:${mode}`);
    try {
      const result = await api.runCampaign(c.id, { mode, limit: 8 });
      setLastRun(result);
      toast(result.message);
      load(tab);
    } catch (err) {
      toast(err.message);
    } finally {
      setRunning(null);
    }
  }

  async function remove(c) {
    if (!confirm(`Delete campaign “${c.name}”?`)) return;
    try {
      await api.deleteCampaign(c.id);
      toast('Campaign deleted');
      load(tab);
    } catch (err) {
      toast(err.message);
    }
  }

  const pilot = PILOTS.find((p) => p.id === tab);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Autopilot AI</h1>
          <p>
            Separate ready-to-use AI pilots for WhatsApp, Gmail, and Calls — multi-provider
            integrations, daily caps, dry-run, and live queue.
          </p>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setForm(emptyForm(tab, playbook));
              setOpen(true);
            }}
          >
            New {pilot?.title?.replace(' AI Pilot', '') || ''} campaign
          </button>
        </div>
      </div>

      {stats ? (
        <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
          <div className="panel kpi">
            <span className="label">Sent today</span>
            <span className="value">{stats.sentToday}</span>
            <span className="delta">{stats.activeCampaigns} active campaigns</span>
          </div>
          <div className="panel kpi">
            <span className="label">WhatsApp</span>
            <span className="value">{stats.byChannel?.whatsapp || 0}</span>
            <span className="delta">{stats.activeByChannel?.whatsapp || 0} active</span>
          </div>
          <div className="panel kpi">
            <span className="label">Gmail</span>
            <span className="value">{stats.byChannel?.gmail || 0}</span>
            <span className="delta">{stats.activeByChannel?.gmail || 0} active</span>
          </div>
          <div className="panel kpi">
            <span className="label">Calls</span>
            <span className="value">{stats.byChannel?.calls || 0}</span>
            <span className="delta">{stats.activeByChannel?.calls || 0} active</span>
          </div>
        </div>
      ) : null}

      <div className="pilot-tabs" role="tablist">
        {PILOTS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={tab === p.id}
            className={`pilot-tab ${tab === p.id ? 'active' : ''}`}
            onClick={() => setTab(p.id)}
          >
            <strong>{p.title}</strong>
            <span>{p.blurb}</span>
          </button>
        ))}
      </div>

      <div className="panel pilot-hero" style={{ marginBottom: '1rem' }}>
        <div className="pilot-hero-grid">
          <div>
            <p className="eyebrow">{pilot?.providersHint}</p>
            <h2 style={{ margin: '0.25rem 0 0.5rem' }}>{pilot?.title}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {playbook?.description || pilot?.blurb}
            </p>
            {playbook?.advanced?.length ? (
              <ul className="pilot-features">
                {playbook.advanced.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>Integration options</h3>
            {channelIntegrations.length === 0 ? (
              <div className="empty">No connectors yet — open API Integrations.</div>
            ) : (
              channelIntegrations.map((i) => (
                <div className="list-row" key={i.id}>
                  <div>
                    <strong>{i.label}</strong>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {i.provider}
                      {i.is_default ? ' · default' : ''}
                    </div>
                  </div>
                  <span className={`badge ${i.enabled ? 'badge-green' : 'badge-gray'}`}>
                    {i.enabled ? i.status || 'enabled' : 'ready'}
                  </span>
                </div>
              ))
            )}
            <a className="btn btn-secondary" href="/api-integrations" style={{ marginTop: 8 }}>
              Configure integrations
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <h2>{pilot?.title} campaigns</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Integration</th>
                  <th>Status</th>
                  <th>Daily limit</th>
                  <th>Sent today</th>
                  <th>Success</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {channelCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty">No campaigns in this pilot yet. Create one to go live.</div>
                    </td>
                  </tr>
                ) : (
                  channelCampaigns.map((c) => {
                    const integ = integrations.find((i) => i.id === c.integration_id);
                    return (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.name}</strong>
                          <div className="muted" style={{ fontSize: '0.82rem' }}>
                            {c.goal}
                          </div>
                          {c.ai_personalize ? (
                            <span className="badge badge-amber" style={{ marginTop: 4 }}>
                              AI polish
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <span className="muted">{integ?.label || 'Auto (default provider)'}</span>
                        </td>
                        <td>
                          <span className={`badge ${c.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                            {c.status}
                          </span>
                        </td>
                        <td>{c.daily_limit}</td>
                        <td>
                          <div style={{ minWidth: 120 }}>
                            <div style={{ marginBottom: 4 }}>
                              {c.sent_today}/{c.daily_limit}
                            </div>
                            <div className="progress">
                              <span
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (c.sent_today / Math.max(c.daily_limit, 1)) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>{Number(c.success_rate || 0).toFixed(1)}%</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button type="button" className="btn btn-ghost" onClick={() => toggleStatus(c)}>
                            {c.status === 'active' ? 'Pause' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={running === `${c.id}:dry_run`}
                            onClick={() => run(c, 'dry_run')}
                          >
                            {running === `${c.id}:dry_run` ? '…' : 'Dry-run'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={running === `${c.id}:live`}
                            onClick={() => run(c, 'live')}
                          >
                            {running === `${c.id}:live` ? 'Running…' : 'Run now'}
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => remove(c)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>Last run preview</h2>
          {!lastRun ? (
            <div className="empty">Run Dry-run or Run now to preview personalized outreaches.</div>
          ) : (
            <>
              <div className="muted" style={{ marginBottom: 8 }}>
                {lastRun.message} · delivery <strong>{lastRun.delivery}</strong>
                {lastRun.integration ? ` · ${lastRun.integration.label}` : ''}
              </div>
              {(lastRun.actions || []).slice(0, 6).map((a) => (
                <div className="list-row" key={`${a.leadId}-${a.preview}`}>
                  <div>
                    <strong>{a.leadName}</strong>
                    <div className="muted" style={{ fontSize: '0.82rem' }}>
                      {a.to || '—'} · {a.preview}
                    </div>
                  </div>
                  <span className={`badge ${channelBadge(a.channel)}`}>{a.channel}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="panel">
          <h2>Recent {pilot?.title} activity</h2>
          {(stats?.recent || []).filter((a) => a.channel === tab).length === 0 ? (
            <div className="empty">No recent events for this pilot.</div>
          ) : (
            stats.recent
              .filter((a) => a.channel === tab)
              .slice(0, 8)
              .map((a) => (
                <div className="list-row" key={a.id}>
                  <div>
                    <strong>{a.title}</strong>
                    <div className="muted" style={{ fontSize: '0.82rem' }}>
                      {a.detail}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${channelBadge(a.channel)}`}>{a.channel}</span>
                    <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                      {formatDate(a.created_at)}
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>New {pilot?.title} campaign</h2>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Close
              </button>
            </header>
            <form className="form-grid" onSubmit={save}>
              <label className="field">
                Name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="field">
                Integration provider
                <select
                  value={form.integration_id}
                  onChange={(e) => setForm({ ...form, integration_id: e.target.value })}
                >
                  <option value="">Auto — default for {tab}</option>
                  {channelIntegrations.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                      {i.is_default ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Goal
                <input
                  value={form.goal}
                  onChange={(e) => setForm({ ...form, goal: e.target.value })}
                />
              </label>
              <label className="field">
                Daily limit
                <input
                  type="number"
                  min={1}
                  value={form.daily_limit}
                  onChange={(e) => setForm({ ...form, daily_limit: Number(e.target.value) })}
                />
              </label>
              {tab === 'gmail' ? (
                <label className="field">
                  Email subject
                  <input
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Use {{name}} and {{company}}"
                  />
                </label>
              ) : null}
              <label className="field">
                {tab === 'calls' ? 'Call script' : 'Message template'}
                <textarea
                  rows={6}
                  placeholder="Use {{name}}, {{company}}, {{phone}}, {{email}}"
                  value={form.message_template}
                  onChange={(e) => setForm({ ...form, message_template: e.target.value })}
                />
              </label>
              <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!form.ai_personalize}
                  onChange={(e) => setForm({ ...form, ai_personalize: e.target.checked })}
                />
                AI polish copy when OpenAI connector is enabled
              </label>
              <button type="submit" className="btn btn-primary">
                Create ready campaign
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
