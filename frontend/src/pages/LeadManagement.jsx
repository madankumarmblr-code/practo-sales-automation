import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';
import { formatCurrency, stageBadge } from '../utils/format';

const emptyLead = {
  name: '',
  email: '',
  phone: '',
  company: '',
  title: '',
  source: 'manual',
  stage: 'new',
  score: 50,
  value: 0,
  assigned_to: 'Unassigned',
  next_action: '',
  notes: '',
};

export default function LeadManagement() {
  const toast = useToast();
  const [leads, setLeads] = useState([]);
  const [stages, setStages] = useState([]);
  const [view, setView] = useState('board');
  const [filter, setFilter] = useState({ q: '', status: 'open' });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyLead);
  const [editing, setEditing] = useState(null);

  async function load() {
    try {
      const [leadRows, stageRows] = await Promise.all([
        api.getLeads(filter.status ? { status: filter.status } : {}),
        api.getStages(),
      ]);
      let rows = leadRows;
      if (filter.q) {
        const q = filter.q.toLowerCase();
        rows = rows.filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            (l.company || '').toLowerCase().includes(q) ||
            (l.email || '').toLowerCase().includes(q)
        );
      }
      setLeads(rows);
      setStages(stageRows);
    } catch (e) {
      toast(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [filter.status]);

  const byStage = useMemo(() => {
    const map = {};
    for (const s of stages) map[s.slug] = [];
    for (const l of leads) {
      if (!map[l.stage]) map[l.stage] = [];
      map[l.stage].push(l);
    }
    return map;
  }, [leads, stages]);

  function openCreate() {
    setEditing(null);
    setForm(emptyLead);
    setOpen(true);
  }

  function openEdit(lead) {
    setEditing(lead.id);
    setForm({
      name: lead.name,
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
      title: lead.title || '',
      source: lead.source || 'manual',
      stage: lead.stage || 'new',
      score: lead.score ?? 50,
      value: lead.value ?? 0,
      assigned_to: lead.assigned_to || 'Unassigned',
      next_action: lead.next_action || '',
      notes: lead.notes || '',
      status: lead.status || 'open',
    });
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateLead(editing, form);
        toast('Lead updated');
      } else {
        await api.createLead(form);
        toast('Lead created');
      }
      setOpen(false);
      load();
    } catch (err) {
      toast(err.message);
    }
  }

  async function moveStage(leadId, stage) {
    try {
      await api.updateLead(leadId, { stage });
      toast(`Moved to ${stage}`);
      load();
    } catch (err) {
      toast(err.message);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this lead?')) return;
    try {
      await api.deleteLead(id);
      toast('Lead deleted');
      load();
    } catch (err) {
      toast(err.message);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Lead Management</h1>
          <p>Track stages, scores, and ownership across your sales pipeline.</p>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className={`btn ${view === 'board' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('board')}
          >
            Board
          </button>
          <button
            type="button"
            className={`btn ${view === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('table')}
          >
            Table
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Add lead
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input
            type="search"
            placeholder="Filter leads…"
            value={filter.q}
            onChange={(e) => setFilter({ ...filter, q: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="">All</option>
          </select>
          <button type="button" className="btn btn-secondary" onClick={load}>
            Apply
          </button>
        </div>
      </div>

      {view === 'board' ? (
        <div className="pipeline">
          {stages.map((s) => (
            <div className="stage-col" key={s.id}>
              <header>
                <span style={{ color: s.color }}>{s.name}</span>
                <span className="badge">{(byStage[s.slug] || []).length}</span>
              </header>
              {(byStage[s.slug] || []).map((l) => (
                <div className="lead-card" key={l.id} onClick={() => openEdit(l)}>
                  <h4>{l.name}</h4>
                  <p>{l.company}</p>
                  <div className="meta">
                    <span className="score">{l.score}</span>
                    <span>{formatCurrency(l.value)}</span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <select
                      value={l.stage}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => moveStage(l.id, e.target.value)}
                      style={{ width: '100%', borderRadius: 8, padding: '0.35rem' }}
                    >
                      {stages.map((st) => (
                        <option key={st.id} value={st.slug}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Stage</th>
                  <th>Score</th>
                  <th>Value</th>
                  <th>Owner</th>
                  <th>Next action</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.name}</strong>
                      <div className="muted" style={{ fontSize: '0.82rem' }}>
                        {l.company} · {l.source}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${stageBadge(l.stage)}`}>{l.stage}</span>
                    </td>
                    <td className="score">{l.score}</td>
                    <td>{formatCurrency(l.value)}</td>
                    <td>{l.assigned_to}</td>
                    <td>{l.next_action || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-ghost" onClick={() => openEdit(l)}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-danger" onClick={() => remove(l.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>{editing ? 'Edit lead' : 'New lead'}</h2>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Close
              </button>
            </header>
            <form className="form-grid" onSubmit={save}>
              <div className="form-grid two">
                <label className="field">
                  Name
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label className="field">
                  Company
                  <input
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid two">
                <label className="field">
                  Email
                  <input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>
                <label className="field">
                  Phone
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid two">
                <label className="field">
                  Stage
                  <select
                    value={form.stage}
                    onChange={(e) => setForm({ ...form, stage: e.target.value })}
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.slug}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Assigned to
                  <select
                    value={form.assigned_to}
                    onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  >
                    <option>Unassigned</option>
                    <option>Aisha Khan</option>
                    <option>Dev Patel</option>
                  </select>
                </label>
              </div>
              <div className="form-grid two">
                <label className="field">
                  Score
                  <input
                    type="number"
                    value={form.score}
                    onChange={(e) => setForm({ ...form, score: Number(e.target.value) })}
                  />
                </label>
                <label className="field">
                  Value (INR)
                  <input
                    type="number"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                  />
                </label>
              </div>
              <label className="field">
                Source
                <input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                />
              </label>
              <label className="field">
                Next action
                <input
                  value={form.next_action}
                  onChange={(e) => setForm({ ...form, next_action: e.target.value })}
                />
              </label>
              <label className="field">
                Notes
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
              {editing ? (
                <label className="field">
                  Status
                  <select
                    value={form.status || 'open'}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
              ) : null}
              <button type="submit" className="btn btn-primary">
                Save lead
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
