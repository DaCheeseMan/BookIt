import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { tenantsApi, resourcesApi, type Tenant, type Resource } from '../api/client';
import './TenantSettingsPage.css';

const RESOURCE_TYPES = ['Court', 'Sauna', 'Meeting room', 'Restaurant', 'Boat', 'Car', 'Gym', 'Pool', 'Other'];
const SLOT_DURATIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: 'Full day (8h)', value: 480 },
];

export function TenantSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const auth = useAuth();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit tenant form
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingTenant, setSavingTenant] = useState(false);
  const [tenantSaved, setTenantSaved] = useState(false);

  // Add resource form
  const [showAddResource, setShowAddResource] = useState(false);
  const [resName, setResName] = useState('');
  const [resDesc, setResDesc] = useState('');
  const [resType, setResType] = useState('Court');
  const [resSlot, setResSlot] = useState(60);
  const [resMaxDays, setResMaxDays] = useState(30);
  const [creatingRes, setCreatingRes] = useState(false);
  const [resError, setResError] = useState<string | null>(null);

  const myUserId = auth.user?.profile.sub;

  async function loadData() {
    if (!slug) return;
    try {
      const t = await tenantsApi.getById(slug);
      setTenant(t);
      setEditName(t.name);
      setEditDesc(t.description);
      const res = await resourcesApi.getAll(t.id);
      setResources(res);
    } catch {
      setError('Space not found or access denied.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && tenant && tenant.ownerId !== myUserId) {
      navigate(`/tenants/${slug}`);
    }
  }, [loading, tenant, myUserId, slug, navigate]);

  async function handleSaveTenant(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setSavingTenant(true);
    try {
      await tenantsApi.update(tenant.id, { name: editName.trim(), description: editDesc.trim() });
      setTenantSaved(true);
      setTimeout(() => setTenantSaved(false), 3000);
      await loadData();
    } catch {
      setError('Could not save changes.');
    } finally {
      setSavingTenant(false);
    }
  }

  async function handleAddResource(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setResError(null);
    setCreatingRes(true);
    try {
      await resourcesApi.create(tenant.id, {
        name: resName.trim(),
        description: resDesc.trim() || undefined,
        resourceType: resType,
        slotDurationMinutes: resSlot,
        maxAdvanceDays: resMaxDays,
      });
      setResName(''); setResDesc(''); setResType('Court'); setResSlot(60); setResMaxDays(30);
      setShowAddResource(false);
      await loadData();
    } catch {
      setResError('Could not create resource.');
    } finally {
      setCreatingRes(false);
    }
  }

  async function handleDeleteResource(resourceId: number) {
    if (!tenant) return;
    if (!confirm('Delete this resource? All bookings will be lost.')) return;
    try {
      await resourcesApi.delete(tenant.id, resourceId);
      await loadData();
    } catch {
      setError('Could not delete resource.');
    }
  }

  if (loading) return <div className="loading">Loading settings…</div>;
  if (error || !tenant) return <div className="error-banner">⚠️ {error ?? 'Not found.'}</div>;

  return (
    <div className="tenant-settings-page">
      <div className="settings-header">
        <div>
          <button className="back-btn" onClick={() => navigate(`/tenants/${slug}`)}>← Back to space</button>
          <h1>Settings — {tenant.name}</h1>
        </div>
      </div>

      {/* Edit tenant */}
      <section className="settings-section">
        <h2>Space details</h2>
        <form className="settings-form" onSubmit={handleSaveTenant} noValidate>
          {tenantSaved && <div className="success-banner">✅ Saved!</div>}
          <div className="form-group">
            <label htmlFor="edit-name">Name</label>
            <input id="edit-name" type="text" value={editName} onChange={e => setEditName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="edit-desc">Description</label>
            <textarea id="edit-desc" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingTenant || !editName.trim()}>
            {savingTenant ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      {/* Resources */}
      <section className="settings-section">
        <div className="section-header-row">
          <h2>Resources ({resources.length})</h2>
          {!showAddResource && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddResource(true)}>
              + Add resource
            </button>
          )}
        </div>

        {showAddResource && (
          <form className="add-resource-form" onSubmit={handleAddResource} noValidate>
            <h3>Add resource</h3>
            {resError && <div className="error-banner">⚠️ {resError}</div>}
            <div className="form-row">
              <div className="form-group">
                <label>Name <span className="required">*</span></label>
                <input type="text" value={resName} onChange={e => setResName(e.target.value)} placeholder="e.g. Court A" required autoFocus />
              </div>
              <div className="form-group">
                <label>Type <span className="required">*</span></label>
                <select value={resType} onChange={e => setResType(e.target.value)}>
                  {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <input type="text" value={resDesc} onChange={e => setResDesc(e.target.value)} placeholder="Optional description" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Slot duration</label>
                <select value={resSlot} onChange={e => setResSlot(Number(e.target.value))}>
                  {SLOT_DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Max advance days</label>
                <input type="number" value={resMaxDays} onChange={e => setResMaxDays(Number(e.target.value))} min={1} max={365} />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={creatingRes || !resName.trim()}>
                {creatingRes ? 'Creating…' : 'Add resource'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowAddResource(false); setResError(null); }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {resources.length === 0 ? (
          <p className="empty-msg">No resources yet. Add one above.</p>
        ) : (
          <div className="resources-list">
            {resources.map(r => (
              <div key={r.id} className="resource-row">
                <div className="resource-row-info">
                  <strong>{r.name}</strong>
                  <span className="resource-type-tag">{r.resourceType}</span>
                  <span className="resource-meta-tag">{r.slotDurationMinutes}min · {r.maxAdvanceDays}d advance</span>
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteResource(r.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
