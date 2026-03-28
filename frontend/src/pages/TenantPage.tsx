import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { tenantsApi, resourcesApi, type Tenant, type Resource } from '../api/client';
import './TenantPage.css';

const RESOURCE_TYPE_ICONS: Record<string, string> = {
  court: '🏓', tennis: '🎾', padel: '🏓', sauna: '🧖', spa: '💆',
  restaurant: '🍽️', dining: '🍽️', boat: '⛵', dock: '⚓',
  car: '🚗', vehicle: '🚘', meeting: '🏢', conference: '🖥️',
  gym: '🏋️', pool: '🏊', default: '📅',
};

function getTypeIcon(resourceType: string): string {
  const key = resourceType.toLowerCase();
  for (const [k, v] of Object.entries(RESOURCE_TYPE_ICONS)) {
    if (key.includes(k)) return v;
  }
  return RESOURCE_TYPE_ICONS.default;
}

export function TenantPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const auth = useAuth();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const myUserId = auth.user?.profile.sub;
  const isOwner = tenant?.ownerId === myUserId;

  useEffect(() => {
    if (!slug) return;
    tenantsApi.getById(slug)
      .then(async (t) => {
        setTenant(t);
        const res = await resourcesApi.getAll(t.id);
        setResources(res);
      })
      .catch(() => setError('Space not found.'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="loading">Loading space…</div>;
  if (error || !tenant) return <div className="error-banner">⚠️ {error ?? 'Space not found.'}</div>;

  return (
    <div className="tenant-page">
      <div className="tenant-header">
        <div>
          <h1>{tenant.name}</h1>
          {tenant.description && <p className="tenant-desc">{tenant.description}</p>}
        </div>
        {isOwner && (
          <button className="btn btn-secondary" onClick={() => navigate(`/tenants/${slug}/settings`)}>
            ⚙️ Settings
          </button>
        )}
      </div>

      {resources.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No resources yet</h3>
          {isOwner ? (
            <p>
              Add resources in{' '}
              <button className="link-btn" onClick={() => navigate(`/tenants/${slug}/settings`)}>settings</button>.
            </p>
          ) : (
            <p>This space has no bookable resources yet.</p>
          )}
        </div>
      ) : (
        <div className="resources-grid">
          {resources.map(r => (
            <div key={r.id} className="resource-card">
              <div className="resource-card-icon">{getTypeIcon(r.resourceType)}</div>
              <div className="resource-card-body">
                <h3>{r.name}</h3>
                <span className="resource-type-badge">{r.resourceType}</span>
                {r.description && <p className="resource-card-desc">{r.description}</p>}
                <div className="resource-meta">
                  <span>⏱ {r.slotDurationMinutes}min slots</span>
                  <span>📅 Book up to {r.maxAdvanceDays} days ahead</span>
                </div>
              </div>
              <button
                className="btn btn-primary book-btn"
                onClick={() => navigate(`/tenants/${slug}/resources/${r.id}`)}
              >
                Book now
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
