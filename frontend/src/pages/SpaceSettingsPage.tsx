import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { spacesApi, resourcesApi, membersApi, meApi, invitationsApi, type Space, type Resource, type Member, type TierInfo, type Invitation } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';

const RESOURCE_TYPES = ['Court', 'Sauna', 'Meeting room', 'Restaurant', 'Boat', 'Car', 'Gym', 'Pool', 'Other'];
const SLOT_DURATIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: 'Full day (8h)', value: 480 },
];

const FREE_TIER_RESOURCE_LIMIT = 3; // kept for reference; actual limit comes from API

export function SpaceSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const auth = useAuth();

  const [space, setSpace] = useState<Space | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit space form
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editVisibility, setEditVisibility] = useState<'Public' | 'Private'>('Public');
  const [savingSpace, setSavingTenant] = useState(false);
  const [spaceSaved, setTenantSaved] = useState(false);

  // Add resource form
  const [showAddResource, setShowAddResource] = useState(false);
  const [resName, setResName] = useState('');
  const [resDesc, setResDesc] = useState('');
  const [resType, setResType] = useState('Court');
  const [resSlot, setResSlot] = useState(60);
  const [resMaxDays, setResMaxDays] = useState(30);
  const [creatingRes, setCreatingRes] = useState(false);
  const [resError, setResError] = useState<string | null>(null);

  // Resource deletion
  const [confirmDeleteResource, setConfirmDeleteResource] = useState<Resource | null>(null);

  // Space deletion
  const [confirmDeleteSpace, setConfirmDeleteSpace] = useState(false);
  const [deletingSpace, setDeletingSpace] = useState(false);

  // Member management
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<Member | null>(null);

  // Invitation management
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState<string | null>(null); // the invite link just created
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmRevokeInvite, setConfirmRevokeInvite] = useState<Invitation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const myUserId = auth.user?.profile.sub;

  async function loadData() {
    if (!slug) return;
    try {
      const s = await spacesApi.getById(slug);
      setSpace(s);
      setEditName(s.name);
      setEditDesc(s.description);
      setEditVisibility(s.visibility);
      const [res, mems, t, invs] = await Promise.all([
        resourcesApi.getAll(s.id),
        membersApi.getAll(s.id).catch(() => [] as Member[]),
        meApi.getTier().catch(() => null),
        s.visibility === 'Private' ? invitationsApi.getAll(s.slug).catch(() => [] as Invitation[]) : Promise.resolve([] as Invitation[]),
      ]);
      setResources(res);
      setMembers(mems);
      setTierInfo(t);
      setInvitations(invs);
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

  const [confirmMakePublic, setConfirmMakePublic] = useState(false);

  async function handleSaveSpace(e: React.FormEvent) {
    e.preventDefault();
    if (!space) return;
    // Warn before switching Private → Public (all members will be removed)
    if (space.visibility === 'Private' && editVisibility === 'Public' && !confirmMakePublic) {
      setConfirmMakePublic(true);
      return;
    }
    await doSaveSpace();
  }

  async function doSaveSpace() {
    if (!space) return;
    setConfirmMakePublic(false);
    setSavingTenant(true);
    try {
      await spacesApi.update(space.id, { name: editName.trim(), description: editDesc.trim(), visibility: editVisibility });
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

  async function handleDeleteSpace() {
    if (!space) return;
    setDeletingSpace(true);
    try {
      await spacesApi.delete(space.id);
      navigate('/spaces');
    } catch {
      setError('Could not delete space.');
      setDeletingSpace(false);
    }
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!space || !inviteEmail.trim()) return;
    setSendingInvite(true);
    setInviteError(null);
    setInviteSent(null);
    try {
      const created = await invitationsApi.create(space.slug, [inviteEmail.trim()]);
      const token = created[0]?.token;
      if (token) setInviteSent(`${window.location.origin}/invite/${token}`);
      setInviteEmail('');
      await loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string; title?: string } } };
      const msg = axiosErr?.response?.data?.detail ?? axiosErr?.response?.data?.title ?? 'Could not send invitation.';
      setInviteError(msg);
    } finally {
      setSendingInvite(false);
    }
  }

  async function handleRevokeInvite(invitationId: string) {
    if (!space) return;
    setRevokingId(invitationId);
    setConfirmRevokeInvite(null);
    try {
      await invitationsApi.revoke(space.slug, invitationId);
      await loadData();
    } catch {
      setError('Could not revoke invitation.');
    } finally {
      setRevokingId(null);
    }
  }

  function copyInviteLink(token: string, id: string) {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const resNameTaken = resName.trim().length > 0 &&
    resources.some(r => r.name.toLowerCase() === resName.trim().toLowerCase());

  async function handleAddResource(e: React.FormEvent) {
    e.preventDefault();
    if (!space || resNameTaken) return;
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
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setResError(status === 409
        ? 'A resource with that name already exists in this space.'
        : 'Could not create resource.');
    } finally {
      setCreatingRes(false);
    }
  }

  async function handleDeleteResource(resourceId: number) {
    if (!space) return;
    setConfirmDeleteResource(null);
    try {
      await resourcesApi.delete(space.id, resourceId);
      await loadData();
    } catch {
      setError('Could not delete resource.');
    }
  }

  if (loading) return <div className="text-center py-12 text-slate-500">Loading settings…</div>;
  if (error || !space) return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">⚠️ {error ?? 'Not found.'}</div>;

  const maxResources = tierInfo?.limits.maxResourcesPerSpace ?? FREE_TIER_RESOURCE_LIMIT;
  const atResourceLimit = resources.length >= maxResources;
  const tier = tierInfo?.tier ?? 'free';

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
          {spaceSaved && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm mb-4">✅ Saved!</div>}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="edit-name">Name</label>
            <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" id="edit-name" type="text" value={editName} onChange={e => setEditName(e.target.value)} required />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="edit-desc">Description</label>
            <textarea className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" id="edit-desc" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Visibility</label>
            {tierInfo && tierInfo.tier !== 'free' ? (
              <div className="flex gap-3">
                {(['Public', 'Private'] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setEditVisibility(v)}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors min-h-[44px] cursor-pointer ${
                      editVisibility === v
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
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]" disabled={savingSpace || !editName.trim()}>
            {savingSpace ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      {/* Resources */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-5">
        <div className="flex items-center justify-between gap-4 mb-5 flex-wrap max-md:flex-col max-md:items-start">
          <h2 className="text-lg font-bold text-slate-800">Resources ({resources.length}/{maxResources === Number.MAX_SAFE_INTEGER ? '∞' : maxResources})</h2>
          {!showAddResource && (
            <div className="flex flex-col items-end gap-1 max-md:items-start max-md:w-full">
              {atResourceLimit && tier === 'free' && (
                <p className="text-xs text-amber-600 font-medium">
                  Free plan limit reached.{' '}
                  <button className="underline cursor-pointer bg-transparent border-none text-amber-600 p-0 text-xs" onClick={() => navigate('/upgrade')}>Upgrade</button> for more.
                </p>
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
                <input
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white ${resNameTaken ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                  type="text" value={resName} onChange={e => setResName(e.target.value)}
                  placeholder="e.g. Court A" required autoFocus
                />
                {resNameTaken && <p className="mt-1 text-xs text-red-600">A resource with this name already exists in this space.</p>}
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
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] max-md:w-full" disabled={creatingRes || !resName.trim() || resNameTaken}>
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
                  onClick={() => setConfirmDeleteResource(r)}
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

      {/* Invitations — only for private spaces with pro/enterprise tier */}
      {space.visibility === 'Private' && tier !== 'free' && (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-5">
          <h2 className="text-lg font-bold text-slate-800 mb-5">Invitations</h2>

          {/* Send invite form */}
          <form onSubmit={handleSendInvite} className="flex flex-wrap gap-3 mb-5" noValidate>
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              required
              className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white min-h-[44px]"
            />
            <button
              type="submit"
              disabled={sendingInvite || !inviteEmail.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] max-md:w-full"
            >
              {sendingInvite ? 'Sending…' : 'Send invite'}
            </button>
          </form>

          {inviteError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">⚠️ {inviteError}</div>}

          {inviteSent && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4">
              <p className="text-sm text-emerald-700 font-semibold mb-1.5">✅ Invitation created! Share this link:</p>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-xs bg-white border border-emerald-200 rounded-lg px-3 py-1.5 text-emerald-800 break-all flex-1">{inviteSent}</code>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(inviteSent); }}
                  className="text-xs text-emerald-700 font-semibold underline cursor-pointer bg-transparent border-none p-0 whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Invitation list */}
          {invitations.length === 0 ? (
            <p className="text-sm text-slate-400">No invitations yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {invitations.map(inv => {
                const isPending = inv.status === 'Pending';
                const statusCls = inv.status === 'Accepted' ? 'text-emerald-700' : inv.status === 'Pending' ? 'text-amber-700' : 'text-slate-400';
                return (
                  <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex-wrap max-md:flex-col max-md:items-start">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-semibold text-slate-800 truncate">{inv.email}</span>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-slate-400">{inv.role}</span>
                        <span className={`text-xs font-semibold ${statusCls}`}>{inv.status}</span>
                        {isPending && <span className="text-xs text-slate-400">· expires {new Date(inv.expiresAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 max-md:w-full">
                      {isPending && (
                        <button
                          type="button"
                          onClick={() => copyInviteLink(inv.token, inv.id)}
                          className="bg-white hover:bg-slate-100 text-slate-700 font-semibold px-3.5 py-1.5 text-xs min-h-[36px] rounded-xl border border-slate-200 transition-colors cursor-pointer max-md:flex-1"
                        >
                          {copiedId === inv.id ? '✅ Copied' : '🔗 Copy link'}
                        </button>
                      )}
                      {isPending && (
                        <button
                          type="button"
                          disabled={revokingId === inv.id}
                          onClick={() => setConfirmRevokeInvite(inv)}
                          className="bg-red-50 hover:bg-red-100 text-red-700 font-semibold px-3.5 py-1.5 text-xs min-h-[36px] rounded-xl border border-red-200 transition-colors cursor-pointer disabled:opacity-50 max-md:flex-1"
                        >
                          {revokingId === inv.id ? 'Revoking…' : 'Revoke'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Danger Zone */}
      <section className="bg-white rounded-2xl shadow-sm border border-red-200 p-6 mb-5">
        <h2 className="text-lg font-bold text-red-700 mb-2">Danger zone</h2>
        <p className="text-sm text-slate-500 mb-4">Permanently delete this space, all its resources, bookings, and memberships. This cannot be undone.</p>
        <button
          type="button"
          className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          disabled={deletingSpace}
          onClick={() => setConfirmDeleteSpace(true)}
        >
          {deletingSpace ? 'Deleting…' : 'Delete this space'}
        </button>
      </section>

      {confirmRevokeInvite && (
        <ConfirmDialog
          title="Revoke invitation?"
          confirmLabel="Revoke"
          cancelLabel="Keep"
          onConfirm={() => handleRevokeInvite(confirmRevokeInvite.id)}
          onCancel={() => setConfirmRevokeInvite(null)}
        >
          <p className="text-sm text-slate-600">
            The invitation for <strong>{confirmRevokeInvite.email}</strong> will be invalidated and can no longer be accepted.
          </p>
        </ConfirmDialog>
      )}

      {confirmMakePublic && (
        <ConfirmDialog
          title="Make space public?"
          confirmLabel="Yes, make it public"
          cancelLabel="Keep it private"
          onConfirm={doSaveSpace}
          onCancel={() => setConfirmMakePublic(false)}
        >
          <p className="text-sm text-slate-600">
            Switching to <strong>Public</strong> will <strong>remove all members</strong> from this space and everyone will be able to browse and book its resources. This cannot be undone.
          </p>
        </ConfirmDialog>
      )}

      {confirmDeleteSpace && (
        <ConfirmDialog
          title="Delete space?"
          confirmLabel="Yes, delete it"
          cancelLabel="Keep space"
          onConfirm={handleDeleteSpace}
          onCancel={() => setConfirmDeleteSpace(false)}
        >
          <p className="text-sm text-slate-600">
            <strong>{space.name}</strong> and all its resources, bookings, and memberships will be permanently deleted. This cannot be undone.
          </p>
        </ConfirmDialog>
      )}

      {confirmDeleteResource && (
        <ConfirmDialog
          title="Delete resource?"
          confirmLabel="Delete"
          cancelLabel="Keep resource"
          onConfirm={() => handleDeleteResource(confirmDeleteResource.id)}
          onCancel={() => setConfirmDeleteResource(null)}
        >
          <p className="text-sm text-slate-600">
            <strong>{confirmDeleteResource.name}</strong> and all its bookings will be permanently deleted.
          </p>
        </ConfirmDialog>
      )}

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
