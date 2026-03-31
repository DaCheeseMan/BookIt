import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { tenantsApi, resourcesApi, membersApi, type Tenant, type Resource } from '../api/client';

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
  const [forbidden, setForbidden] = useState(false);
  const [isMember, setIsMember] = useState(false);

  const myUserId = auth.user?.profile.sub;
  const isOwner = tenant?.ownerId === myUserId;

  useEffect(() => {
    if (!slug) return;
    setForbidden(false);
    tenantsApi.getById(slug)
      .then(async (t) => {
        setTenant(t);
        try {
          const res = await resourcesApi.getAll(t.id);
          setResources(res);
          setIsMember(true);
        } catch (err: unknown) {
          const axiosErr = err as { response?: { status?: number } };
          if (axiosErr?.response?.status === 403) {
            setForbidden(true);
          } else {
            setError('Could not load resources.');
          }
        }
      })
      .catch(() => setError('Space not found.'))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleLeave() {
    if (!tenant || !confirm('Leave this space?')) return;
    try {
      await membersApi.leave(tenant.id);
      navigate('/tenants');
    } catch {
      setError('Could not leave this space.');
    }
  }

  if (loading) return <div className="flex justify-center items-center h-48 text-slate-500 text-lg">Loading space…</div>;
  if (error || !tenant) return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">⚠️ {error ?? 'Space not found.'}</div>;

  if (forbidden) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{tenant?.name ?? 'Private space'}</h2>
        <p className="text-slate-500 mb-4">This is a private space. You need to be a member to view and book resources.</p>
        <p className="text-slate-400 text-sm mb-6">Contact the space owner to request access.</p>
        <button
          className="text-indigo-600 hover:underline text-sm font-semibold"
          onClick={() => navigate('/tenants')}
        >
          ← Back to spaces
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8 max-md:flex-col">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-3xl font-bold text-slate-900">{tenant.name}</h1>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tenant.visibility === 'Private' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {tenant.visibility === 'Private' ? '🔒 Private' : '🌐 Public'}
            </span>
          </div>
          {tenant.description && <p className="text-slate-500 mt-1">{tenant.description}</p>}
        </div>
        <div className="flex gap-2 flex-wrap max-md:w-full">
          {isOwner && (
            <button className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-5 py-2.5 rounded-xl border border-slate-200 transition-colors cursor-pointer min-h-[44px] max-md:w-full" onClick={() => navigate(`/tenants/${slug}/settings`)}>
              ⚙️ Settings
            </button>
          )}
          {!isOwner && isMember && (
            <button className="bg-white hover:bg-red-50 text-red-600 font-semibold px-4 py-2.5 rounded-xl border border-red-200 transition-colors cursor-pointer min-h-[44px] text-sm max-md:w-full" onClick={handleLeave}>
              Leave space
            </button>
          )}
        </div>
      </div>

      {resources.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-slate-700 mb-2">No resources yet</h3>
          {isOwner ? (
            <p className="text-slate-500">
              Add resources in{' '}
              <button className="bg-transparent border-none text-indigo-600 cursor-pointer text-[inherit] underline p-0" onClick={() => navigate(`/tenants/${slug}/settings`)}>settings</button>.
            </p>
          ) : (
            <p className="text-slate-500">This space has no bookable resources yet.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {resources.map(r => (
            <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 flex gap-5 items-center transition-all hover:shadow-md max-md:flex-col max-md:items-start">
              <div className="text-4xl shrink-0">{getTypeIcon(r.resourceType)}</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900 mb-1">{r.name}</h3>
                <span className="inline-block bg-indigo-100 text-indigo-700 rounded-full px-3 py-0.5 text-xs font-semibold capitalize mb-1">{r.resourceType}</span>
                {r.description && <p className="text-sm text-slate-500 leading-relaxed">{r.description}</p>}
                <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
                  <span>⏱ {r.slotDurationMinutes}min slots</span>
                  <span>📅 Book up to {r.maxAdvanceDays} days ahead</span>
                </div>
              </div>
              <button
                className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] max-md:w-full"
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
