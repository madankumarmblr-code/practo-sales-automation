import { useEffect, useMemo, useState } from 'react';
import { api, downloadExport } from '../api/client';
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

const VIEWS = [
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'records', label: 'Sent records' },
  { id: 'dialogues', label: 'Dialogues & templates' },
  { id: 'io', label: 'Import / Export' },
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
    product_pitch: 'reach',
    dialogue_id: '',
  };
}

export default function Autopilot() {
  const toast = useToast();
  const [tab, setTab] = useState('whatsapp');
  const [view, setView] = useState('campaigns');
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);
  const [playbooks, setPlaybooks] = useState({});
  const [integrations, setIntegrations] = useState([]);
  const [products, setProducts] = useState([]);
  const [dialogues, setDialogues] = useState([]);
  const [records, setRecords] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm('whatsapp'));
  const [running, setRunning] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [recordQ, setRecordQ] = useState('');
  const [importText, setImportText] = useState('');
  const [importResource, setImportResource] = useState('leads');

  const playbook = playbooks[tab];
  const channelIntegrations = useMemo(
    () => integrations.filter((i) => i.channel === tab),
    [integrations, tab]
  );
  const channelCampaigns = useMemo(
    () => campaigns.filter((c) => c.channel === tab),
    [campaigns, tab]
  );
  const channelDialogues = useMemo(
    () => dialogues.filter((d) => d.channel === tab),
    [dialogues, tab]
  );

  async function load() {
    try {
      const [all, s, p, integ, dlg, rec] = await Promise.all([
        api.getCampaigns(),
        api.getAutopilotStats(),
        api.getAutopilotPlaybooks().catch(() => ({ channels: {}, products: [], dialogues: [] })),
        api.getIntegrations().catch(() => []),
        api.getAutopilotDialogues({ channel: tab }).catch(() => ({ products: [], dialogues: [] })),
        api.getOutreachRecords({ channel: tab, limit: 100 }).catch(() => ({ records: [] })),
      ]);
      setCampaigns(all);
      setStats(s);
      setPlaybooks(p.channels || s.playbooks || {});
      setProducts(p.products || dlg.products || []);
      setDialogues(p.dialogues || dlg.dialogues || []);
      setIntegrations(integ);
      setRecords(rec.records || []);
    } catch (e) {
      toast(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setForm(emptyForm(tab, playbooks[tab]));
    api
      .getAutopilotDialogues({ channel: tab })
      .then((d) => {
        setDialogues(d.dialogues || []);
        if (d.products?.length) setProducts(d.products);
      })
      .catch(() => {});
    api
      .getOutreachRecords({ channel: tab, limit: 100 })
      .then((r) => setRecords(r.records || []))
      .catch(() => {});
  }, [tab, playbooks]);

  function applyDialogue(dialogueId) {
    const d = dialogues.find((x) => x.id === dialogueId);
    if (!d) {
      setForm((f) => ({ ...f, dialogue_id: dialogueId }));
      return;
    }
    setForm((f) => ({
      ...f,
      dialogue_id: d.id,
      product_pitch: d.product || f.product_pitch,
      subject: d.subject || f.subject,
      message_template: d.body || f.message_template,
    }));
  }

  async function save(e) {
    e.preventDefault();
    try {
      await api.createCampaign({
        ...form,
        channel: tab,
        integration_id: form.integration_id || null,
      });
      toast('Campaign created');
      setOpen(false);
      load();
    } catch (err) {
      toast(err.message);
    }
  }

  async function toggleStatus(c) {
    try {
      await api.updateCampaign(c.id, { status: c.status === 'active' ? 'paused' : 'active' });
      toast(`Campaign ${c.status === 'active' ? 'paused' : 'active'}`);
      load();
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
      load();
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
      load();
    } catch (err) {
      toast(err.message);
    }
  }

  async function doImport() {
    try {
      const res = await api.importResource(importResource, { csv: importText });
      toast(`Imported ${res.imported} ${res.resource} row(s)`);
      setImportText('');
      load();
    } catch (e) {
      toast(e.message);
    }
  }

  const pilot = PILOTS.find((p) => p.id === tab);
  const filteredRecords = records.filter((r) => {
    if (!recordQ) return true;
    const n = recordQ.toLowerCase();
    return JSON.stringify(r).toLowerCase().includes(n);
  });

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Autopilot AI</h1>
          <p>
            WhatsApp, Gmail, and Calls pilots with product pitching (Prime / Reach), dialogue
            templates, sent records, and import/export.
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
            New campaign
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

      <div className="view-tabs">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`btn ${view === v.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'campaigns' ? (
        <div className="grid grid-2">
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <h2>{pilot?.title} campaigns</h2>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Product pitch</th>
                    <th>Dialogue / template</th>
                    <th>Integration</th>
                    <th>Sent today</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {channelCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty">No campaigns yet.</div>
                      </td>
                    </tr>
                  ) : (
                    channelCampaigns.map((c) => {
                      const integ = integrations.find((i) => i.id === c.integration_id);
                      const dlg = dialogues.find((d) => d.id === c.dialogue_id);
                      const prod = products.find((p) => p.id === c.product_pitch);
                      return (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.name}</strong>
                            <div className="muted" style={{ fontSize: '0.82rem' }}>
                              {c.goal}
                            </div>
                            <span className={`badge ${c.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                              {c.status}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-teal">{prod?.label || c.product_pitch || '—'}</span>
                          </td>
                          <td className="muted">{dlg?.title || c.dialogue_id || 'Custom template'}</td>
                          <td className="muted">{integ?.label || 'Default provider'}</td>
                          <td>
                            {c.sent_today}/{c.daily_limit}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button type="button" className="btn btn-ghost" onClick={() => toggleStatus(c)}>
                              {c.status === 'active' ? 'Pause' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={!!running}
                              onClick={() => run(c, 'dry_run')}
                            >
                              Dry-run
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={!!running}
                              onClick={() => run(c, 'live')}
                            >
                              Run now
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
              <div className="empty">Run Dry-run or Run now to preview.</div>
            ) : (
              <>
                <div className="muted" style={{ marginBottom: 8 }}>
                  {lastRun.message}
                </div>
                {(lastRun.actions || []).slice(0, 6).map((a) => (
                  <div className="list-row" key={`${a.leadId}-${a.preview}`}>
                    <div>
                      <strong>{a.leadName}</strong>
                      <div className="muted" style={{ fontSize: '0.82rem' }}>
                        {a.productLabel ? `${a.productLabel} · ` : ''}
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
            <h2>Recent activity</h2>
            {(stats?.recent || []).filter((a) => a.channel === tab).length === 0 ? (
              <div className="empty">No recent events.</div>
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
      ) : null}

      {view === 'records' ? (
        <div className="panel">
          <div className="topbar" style={{ marginBottom: 12, padding: 0 }}>
            <div>
              <h2 style={{ margin: 0 }}>
                {tab === 'calls' ? 'Call records' : tab === 'gmail' ? 'Mails sent' : 'Messages sent'}
              </h2>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                Includes product pitch, dialogue followed, and delivery detail.
              </p>
            </div>
            <input
              className="field"
              style={{ minWidth: 220 }}
              placeholder="Search records…"
              value={recordQ}
              onChange={(e) => setRecordQ(e.target.value)}
            />
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>To</th>
                  <th>Lead / company</th>
                  <th>Product pitch</th>
                  <th>Dialogue / template</th>
                  <th>Message / script detail</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty">No records yet — run a campaign or self-test an integration.</div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id}>
                      <td className="muted">{formatDate(r.created_at)}</td>
                      <td>
                        <span className={`badge ${channelBadge(r.channel)}`}>{r.record_type}</span>
                        {r.direction === 'self_test' ? (
                          <span className="badge badge-amber" style={{ marginLeft: 4 }}>
                            test
                          </span>
                        ) : null}
                      </td>
                      <td>{r.to_phone || r.to_email || '—'}</td>
                      <td>
                        <strong>{r.lead_name || '—'}</strong>
                        <div className="muted" style={{ fontSize: '0.8rem' }}>
                          {r.company}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-teal">{r.product_label || r.product_pitch || '—'}</span>
                      </td>
                      <td className="muted">{r.dialogue_title || r.dialogue_id || '—'}</td>
                      <td style={{ maxWidth: 280 }}>
                        {r.subject ? (
                          <div>
                            <strong>{r.subject}</strong>
                          </div>
                        ) : null}
                        <div className="muted" style={{ fontSize: '0.82rem' }}>
                          {(r.body || r.detail || '').slice(0, 160)}
                          {(r.body || '').length > 160 ? '…' : ''}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-gray">{r.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {view === 'dialogues' ? (
        <div className="grid grid-2">
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <h2>Dialogues & templates to follow — {pilot?.title}</h2>
            <p className="muted">
              Pick a product (Prime / Reach / Video / bundle) and follow the script steps. Applying a
              dialogue fills the campaign template.
            </p>
          </div>
          {channelDialogues.map((d) => (
            <div className="panel" key={d.id}>
              <div className="list-row" style={{ border: 0, paddingTop: 0 }}>
                <div>
                  <strong>{d.title}</strong>
                  <div className="muted" style={{ fontSize: '0.82rem' }}>
                    Product:{' '}
                    <span className="badge badge-teal">
                      {products.find((p) => p.id === d.product)?.label || d.product}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    applyDialogue(d.id);
                    setOpen(true);
                  }}
                >
                  Use in campaign
                </button>
              </div>
              {d.subject ? (
                <div style={{ marginBottom: 8 }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>
                    Subject
                  </div>
                  <strong>{d.subject}</strong>
                </div>
              ) : null}
              <pre className="template-box">{d.body}</pre>
              <ol className="pilot-features">
                {(d.steps || []).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ) : null}

      {view === 'io' ? (
        <div className="grid grid-2">
          <div className="panel">
            <h2>Download import templates</h2>
            <p className="muted">CSV templates with required columns and a sample row.</p>
            <div className="export-grid">
              {['leads', 'campaigns', 'outreach'].map((r) => (
                <div className="export-row" key={r}>
                  <span>{r} template</span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={async () => {
                      try {
                        await api.downloadImportTemplate(r);
                        toast(`Downloaded ${r} template`);
                      } catch (e) {
                        toast(e.message);
                      }
                    }}
                  >
                    Download CSV
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <h2>Export data</h2>
            <div className="export-grid">
              {[
                ['leads', 'Leads'],
                ['campaigns', 'Campaigns'],
                ['outreach', 'Outreach records'],
                ['activities', 'Activities'],
              ].map(([key, label]) => (
                <div className="export-row" key={key}>
                  <span>{label}</span>
                  <span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => downloadExport(key, 'csv').then(() => toast(`Exported ${label} CSV`))}
                    >
                      CSV
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => downloadExport(key, 'json').then(() => toast(`Exported ${label} JSON`))}
                    >
                      JSON
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <h2>Import CSV</h2>
            <div className="form-grid">
              <label className="field">
                Resource
                <select value={importResource} onChange={(e) => setImportResource(e.target.value)}>
                  <option value="leads">Leads</option>
                  <option value="campaigns">Campaigns</option>
                  <option value="outreach">Outreach records</option>
                </select>
              </label>
              <label className="field">
                Paste CSV (including header row)
                <textarea
                  rows={8}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="name,email,phone,..."
                />
              </label>
              <button type="button" className="btn btn-primary" onClick={doImport} disabled={!importText.trim()}>
                Import now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(680px, 100%)' }}>
            <header>
              <h2>New {pilot?.title} campaign</h2>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Close
              </button>
            </header>
            <form className="form-grid" onSubmit={save}>
              <label className="field">
                Name
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="field">
                Product pitching
                <select
                  value={form.product_pitch}
                  onChange={(e) => setForm({ ...form, product_pitch: e.target.value })}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Dialogue / template to follow
                <select value={form.dialogue_id} onChange={(e) => applyDialogue(e.target.value)}>
                  <option value="">Custom / keep current text</option>
                  {channelDialogues
                    .filter((d) => !form.product_pitch || d.product === form.product_pitch || d.id.includes('self_test'))
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                </select>
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
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Goal
                <input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
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
                  <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </label>
              ) : null}
              <label className="field">
                {tab === 'calls' ? 'Call script / dialogue' : 'Message template'}
                <textarea
                  rows={7}
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
                AI polish when OpenAI connector is enabled
              </label>
              <button type="submit" className="btn btn-primary">
                Create campaign
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
