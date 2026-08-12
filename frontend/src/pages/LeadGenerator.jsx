import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';

const DEFAULT_META = {
  cities: [],
  zonesByCity: {},
  specialties: [],
  platforms: [],
};

export default function LeadGenerator() {
  const toast = useToast();
  const [meta, setMeta] = useState(DEFAULT_META);
  const [criteria, setCriteria] = useState({
    city: 'Bangalore',
    zone: 'Indiranagar',
    specialty: 'Dentist',
  });
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [scannedSources, setScannedSources] = useState([]);
  const [selected, setSelected] = useState({});
  const [busy, setBusy] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [practoFilter, setPractoFilter] = useState('all');

  const zones = useMemo(
    () => meta.zonesByCity[criteria.city] || [],
    [meta.zonesByCity, criteria.city]
  );

  useEffect(() => {
    api
      .getLeadGeneratorMeta()
      .then((data) => {
        setMeta(data);
        const city = data.cities.includes('Bangalore') ? 'Bangalore' : data.cities[0];
        const zoneList = data.zonesByCity[city] || [];
        setCriteria((c) => ({
          ...c,
          city: city || c.city,
          zone: zoneList[0] || c.zone,
          specialty: data.specialties.includes('Dentist') ? 'Dentist' : data.specialties[0] || c.specialty,
        }));
      })
      .catch((e) => toast(e.message));
  }, []);

  const runDiscovery = useCallback(
    async (nextCriteria = criteria) => {
      if (!nextCriteria.city || !nextCriteria.zone || !nextCriteria.specialty) return;
      setBusy(true);
      setScanStep('Scanning Google Maps, Practo, Justdial, Lybrate…');
      try {
        // Brief staged feedback so the multi-platform scan feels intentional
        await new Promise((r) => setTimeout(r, 350));
        setScanStep('Enriching owner & marketing contacts…');
        const data = await api.searchLeads(nextCriteria);
        setScanStep('Checking Practo profiles & platform listings…');
        await new Promise((r) => setTimeout(r, 200));
        setResults(data.results || []);
        setSummary(data.summary || null);
        setScannedSources(data.scannedSources || []);
        setSelected({});
        toast(`Found ${data.count} ${nextCriteria.specialty} clinics in ${nextCriteria.zone}, ${nextCriteria.city}`);
      } catch (err) {
        toast(err.message);
      } finally {
        setBusy(false);
        setScanStep('');
      }
    },
    [criteria, toast]
  );

  // Auto-discover whenever city + zone + specialty are all set
  useEffect(() => {
    if (!criteria.city || !criteria.zone || !criteria.specialty) return undefined;
    const t = setTimeout(() => {
      runDiscovery(criteria);
    }, 180);
    return () => clearTimeout(t);
  }, [criteria.city, criteria.zone, criteria.specialty]);

  function updateCity(city) {
    const zoneList = meta.zonesByCity[city] || [];
    setCriteria({ city, zone: zoneList[0] || '', specialty: criteria.specialty });
  }

  function toggle(id) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function toggleAll(visible) {
    if (visible.every((r) => selected[r.id])) {
      setSelected({});
      return;
    }
    const next = { ...selected };
    visible.forEach((r) => {
      next[r.id] = true;
    });
    setSelected(next);
  }

  async function importSelected() {
    const leads = results.filter((r) => selected[r.id]);
    if (!leads.length) {
      toast('Select at least one clinic');
      return;
    }
    setBusy(true);
    try {
      const data = await api.importLeads(leads);
      toast(`Imported ${data.imported} clinics into Lead Management`);
      setSelected({});
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  }

  const visible = results.filter((r) => {
    if (practoFilter === 'yes') return r.practo?.hasProfile;
    if (practoFilter === 'no') return !r.practo?.hasProfile;
    return true;
  });

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Lead Generator</h1>
          <p>
            Pick a city, zone, and specialty — we scan search engines and listing platforms for clinics,
            owner contacts, marketing heads, Practo presence, and associated platforms.
          </p>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => runDiscovery(criteria)}
          >
            Rescan platforms
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

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h2>Discovery filters</h2>
        <div className="form-grid three">
          <label className="field">
            City
            <select value={criteria.city} onChange={(e) => updateCity(e.target.value)}>
              {meta.cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Zone
            <select
              value={criteria.zone}
              onChange={(e) => setCriteria({ ...criteria, zone: e.target.value })}
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Specialty
            <select
              value={criteria.specialty}
              onChange={(e) => setCriteria({ ...criteria, specialty: e.target.value })}
            >
              {meta.specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="source-scan" style={{ marginTop: '1rem' }}>
          <div className="muted" style={{ marginBottom: 8, fontSize: '0.85rem' }}>
            {busy && scanStep
              ? scanStep
              : `Platforms scanned: ${(scannedSources.length ? scannedSources : meta.platforms).map((p) => p.name || p).join(' · ')}`}
          </div>
          {summary ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-teal">{summary.total} clinics found</span>
              <span className="badge badge-green">Practo: {summary.withPractoProfile}</span>
              <span className="badge badge-coral">No Practo: {summary.withoutPractoProfile}</span>
              <span className="badge badge-blue">{summary.platformsCovered} platforms</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <strong style={{ marginRight: 8 }}>{visible.length} clinics</strong>
          <select value={practoFilter} onChange={(e) => setPractoFilter(e.target.value)}>
            <option value="all">All Practo statuses</option>
            <option value="yes">Has Practo profile</option>
            <option value="no">No Practo profile</option>
          </select>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => toggleAll(visible)}
            disabled={!visible.length}
          >
            Select all visible
          </button>
        </div>

        {busy && !results.length ? (
          <div className="empty">{scanStep || 'Discovering clinics across platforms…'}</div>
        ) : !visible.length ? (
          <div className="empty">No clinics matched these filters. Try another zone or specialty.</div>
        ) : (
          <div className="table-wrap discovery-table">
            <table className="data">
              <thead>
                <tr>
                  <th />
                  <th>Clinic</th>
                  <th>Clinic owner & contact</th>
                  <th>Marketing head details</th>
                  <th>Practo profile</th>
                  <th>Platforms associated</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!selected[r.id]}
                        onChange={() => toggle(r.id)}
                        aria-label={`Select ${r.clinicName}`}
                      />
                    </td>
                    <td>
                      <strong>{r.clinicName}</strong>
                      <div className="muted" style={{ fontSize: '0.82rem' }}>
                        {r.specialty} · {r.zone}, {r.city}
                      </div>
                      <div className="muted" style={{ fontSize: '0.78rem' }}>
                        {r.address}
                      </div>
                    </td>
                    <td>
                      <strong>{r.owner?.name}</strong>
                      <div className="muted" style={{ fontSize: '0.82rem' }}>
                        {r.owner?.title}
                      </div>
                      <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                        <div>{r.owner?.phone}</div>
                        <div>{r.owner?.email}</div>
                      </div>
                    </td>
                    <td>
                      {r.marketingHead ? (
                        <>
                          <strong>{r.marketingHead.name}</strong>
                          <div className="muted" style={{ fontSize: '0.82rem' }}>
                            {r.marketingHead.title}
                          </div>
                          <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                            <div>{r.marketingHead.phone}</div>
                            <div>{r.marketingHead.email}</div>
                          </div>
                        </>
                      ) : (
                        <span className="muted">Not listed on public platforms</span>
                      )}
                    </td>
                    <td>
                      {r.practo?.hasProfile ? (
                        <>
                          <span className="badge badge-green">Yes</span>
                          {r.practo.rating ? (
                            <div className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
                              Rating {r.practo.rating}
                            </div>
                          ) : null}
                          {r.practo.url ? (
                            <a
                              href={r.practo.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-block', marginTop: 6, color: 'var(--teal-deep)', fontWeight: 600, fontSize: '0.82rem' }}
                            >
                              Open Practo →
                            </a>
                          ) : null}
                        </>
                      ) : (
                        <span className="badge badge-coral">No</span>
                      )}
                    </td>
                    <td>
                      <div className="platform-tags">
                        {(r.platformNames || []).map((p) => (
                          <span key={p} className="badge badge-blue">
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
