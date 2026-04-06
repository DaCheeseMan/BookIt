import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { spacesApi, meApi, type Space, type TierInfo } from '../api/client';

const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  free:       { label: 'Free',       cls: 'bg-slate-100 text-slate-600' },
  pro:        { label: 'Pro',        cls: 'bg-indigo-100 text-indigo-700' },
  enterprise: { label: 'Enterprise', cls: 'bg-amber-100 text-amber-700' },
};

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function SpacesPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const myUserId = auth.user?.profile.sub;
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [newVisibility, setNewVisibility] = useState<'Public' | 'Private'>('Public');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const mySpaces = spaces.filter(s => s.ownerId === myUserId);
  const maxSpaces = tierInfo?.limits.maxSpaces ?? (tierInfo?.tier === 'enterprise' ? Infinity : 1);
  const atSpaceLimit = maxSpaces !== Infinity && mySpaces.length >= maxSpaces;

  useEffect(() => {
    Promise.all([
      spacesApi.getAll(),
      meApi.getTier().catch(() => null),
    ])
      .then(([s, t]) => { setSpaces(s); setTierInfo(t); })
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
      const space = await spacesApi.create({ name: name.trim(), slug: slug.trim(), description: description.trim() || undefined, visibility: newVisibility });
      navigate(`/spaces/${space.slug}/settings`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: string | { title?: string } } };
      const data = axiosErr?.response?.data;
      const msg = typeof data === 'string' ? data : data?.title;
      setFormError(msg ?? 'Could not create space.');
      setCreating(false);
    }
  }

  if (loading) return <div className="flex justify-center items-center h-48 text-slate-500 text-lg">Loading spaces…</div>;

  const tier = tierInfo?.tier ?? 'free';
  const badge = TIER_BADGE[tier];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8 max-md:flex-col">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-3xl font-bold text-slate-900">Spaces</h1>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
          </div>
          <p className="text-slate-500 mt-1">Browse existing spaces or create your own.</p>
        </div>
        {!showForm && !atSpaceLimit && (
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] max-md:w-full" onClick={() => setShowForm(true)}>
            + Create a space
          </button>
        )}
        {!showForm && atSpaceLimit && mySpaces.length === 1 && (
          <button
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer min-h-[44px] max-md:w-full"
            onClick={() => navigate(`/spaces/${mySpaces[0].slug}/settings`)}
          >
            Manage your space
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">⚠️ {error}</div>}

      {/* Tier info banner */}
      {tier === 'free' && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 mb-6 flex gap-3 items-start">
          <span className="text-indigo-500 text-lg shrink-0">ℹ️</span>
          <div className="text-sm text-indigo-700">
            <strong>Free plan:</strong> 1 public space · up to 3 resources. 
            {' '}<button className="underline font-semibold cursor-pointer bg-transparent border-none text-indigo-700 p-0" onClick={() => navigate('/upgrade')}>Upgrade to Pro</button> for 5 spaces, 100 resources, private spaces &amp; invitations.
          </div>
        </div>
      )}
      {tier === 'pro' && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 mb-6 flex gap-3 items-start">
          <span className="text-indigo-500 text-lg shrink-0">✨</span>
          <div className="text-sm text-indigo-700">
            <strong>Pro plan:</strong> {mySpaces.length}/{maxSpaces === Infinity ? '∞' : maxSpaces} spaces used · up to 100 resources each · public &amp; private spaces · invitations.
          </div>
        </div>
      )}

      {/* Upgrade nudge when at space limit (free only) */}
      {atSpaceLimit && tier === 'free' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 flex gap-3 items-start">
          <span className="text-amber-500 text-lg shrink-0">🔒</span>
          <div className="text-sm text-amber-800">
            You've reached the Free plan limit of 1 space.{' '}
            <button className="underline font-semibold cursor-pointer bg-transparent border-none text-amber-800 p-0" onClick={() => navigate('/upgrade')}>Upgrade to Pro</button> to create up to 5 spaces.
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6">
          <form onSubmit={handleCreate} noValidate>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Create a new space</h2>
            <p className="text-sm text-slate-500 mb-6">Set up a bookable space for your organisation.</p>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">⚠️ {formError}</div>}
            <div className="mb-5">
              <label htmlFor="space-name" className="block text-sm font-semibold text-slate-700 mb-1.5">Name <span className="text-red-500">*</span></label>
              <input
                id="space-name"
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
              <label htmlFor="space-slug" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Slug <span className="text-red-500">*</span>
                <span className="text-xs text-slate-400"> — used in the URL, e.g. beachside-tennis</span>
              </label>
              <input
                id="space-slug"
                type="text"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit]"
                value={slug}
                onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
                placeholder="beachside-tennis"
                required
              />
            </div>
            <div className="mb-5">
              <label htmlFor="space-desc" className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
              <textarea
                id="space-desc"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit]"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="A short description of your space (optional)"
                rows={3}
              />
            </div>
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Visibility</label>
              {tier !== 'free' ? (
                <div className="flex gap-3">
                  {(['Public', 'Private'] as const).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setNewVisibility(v)}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors min-h-[44px] cursor-pointer ${
                        newVisibility === v
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      {v === 'Public' ? '🌐 Public' : '🔒 Private'}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-500">🌐 Public only on Free plan.</span>
                  <button type="button" className="text-xs text-indigo-600 underline cursor-pointer bg-transparent border-none p-0 ml-auto" onClick={() => navigate('/upgrade')}>Upgrade →</button>
                </div>
              )}
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

      {spaces.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📅</div>
          <h3 className="text-xl font-semibold text-slate-700 mb-2">No spaces yet</h3>
          <p className="text-slate-500">Create the first bookable space above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {spaces.map(s => {
            const isOwner = s.ownerId === myUserId;
            return (
              <div
                key={s.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 flex flex-col gap-3 transition-all hover:shadow-md hover:border-indigo-200"
              >
                <div
                  className="flex gap-4 items-start cursor-pointer outline-none focus:ring-2 focus:ring-indigo-600 rounded-xl"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/spaces/${s.slug}`)}
                  onKeyDown={e => e.key === 'Enter' && navigate(`/spaces/${s.slug}`)}
                >
                  <div className="text-3xl shrink-0">📅</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-base font-bold text-slate-900 truncate">{s.name}</h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.visibility === 'Private' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                        {s.visibility === 'Private' ? '🔒 Private' : '🌐 Public'}
                      </span>
                      {isOwner && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Your space</span>}
                    </div>
                    {s.description && <p className="text-sm text-slate-500 leading-snug mb-1">{s.description}</p>}
                    <span className="text-xs text-slate-400 font-mono">/{s.slug}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

