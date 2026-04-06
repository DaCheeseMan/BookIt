import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { spacesApi, resourcesApi, membersApi, type Space, type Resource, type Member } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';

const RESOURCE_TYPES = ['Court', 'Sauna', 'Meeting room', 'Restaurant', 'Boat', 'Car', 'Gym', 'Pool', 'Other'];
const SLOT_DURATIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: 'Full day (8h)', value: 480 },
];

const FREE_TIER_RESOURCE_LIMIT = 3;

export function TenantSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const auth = useAuth();

  const [space, setSpace] = useState<Space | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit space form
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

  // Member management
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<Member | null>(null);

  const myUserId = auth.user?.profile.sub;

  async function loadData() {
    if (!slug) return;
    try {
      const s = await spacesApi.getById(slug);
      setSpace(s);
      setEditName(s.name);
      setEditDesc(s.description);
      const [res, mems] = await Promise.all([
        resourcesApi.getAll(s.id),
        membersApi.getAll(s.id).catch(() => [] as Member[]),
      ]);
      setResources(res);
      setMembers(mems);
    } catch {
      setError('Space not found or access denied.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && space && space.ownerId !== myUserId) {
      navigate(`/spaces/${slug}`);
    }
  }, [loading, space, myUserId, slug, navigate]);

  async function handleSaveSpace(e: React.FormEvent) {
    e.preventDefault();
    if (!space) return;
    setSavingTenant(true);
    try {
      await spacesApi.update(space.id, { name: editName.trim(), description: editDesc.trim() });
      setTenantSaved(true);
      setTimeout(() => setTenantSaved(false), 3000);
      await loadData();
    } catch {
      setError('Could not save changes.');
    } finally {
      setSavingTenant(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!space) return;
    setRemovingMemberId(userId);
    setConfirmRemoveMember(null);
    try {
      await membersApi.remove(space.id, userId);
      await loadData();
    } catch {
      setError('Could not remove member.');
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function handleAddResource(e: React.FormEvent) {
    e.preventDefault();
    if (!space) return;
    setResError(null);
    setCreatingRes(true);
    try {
      await resourcesApi.create(space.id, {
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
    if (!space) return;
    if (!confirm('Delete this resource? All bookings will be lost.')) return;
    try {
      await resourcesApi.delete(space.id, resourceId);
      await loadData();
    } catch {
      setError('Could not delete resource.');
    }
  }

  if (loading) return <div className="text-center py-12 text-slate-500">Loading settings…</div>;
  if (error || !space) return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">⚠️ {error ?? 'Not found.'}</div>;

  const atResourceLimit = resources.length >= FREE_TIER_RESOURCE_LIMIT;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div>
          <button className="bg-transparent border-none text-indigo-600 cursor-pointer text-sm p-0 mb-2 block hover:underline" onClick={() => navigate(`/spaces/${slug}`)}>← Back to space</button>
          <h1 className="text-2xl font-bold text-slate-900">Settings — {space.name}</h1>
        </div>
      </div>

      {/* Edit space */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-5">
        <h2 className="text-lg font-bold text-slate-800 mb-5">Space details</h2>
        <form className="flex flex-col" onSubmit={handleSaveSpace} noValidate>
          {tenantSaved && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm mb-4">✅ Saved!</div>}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="edit-name">Name</label>
            <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" id="edit-name" type="text" value={editName} onChange={e => setEditName(e.target.value)} required />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="edit-desc">Description</label>
            <textarea className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" id="edit-desc" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} />
          </div>
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]" disabled={savingTenant || !editName.trim()}>
            {savingTenant ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      {/* Resources */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-5">
        <div className="flex items-center justify-between gap-4 mb-5 flex-wrap max-md:flex-col max-md:items-start">
          <h2 className="text-lg font-bold text-slate-800">Resources ({resources.length}/3)</h2>
          {!showAddResource && (
            <div className="flex flex-col items-end gap-1 max-md:items-start max-md:w-full">
              {atResourceLimit && (
                <p className="text-xs text-amber-600 font-medium">Free tier allows up to 3 resources.</p>
              )}
              <button
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3.5 py-1.5 text-sm min-h-[36px] rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed max-md:w-full"
                onClick={() => setShowAddResource(true)}
                disabled={atResourceLimit}
              >
                + Add resource
              </button>
            </div>
          )}
        </div>

        {showAddResource && (
          <form className="flex flex-col" onSubmit={handleAddResource} noValidate>
            <h3 className="text-base font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-200">Add resource</h3>
            {resError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">⚠️ {resError}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name <span className="text-red-500">*</span></label>
                <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" type="text" value={resName} onChange={e => setResName(e.target.value)} placeholder="e.g. Court A" required autoFocus />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Type <span className="text-red-500">*</span></label>
                <select className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" value={resType} onChange={e => setResType(e.target.value)}>
                  {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
              <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" type="text" value={resDesc} onChange={e => setResDesc(e.target.value)} placeholder="Optional description" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Slot duration</label>
                <select className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" value={resSlot} onChange={e => setResSlot(Number(e.target.value))}>
                  {SLOT_DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Max advance days</label>
                <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" type="number" value={resMaxDays} onChange={e => setResMaxDays(Number(e.target.value))} min={1} max={365} />
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-5 max-md:flex-col">
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] max-md:w-full" disabled={creatingRes || !resName.trim()}>
                {creatingRes ? 'Creating…' : 'Add resource'}
              </button>
              <button type="button" className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-5 py-2.5 rounded-xl border border-slate-200 transition-colors cursor-pointer min-h-[44px] max-md:w-full" onClick={() => { setShowAddResource(false); setResError(null); }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {resources.length === 0 ? (
          <p className="text-sm text-slate-400">No resources yet. Add one above.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {resources.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex-wrap max-md:flex-col max-md:items-start">
                <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                  <strong className="text-sm font-semibold text-indigo-600">{r.name}</strong>
                  <span className="bg-indigo-100 text-indigo-700 rounded-full px-3 py-0.5 text-xs font-semibold">{r.resourceType}</span>
                  <span className="text-xs text-slate-400">{r.slotDurationMinutes}min · {r.maxAdvanceDays}d advance</span>
                </div>
                <button
                  className="bg-red-50 hover:bg-red-100 text-red-700 font-semibold px-3.5 py-1.5 text-sm min-h-[36px] rounded-xl border border-red-200 transition-colors cursor-pointer max-md:w-full"
                  onClick={() => handleDeleteResource(r.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Members */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-5">
        <h2 className="text-lg font-bold text-slate-800 mb-5">Members ({members.length})</h2>

        {members.length === 0 ? (
          <p className="text-sm text-slate-400">No members yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {members.map(m => {
              const displayName = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || m.userId;
              return (
                <div key={m.userId} className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex-wrap max-md:flex-col max-md:items-start">
                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">
                      {(m.firstName?.[0] ?? m.email?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
                      {m.email && m.email !== displayName && <p className="text-xs text-slate-400 truncate">{m.email}</p>}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.role === 'Admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                      {m.role}
                    </span>
                  </div>
                  <button
                    className="bg-red-50 hover:bg-red-100 text-red-700 font-semibold px-3.5 py-1.5 text-sm min-h-[36px] rounded-xl border border-red-200 transition-colors cursor-pointer disabled:opacity-50 max-md:w-full"
                    disabled={removingMemberId === m.userId}
                    onClick={() => setConfirmRemoveMember(m)}
                  >
                    {removingMemberId === m.userId ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {confirmRemoveMember && (
        <ConfirmDialog
          title="Remove member?"
          confirmLabel="Remove"
          cancelLabel="Keep member"
          onConfirm={() => handleRemoveMember(confirmRemoveMember.userId)}
          onCancel={() => setConfirmRemoveMember(null)}
        >
          <div className="grid gap-x-4 gap-y-1.5" style={{ gridTemplateColumns: 'auto 1fr' }}>
            <span className="font-semibold text-slate-500 text-sm whitespace-nowrap">Name</span>
            <span className="text-slate-900 text-sm">
              {[confirmRemoveMember.firstName, confirmRemoveMember.lastName].filter(Boolean).join(' ') || '–'}
            </span>
            <span className="font-semibold text-slate-500 text-sm whitespace-nowrap">Email</span>
            <span className="text-slate-900 text-sm">{confirmRemoveMember.email || '–'}</span>
            <span className="font-semibold text-slate-500 text-sm whitespace-nowrap">Role</span>
            <span className="text-slate-900 text-sm">{confirmRemoveMember.role}</span>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
