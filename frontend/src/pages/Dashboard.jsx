import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatCurrency, formatDate, stageBadge } from '../utils/format';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getDashboard()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="panel">
        <p>Could not load dashboard: {error}</p>
      </div>
    );
  }

  if (!data) {
    return <div className="panel muted">Loading dashboard…</div>;
  }

  const { kpis, byStage, stages, activities, hotLeads } = data;
  const isEmpty = !kpis.openLeads && !(activities || []).length;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Dashboard</h1>
          <p>Pipeline health, hot leads, and Autopilot activity across WhatsApp, Gmail, and calls.</p>
        </div>
        <div className="topbar-actions">
          <Link className="btn btn-secondary" to="/lead-generator">
            Generate leads
          </Link>
          <Link className="btn btn-primary" to="/autopilot">
            Open Autopilot
          </Link>
        </div>
      </div>

      {isEmpty ? (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>Workspace is ready</h2>
          <p className="muted">
            No CRM demo data is loaded. Use Lead Generator to discover clinics, or add leads manually.
          </p>
          <Link className="btn btn-primary" to="/lead-generator">
            Start with Lead Generator
          </Link>
        </div>
      ) : null}

      <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
        <div className="panel kpi">
          <span className="label">Open leads</span>
          <span className="value">{kpis.openLeads}</span>
          <span className="delta">{kpis.activeCampaigns} active campaigns</span>
        </div>
        <div className="panel kpi">
          <span className="label">Pipeline value</span>
          <span className="value">{formatCurrency(kpis.pipelineValue)}</span>
          <span className="delta">Won {formatCurrency(kpis.wonValue)}</span>
        </div>
        <div className="panel kpi">
          <span className="label">Avg lead score</span>
          <span className="value">{kpis.avgScore}</span>
          <span className="delta">{kpis.conversionRate}% conversion</span>
        </div>
        <div className="panel kpi">
          <span className="label">Active campaigns</span>
          <span className="value">{kpis.activeCampaigns}</span>
          <span className="delta">Autopilot AI running</span>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="panel">
          <h2>Pipeline by stage</h2>
          <div className="grid" style={{ gap: '0.85rem' }}>
            {stages.map((s) => {
              const count = byStage[s.slug] || 0;
              const max = Math.max(...Object.values(byStage), 1);
              return (
                <div key={s.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    <span className="muted">{count}</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${(count / max) * 100}%`, background: s.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <h2>Hot leads</h2>
          {hotLeads.map((l) => (
            <div className="list-row" key={l.id}>
              <div>
                <strong>{l.name}</strong>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {l.company} · {l.assigned_to}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="score">{l.score}</div>
                <span className={`badge ${stageBadge(l.stage)}`}>{l.stage}</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: '0.85rem' }}>
            <Link className="btn btn-ghost" to="/leads">
              Manage leads →
            </Link>
          </div>
        </div>

        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <h2>Recent activity</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Title</th>
                  <th>Channel</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id}>
                    <td>{formatDate(a.created_at)}</td>
                    <td>
                      <strong>{a.title}</strong>
                      <div className="muted" style={{ fontSize: '0.82rem' }}>
                        {a.detail}
                      </div>
                    </td>
                    <td>
                      <span className="badge">{a.channel || a.type}</span>
                    </td>
                    <td>{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
