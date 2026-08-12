import { useAuth } from '../hooks/useAuth';

export default function CommercialSuite() {
  const { can } = useAuth();

  if (!can('commercial_suite:read') && !can('*')) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <p className="eyebrow">Commercial</p>
            <h1>Commercial Suite</h1>
          </div>
        </div>
        <div className="panel">
          <p className="muted">You do not have permission to open the Commercial Suite.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page commercial-suite-page">
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <p className="eyebrow">Proposals</p>
          <h1>Commercial Suite</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Prime · Reach · Video proposals with live Google Sheet inventory (auto-synced).
          </p>
        </div>
      </div>
      <iframe
        title="Practo Enterprise Commercial Suite"
        src="/commercial-suite.html?embed=1"
        className="commercial-suite-frame"
        allow="clipboard-write"
      />
    </div>
  );
}
