import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tenantsApi, type Tenant } from '../api/client';

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

  if (loading) return <div className="flex justify-center items-center h-48 text-slate-500 text-lg">Loading spaces…</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8 max-md:flex-col">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Spaces</h1>
          <p className="text-slate-500 mt-1">Browse existing spaces or create your own.</p>
        </div>
        {!showForm && (
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] max-md:w-full" onClick={() => setShowForm(true)}>
            + Create your space
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">⚠️ {error}</div>}

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6">
          <form onSubmit={handleCreate} noValidate>
            <h2 className="text-lg font-bold text-slate-900 mb-6">Create a new space</h2>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">⚠️ {formError}</div>}
            <div className="mb-5">
              <label htmlFor="tenant-name" className="block text-sm font-semibold text-slate-700 mb-1.5">Name <span className="text-red-500">*</span></label>
              <input
                id="tenant-name"
                type="text"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit]"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="e.g. Beachside Tennis Club"
                required
                autoFocus
              />
            </div>
            <div className="mb-5">
              <label htmlFor="tenant-slug" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Slug <span className="text-red-500">*</span>
                <span className="text-xs text-slate-400"> — used in the URL, e.g. beachside-tennis</span>
              </label>
              <input
                id="tenant-slug"
                type="text"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit]"
                value={slug}
                onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
                placeholder="beachside-tennis"
                required
              />
            </div>
            <div className="mb-5">
              <label htmlFor="tenant-desc" className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
              <textarea
                id="tenant-desc"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit]"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="A short description of your space (optional)"
                rows={3}
              />
            </div>
            <div className="flex flex-wrap gap-3 mt-6">
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] max-md:w-full" disabled={creating || !name.trim() || !slug.trim()}>
                {creating ? 'Creating…' : 'Create space'}
              </button>
              <button type="button" className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-5 py-2.5 rounded-xl border border-slate-200 transition-colors cursor-pointer min-h-[44px] max-md:w-full" onClick={() => { setShowForm(false); setFormError(null); }} disabled={creating}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {tenants.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📅</div>
          <h3 className="text-xl font-semibold text-slate-700 mb-2">No spaces yet</h3>
          <p className="text-slate-500">Create the first bookable space above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenants.map(t => (
            <div
              key={t.id}
              className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 cursor-pointer flex gap-4 items-start transition-all hover:shadow-md hover:border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-600"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/tenants/${t.slug}`)}
              onKeyDown={e => e.key === 'Enter' && navigate(`/tenants/${t.slug}`)}
            >
              <div className="text-3xl shrink-0">📅</div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 truncate mb-1">{t.name}</h3>
                {t.description && <p className="text-sm text-slate-500 leading-snug mb-1">{t.description}</p>}
                <span className="text-xs text-slate-400 font-mono">/{t.slug}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
