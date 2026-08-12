import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';

export default function LeadSettings() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [scoring, setScoring] = useState(null);
  const [autoAssign, setAutoAssign] = useState(null);
  const [enrichment, setEnrichment] = useState(null);
  const [notifications, setNotifications] = useState(null);

  async function load() {
    try {
      const res = await api.getLeadSettings();
      setData(res);
      setScoring(res.settings.scoring_rules);
      setAutoAssign(res.settings.auto_assign);
      setEnrichment(res.settings.enrichment);
      setNotifications(res.settings.notifications);
    } catch (e) {
      toast(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    try {
      await api.updateLeadSettings({
        scoring_rules: scoring,
        auto_assign: autoAssign,
        enrichment,
        notifications,
      });
      toast('Lead settings saved');
      load();
    } catch (e) {
      toast(e.message);
    }
  }

  async function toggleSource(source) {
    try {
      await api.updateSource(source.id, { enabled: !source.enabled });
      toast(`${source.name} ${source.enabled ? 'disabled' : 'enabled'}`);
      load();
    } catch (e) {
      toast(e.message);
    }
  }

  async function updateWeight(source, weight) {
    try {
      await api.updateSource(source.id, { weight: Number(weight) });
      load();
    } catch (e) {
      toast(e.message);
    }
  }

  if (!data || !scoring) {
    return <div className="panel muted">Loading lead settings…</div>;
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Lead Settings</h1>
          <p>Configure scoring, sources, enrichment, and assignment rules for the pipeline.</p>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn btn-primary" onClick={save}>
            Save settings
          </button>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="panel">
          <h2>Scoring rules</h2>
          <div className="form-grid two">
            {Object.entries(scoring)
              .filter(([, v]) => typeof v === 'number')
              .map(([key, value]) => (
                <label className="field" key={key}>
                  {key}
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setScoring({ ...scoring, [key]: Number(e.target.value) })}
                  />
                </label>
              ))}
          </div>
          <label className="switch" style={{ marginTop: '1rem' }}>
            <input
              type="checkbox"
              checked={!!scoring.sourceWeights}
              onChange={(e) => setScoring({ ...scoring, sourceWeights: e.target.checked })}
            />
            Apply source weights to score
          </label>
        </div>

        <div className="panel">
          <h2>Auto-assign</h2>
          <label className="switch" style={{ marginBottom: '0.85rem' }}>
            <input
              type="checkbox"
              checked={!!autoAssign.enabled}
              onChange={(e) => setAutoAssign({ ...autoAssign, enabled: e.target.checked })}
            />
            Enable auto-assignment
          </label>
          <label className="field">
            Strategy
            <select
              value={autoAssign.strategy}
              onChange={(e) => setAutoAssign({ ...autoAssign, strategy: e.target.value })}
            >
              <option value="round_robin">Round robin</option>
              <option value="highest_score_first">Highest score first</option>
              <option value="manual">Manual only</option>
            </select>
          </label>
          <p className="muted" style={{ marginTop: '0.85rem' }}>
            Agents: {(autoAssign.agents || []).join(', ')}
          </p>
        </div>

        <div className="panel">
          <h2>Enrichment</h2>
          <label className="switch">
            <input
              type="checkbox"
              checked={!!enrichment.enabled}
              onChange={(e) => setEnrichment({ ...enrichment, enabled: e.target.checked })}
            />
            Enable enrichment
          </label>
          <label className="switch" style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              checked={!!enrichment.pullCompanyData}
              onChange={(e) => setEnrichment({ ...enrichment, pullCompanyData: e.target.checked })}
            />
            Pull company data
          </label>
          <label className="switch" style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              checked={!!enrichment.suggestScore}
              onChange={(e) => setEnrichment({ ...enrichment, suggestScore: e.target.checked })}
            />
            Suggest AI score
          </label>
        </div>

        <div className="panel">
          <h2>Lead notifications</h2>
          {Object.entries(notifications).map(([key, value]) => (
            <label className="switch" key={key} style={{ display: 'flex', marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })}
              />
              {key}
            </label>
          ))}
        </div>

        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <h2>Lead sources</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Weight</th>
                  <th>Enabled</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.sources.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td style={{ width: 160 }}>
                      <input
                        type="number"
                        value={s.weight}
                        onChange={(e) => updateWeight(s, e.target.value)}
                        style={{ width: 90, padding: '0.4rem', borderRadius: 8, border: '1px solid var(--line-strong)' }}
                      />
                    </td>
                    <td>
                      <span className={`badge ${s.enabled ? 'badge-green' : 'badge-gray'}`}>
                        {s.enabled ? 'on' : 'off'}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="btn btn-ghost" onClick={() => toggleSource(s)}>
                        {s.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: '1.25rem' }}>Pipeline stages</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {data.stages.map((s) => (
              <span key={s.id} className="badge" style={{ borderLeft: `4px solid ${s.color}` }}>
                {s.position + 1}. {s.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
