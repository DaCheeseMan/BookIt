import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tenantsApi, type Tenant } from '../api/client';
import './TenantsPage.css';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function TenantsPage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    tenantsApi.getAll()
      .then(setTenants)
      .catch(() => setError('Could not load spaces.'))
      .finally(() => setLoading(false));
  }, []);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited) setSlug(toSlug(value));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !slug.trim()) {
      setFormError('Name and slug are required.');
      return;
    }
    setCreating(true);
    try {
      const tenant = await tenantsApi.create({ name: name.trim(), slug: slug.trim(), description: description.trim() || undefined });
      navigate(`/tenants/${tenant.slug}/settings`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: string | { title?: string } } };
      const data = axiosErr?.response?.data;
      const msg = typeof data === 'string' ? data : data?.title;
      setFormError(msg ?? 'Could not create space.');
      setCreating(false);
    }
  }

  if (loading) return <div className="loading">Loading spaces…</div>;

  return (
    <div className="tenants-page">
      <div className="page-header">
        <div>
          <h1>Spaces</h1>
          <p>Browse existing spaces or create your own.</p>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Create your space
          </button>
        )}
      </div>

      {error && <div className="error-banner">⚠️ {error}</div>}

      {showForm && (
        <div className="create-form-container">
          <form className="create-tenant-form" onSubmit={handleCreate} noValidate>
            <h2>Create a new space</h2>
            {formError && <div className="error-banner">⚠️ {formError}</div>}
            <div className="form-group">
              <label htmlFor="tenant-name">Name <span className="required">*</span></label>
              <input
                id="tenant-name"
                type="text"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="e.g. Beachside Tennis Club"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="tenant-slug">
                Slug <span className="required">*</span>
                <span className="field-hint"> — used in the URL, e.g. beachside-tennis</span>
              </label>
              <input
                id="tenant-slug"
                type="text"
                value={slug}
                onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
                placeholder="beachside-tennis"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="tenant-desc">Description</label>
              <textarea
                id="tenant-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="A short description of your space (optional)"
                rows={3}
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={creating || !name.trim() || !slug.trim()}>
                {creating ? 'Creating…' : 'Create space'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setFormError(null); }} disabled={creating}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {tenants.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h3>No spaces yet</h3>
          <p>Create the first bookable space above.</p>
        </div>
      ) : (
        <div className="tenants-grid">
          {tenants.map(t => (
            <div
              key={t.id}
              className="tenant-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/tenants/${t.slug}`)}
              onKeyDown={e => e.key === 'Enter' && navigate(`/tenants/${t.slug}`)}
            >
              <div className="tenant-card-icon">📅</div>
              <div className="tenant-card-body">
                <h3>{t.name}</h3>
                {t.description && <p className="tenant-card-desc">{t.description}</p>}
                <span className="tenant-card-slug">/{t.slug}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
