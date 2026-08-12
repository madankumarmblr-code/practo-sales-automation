import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';

const DEFAULT_META = {
  cities: [],
  zonesByCity: {},
  zoneMetaByCity: {},
  keywordsByCity: {},
  keywordsByCityZone: {},
  keywords: [],
  specialties: [],
  platforms: [],
};

const PAGE_SIZE = 50;

export default function LeadGenerator() {
  const toast = useToast();
  const [meta, setMeta] = useState(DEFAULT_META);
  const [criteria, setCriteria] = useState({
    city: '',
    zone: 'All',
    keyword: '',
  });
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [scannedSources, setScannedSources] = useState([]);
  const [selected, setSelected] = useState({});
  const [busy, setBusy] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [practoFilter, setPractoFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [ready, setReady] = useState(false);

  const zoneMeta = meta.zoneMetaByCity[criteria.city] || {};

  const zones = useMemo(() => {
    const list = meta.zonesByCity[criteria.city] || [];
    if (!criteria.keyword) return list;
    return list.filter((z) =>
      (meta.keywordsByCityZone[`${criteria.city}||${z}`] || []).includes(criteria.keyword)
    );
  }, [meta, criteria.city, criteria.keyword]);

  const keywords = useMemo(() => {
    if (!criteria.city) return meta.keywords || meta.specialties || [];
    if (criteria.zone && criteria.zone !== 'All') {
      return meta.keywordsByCityZone[`${criteria.city}||${criteria.zone}`] || [];
    }
    return meta.keywordsByCity[criteria.city] || meta.keywords || [];
  }, [meta, criteria.city, criteria.zone]);

  useEffect(() => {
    api
      .getLeadGeneratorMeta()
      .then((data) => {
        setMeta(data);
        const city = data.cities.includes('Bangalore')
          ? 'Bangalore'
          : data.cities[0] || '';
        const cityKeywords = data.keywordsByCity?.[city] || data.keywords || data.specialties || [];
        const keyword = cityKeywords.includes('General Dentistry')
          ? 'General Dentistry'
          : cityKeywords[0] || '';
        setCriteria({ city, zone: 'All', keyword });
        setReady(true);
      })
      .catch((e) => toast(e.message));
  }, []);

  const runDiscovery = useCallback(
    async (nextCriteria = criteria) => {
      if (!nextCriteria.city || !nextCriteria.keyword) return;
      setBusy(true);
      setScanStep('Matching city / zone / keyword from locations sheet…');
      try {
        await new Promise((r) => setTimeout(r, 180));
        setScanStep(`Pulling full leads for ${nextCriteria.keyword} in selected locations…`);
        const data = await api.searchLeads({
          city: nextCriteria.city,
          zone: nextCriteria.zone || 'All',
          keyword: nextCriteria.keyword,
          specialty: nextCriteria.keyword,
          limit: null,
        });
        setResults(data.results || []);
        setSummary(data.summary || null);
        setScannedSources(data.scannedSources || []);
        setSelected({});
        setPage(1);
        setZoneFilter('all');
        const where =
          nextCriteria.zone === 'All' || nextCriteria.zone === 'All zones'
            ? `all mapped zones in ${nextCriteria.city}`
            : `${nextCriteria.zone}, ${nextCriteria.city}`;
        toast(`Loaded ${data.count} leads for ${nextCriteria.keyword} · ${where}`);
      } catch (err) {
        setResults([]);
        setSummary(null);
        toast(err.message);
      } finally {
        setBusy(false);
        setScanStep('');
      }
    },
    [criteria, toast]
  );

  useEffect(() => {
    if (!ready || !criteria.city || !criteria.keyword) return undefined;
    const t = setTimeout(() => runDiscovery(criteria), 220);
    return () => clearTimeout(t);
  }, [ready, criteria.city, criteria.zone, criteria.keyword]);

  function updateCity(city) {
    const cityKeywords = meta.keywordsByCity[city] || meta.keywords || [];
    const keyword = cityKeywords.includes(criteria.keyword)
      ? criteria.keyword
      : cityKeywords.includes('General Dentistry')
        ? 'General Dentistry'
        : cityKeywords[0] || '';
    setCriteria({ city, zone: 'All', keyword });
  }

  function updateZone(zone) {
    const nextKeywords =
      zone && zone !== 'All'
        ? meta.keywordsByCityZone[`${criteria.city}||${zone}`] || []
        : meta.keywordsByCity[criteria.city] || [];
    const keyword = nextKeywords.includes(criteria.keyword)
      ? criteria.keyword
      : nextKeywords[0] || '';
    setCriteria({ ...criteria, zone, keyword });
  }

  function toggle(id) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function toggleAll(rows) {
    if (rows.every((r) => selected[r.id])) {
      const next = { ...selected };
      rows.forEach((r) => {
        delete next[r.id];
      });
      setSelected(next);
      return;
    }
    const next = { ...selected };
    rows.forEach((r) => {
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

  const filtered = useMemo(() => {
    return results.filter((r) => {
      if (practoFilter === 'yes' && !r.practo?.hasProfile) return false;
      if (practoFilter === 'no' && r.practo?.hasProfile) return false;
      if (zoneFilter !== 'all' && r.zone !== zoneFilter) return false;
      return true;
    });
  }, [results, practoFilter, zoneFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const resultZones = useMemo(
    () => [...new Set(results.map((r) => r.zone))].sort(),
    [results]
  );

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Lead Generator</h1>
          <p>
            Driven by the locations sheet — pick <strong>City → Zone/Locality → Keyword</strong> to load
            matching clinic leads with owner, marketing head, Practo, and platform details.
          </p>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => runDiscovery(criteria)}
          >
            Rescan
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={importSelected}
            disabled={busy || !selectedCount}
          >
            Import selected ({selectedCount})
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h2>Locations sheet filters</h2>
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
            Zone / locality
            <select value={criteria.zone} onChange={(e) => updateZone(e.target.value)}>
              <option value="All">All mapped zones</option>
              {zones.map((z) => {
                const type = zoneMeta[z]?.type || '';
                return (
                  <option key={z} value={z}>
                    {z}
                    {type ? ` (${type})` : ''}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="field">
            Keyword / specialty
            <select
              value={criteria.keyword}
              onChange={(e) => setCriteria({ ...criteria, keyword: e.target.value })}
            >
              {keywords.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="source-scan" style={{ marginTop: '1rem' }}>
          <div className="muted" style={{ marginBottom: 8, fontSize: '0.85rem' }}>
            {busy && scanStep
              ? scanStep
              : `Sheet source: locations.csv · ${meta.comboCount || meta.catalogSize || '—'} city/zone/keyword mappings · Platforms: ${(
                  scannedSources.length ? scannedSources : meta.platforms || []
                )
                  .map((p) => p.name || p)
                  .join(' · ')}`}
          </div>
          {summary ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-teal">{summary.total} leads loaded</span>
              <span className="badge badge-blue">{summary.zonesCovered || 1} zone(s)</span>
              <span className="badge badge-green">Practo: {summary.withPractoProfile}</span>
              <span className="badge badge-coral">No Practo: {summary.withoutPractoProfile}</span>
            </div>
          ) : null}
          {summary?.perZone ? (
            <div className="muted" style={{ marginTop: 10, fontSize: '0.82rem' }}>
              Per zone:{' '}
              {Object.entries(summary.perZone)
                .slice(0, 12)
                .map(([z, n]) => `${z} (${n})`)
                .join(' · ')}
              {Object.keys(summary.perZone).length > 12 ? ' …' : ''}
            </div>
          ) : null}
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <strong style={{ marginRight: 8 }}>
            {filtered.length} clinics
            {filtered.length !== results.length ? ` (of ${results.length})` : ''}
          </strong>
          <select
            value={zoneFilter}
            onChange={(e) => {
              setZoneFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All result zones</option>
            {resultZones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <select
            value={practoFilter}
            onChange={(e) => {
              setPractoFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Practo statuses</option>
            <option value="yes">Has Practo profile</option>
            <option value="no">No Practo profile</option>
          </select>
          <button type="button" className="btn btn-ghost" onClick={() => toggleAll(pageRows)} disabled={!pageRows.length}>
            Select page
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => toggleAll(filtered)}
            disabled={!filtered.length}
          >
            Select all loaded
          </button>
        </div>

        {busy && !results.length ? (
          <div className="empty">{scanStep || 'Loading sheet-mapped leads…'}</div>
        ) : !filtered.length ? (
          <div className="empty">
            No leads for this city / zone / keyword combination in the locations sheet. Try another
            locality or keyword.
          </div>
        ) : (
          <>
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
                  {pageRows.map((r) => (
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
                          {r.keyword || r.specialty} · {r.zone}, {r.city}
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
                                style={{
                                  display: 'inline-block',
                                  marginTop: 6,
                                  color: 'var(--teal-deep)',
                                  fontWeight: 600,
                                  fontSize: '0.82rem',
                                }}
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

            <div
              className="toolbar"
              style={{ marginTop: '0.85rem', marginBottom: 0, justifyContent: 'space-between' }}
            >
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                Showing {(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, filtered.length)} of{' '}
                {filtered.length}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="muted" style={{ alignSelf: 'center', fontSize: '0.85rem' }}>
                  Page {pageSafe} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
