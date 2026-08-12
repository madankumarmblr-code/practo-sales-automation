import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';
import { channelBadge, formatDate } from '../utils/format';

const emptyCampaign = {
  name: '',
  channel: 'whatsapp',
  status: 'paused',
  goal: '',
  message_template: '',
  daily_limit: 50,
};

export default function Autopilot() {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyCampaign);
  const [running, setRunning] = useState(null);

  async function load() {
    try {
      const [c, s] = await Promise.all([api.getCampaigns(), api.getAutopilotStats()]);
      setCampaigns(c);
      setStats(s);
    } catch (e) {
      toast(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e) {
    e.preventDefault();
    try {
      await api.createCampaign(form);
      toast('Campaign created');
      setOpen(false);
      setForm(emptyCampaign);
      load();
    } catch (err) {
      toast(err.message);
    }
  }

  async function toggleStatus(c) {
    const status = c.status === 'active' ? 'paused' : 'active';
    try {
      await api.updateCampaign(c.id, { status });
      toast(`Campaign ${status}`);
      load();
    } catch (err) {
      toast(err.message);
    }
  }

  async function run(c) {
    setRunning(c.id);
    try {
      const result = await api.runCampaign(c.id);
      toast(result.message);
      load();
    } catch (err) {
      toast(err.message);
    } finally {
      setRunning(null);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Autopilot AI</h1>
          <p>AI-led outreach for WhatsApp, Gmail, and calls — queued, personalized, and measurable.</p>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
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
            <span className="value">{stats.byChannel.whatsapp || 0}</span>
            <span className="delta">messages today</span>
          </div>
          <div className="panel kpi">
            <span className="label">Gmail</span>
            <span className="value">{stats.byChannel.gmail || 0}</span>
            <span className="delta">emails today</span>
          </div>
          <div className="panel kpi">
            <span className="label">Calls</span>
            <span className="value">{stats.byChannel.calls || 0}</span>
            <span className="delta">AI-assisted dials</span>
          </div>
        </div>
      ) : null}

      <div className="grid grid-2">
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <h2>Campaigns</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Daily limit</th>
                  <th>Sent today</th>
                  <th>Success</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <div className="muted" style={{ fontSize: '0.82rem' }}>
                        {c.goal}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${channelBadge(c.channel)}`}>{c.channel}</span>
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
                              width: `${Math.min(100, (c.sent_today / Math.max(c.daily_limit, 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>{c.success_rate}%</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-ghost" onClick={() => toggleStatus(c)}>
                        {c.status === 'active' ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={running === c.id}
                        onClick={() => run(c)}
                      >
                        {running === c.id ? 'Running…' : 'Run now'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>Channel playbooks</h2>
          <div className="list-row">
            <div>
              <strong>WhatsApp</strong>
              <div className="muted">Warm intros & appointment reminder demos</div>
            </div>
            <span className="badge badge-teal">live</span>
          </div>
          <div className="list-row">
            <div>
              <strong>Gmail</strong>
              <div className="muted">Multi-touch nurture with AI personalization</div>
            </div>
            <span className="badge badge-coral">live</span>
          </div>
          <div className="list-row">
            <div>
              <strong>Calls</strong>
              <div className="muted">AI qualifier scripts for inbound website leads</div>
            </div>
            <span className="badge badge-blue">ready</span>
          </div>
        </div>

        <div className="panel">
          <h2>Recent Autopilot activity</h2>
          {(stats?.recent || []).length === 0 ? (
            <div className="empty">No recent Autopilot events.</div>
          ) : (
            stats.recent.map((a) => (
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
              <h2>New Autopilot campaign</h2>
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
                Channel
                <select
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="gmail">Gmail</option>
                  <option value="calls">Calls</option>
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
                  value={form.daily_limit}
                  onChange={(e) => setForm({ ...form, daily_limit: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                Message template
                <textarea
                  rows={5}
                  placeholder="Use {{name}} and {{company}}"
                  value={form.message_template}
                  onChange={(e) => setForm({ ...form, message_template: e.target.value })}
                />
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
