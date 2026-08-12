import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';
import { formatCurrency } from '../utils/format';

export default function LeadGenerator() {
  const toast = useToast();
  const [criteria, setCriteria] = useState({
    industry: 'healthcare',
    location: 'Bangalore',
    role: 'Clinic Owner',
    channel: 'mixed',
    limit: 8,
  });
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState({});
  const [busy, setBusy] = useState(false);

  async function search(e) {
    e?.preventDefault();
    setBusy(true);
    try {
      const data = await api.searchLeads(criteria);
      setResults(data.results);
      setSelected({});
      toast(`Found ${data.count} matching leads`);
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  }

  function toggle(id) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function toggleAll() {
    if (results.every((r) => selected[r.id])) {
      setSelected({});
      return;
    }
    const next = {};
    results.forEach((r) => {
      next[r.id] = true;
    });
    setSelected(next);
  }

  async function importSelected() {
    const leads = results.filter((r) => selected[r.id]);
    if (!leads.length) {
      toast('Select at least one lead');
      return;
    }
    setBusy(true);
    try {
      const data = await api.importLeads(leads);
      toast(`Imported ${data.imported} leads into pipeline`);
      setSelected({});
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Lead Generator</h1>
          <p>Discover clinic and healthcare prospects, then push them into Lead Management.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="panel">
          <h2>Search criteria</h2>
          <form className="form-grid" onSubmit={search}>
            <label className="field">
              Industry
              <select
                value={criteria.industry}
                onChange={(e) => setCriteria({ ...criteria, industry: e.target.value })}
              >
                <option value="healthcare">Healthcare</option>
                <option value="dental">Dental</option>
                <option value="diagnostics">Diagnostics</option>
                <option value="wellness">Wellness</option>
              </select>
            </label>
            <label className="field">
              Location
              <input
                value={criteria.location}
                onChange={(e) => setCriteria({ ...criteria, location: e.target.value })}
              />
            </label>
            <label className="field">
              Target role
              <select
                value={criteria.role}
                onChange={(e) => setCriteria({ ...criteria, role: e.target.value })}
              >
                <option>Clinic Owner</option>
                <option>Medical Director</option>
                <option>Operations Head</option>
                <option>Growth Lead</option>
                <option>Practice Manager</option>
              </select>
            </label>
            <label className="field">
              Preferred Autopilot channel
              <div className="channel-pills" style={{ marginTop: 6 }}>
                {['mixed', 'whatsapp', 'gmail', 'calls'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`channel-pill ${criteria.channel === c ? 'active' : ''}`}
                    onClick={() => setCriteria({ ...criteria, channel: c })}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </label>
            <label className="field">
              Result limit
              <input
                type="number"
                min={1}
                max={10}
                value={criteria.limit}
                onChange={(e) => setCriteria({ ...criteria, limit: Number(e.target.value) })}
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Searching…' : 'Generate leads'}
            </button>
          </form>
        </div>

        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Results</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={toggleAll} disabled={!results.length}>
                Select all
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={importSelected}
                disabled={busy || !Object.values(selected).some(Boolean)}
              >
                Import selected
              </button>
            </div>
          </div>

          {!results.length ? (
            <div className="empty">Run a search to surface AI-matched prospects.</div>
          ) : (
            <div style={{ marginTop: '1rem' }}>
              {results.map((r) => (
                <label
                  key={r.id}
                  className="list-row"
                  style={{ alignItems: 'flex-start', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input type="checkbox" checked={!!selected[r.id]} onChange={() => toggle(r.id)} />
                    <div>
                      <strong>{r.name}</strong>
                      <div className="muted" style={{ fontSize: '0.85rem' }}>
                        {r.title} · {r.company} · {r.location}
                      </div>
                      <div style={{ marginTop: 6, fontSize: '0.85rem' }}>{r.matchReason}</div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span className="badge badge-teal">score {r.score}</span>
                        <span className="badge badge-amber">{formatCurrency(r.estimatedValue)}</span>
                        <span className="badge badge-blue">{r.suggestedChannel}</span>
                        <span className="badge">{r.source}</span>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
