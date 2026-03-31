import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { adminApi, type AdminUser, type AdminCreateUserRequest, type AdminUpdateUserRequest } from '../api/client';

const ALL_ROLES = ['member', 'tenant-admin', 'admin'] as const;
type AppRole = typeof ALL_ROLES[number];

const ROLE_BADGE_CLASSES: Record<string, string> = {
  member: 'inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-indigo-100 text-indigo-700',
  'tenant-admin': 'inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-amber-100 text-amber-700',
  admin: 'inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-indigo-700 text-white',
};

function RoleBadge({ role }: { role: string }) {
  const label = role === 'admin' ? 'Admin' : role === 'tenant-admin' ? 'Tenant Admin' : 'Member';
  return (
    <span className={ROLE_BADGE_CLASSES[role] ?? 'inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-slate-100 text-slate-400'}>{label}</span>
  );
}

interface EditFormProps {
  user: AdminUser;
  onSave: () => void;
  onCancel: () => void;
}

function EditUserForm({ user, onSave, onCancel }: EditFormProps) {
  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber ?? '');
  const [roles, setRoles] = useState<Set<AppRole>>(new Set(user.roles as AppRole[]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(role: AppRole) {
    setRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role); else next.add(role);
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const req: AdminUpdateUserRequest = {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        roles: Array.from(roles),
      };
      await adminApi.updateUser(user.id, req);
      onSave();
    } catch {
      setError('Could not save user.');
      setSaving(false);
    }
  }

  return (
    <form className="mt-5 pt-5 border-t border-slate-200" onSubmit={handleSave} noValidate>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">⚠️ {error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">First name</label>
          <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Last name</label>
          <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
          <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone number</label>
          <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+1 234 567 8900" />
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Roles</label>
        <div className="flex gap-6">
          {ALL_ROLES.map(r => (
            <label key={r} className="flex items-center gap-2 font-normal cursor-pointer text-sm text-slate-700">
              <input className="w-4 h-4 accent-indigo-600 cursor-pointer" type="checkbox" checked={roles.has(r)} onChange={() => toggleRole(r)} />
              {r === 'admin' ? 'Admin' : r === 'tenant-admin' ? 'Tenant Admin' : 'Member'}
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 mt-5 max-md:flex-col">
        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] max-md:w-full" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-5 py-2.5 rounded-xl border border-slate-200 transition-colors cursor-pointer min-h-[44px] max-md:w-full" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}

interface CreateFormProps {
  onCreated: () => void;
  onCancel: () => void;
}

function CreateUserForm({ onCreated, onCancel }: CreateFormProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [roles, setRoles] = useState<Set<AppRole>>(new Set(['member'] as AppRole[]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(role: AppRole) {
    setRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role); else next.add(role);
      return next;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const req: AdminCreateUserRequest = {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        temporaryPassword,
        roles: Array.from(roles),
      };
      await adminApi.createUser(req);
      onCreated();
    } catch {
      setError('Could not create user. Check the email is not already registered.');
      setSaving(false);
    }
  }

  return (
    <form className="flex flex-col" onSubmit={handleCreate} noValidate>
      <h2 className="mb-6 text-lg font-bold text-slate-900">Add new user</h2>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">⚠️ {error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">First name</label>
          <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Last name</label>
          <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email <span className="text-red-500">*</span></label>
          <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" required />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone number</label>
          <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+1 234 567 8900" />
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Temporary password <span className="text-red-500">*</span></label>
        <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-[inherit] bg-white" type="text" value={temporaryPassword} onChange={e => setTemporaryPassword(e.target.value)} placeholder="User will be asked to change on first login" required />
        <span className="text-xs text-slate-400 mt-1">The user will be prompted to set a new password on next login.</span>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Roles</label>
        <div className="flex gap-6">
          {ALL_ROLES.map(r => (
            <label key={r} className="flex items-center gap-2 font-normal cursor-pointer text-sm text-slate-700">
              <input className="w-4 h-4 accent-indigo-600 cursor-pointer" type="checkbox" checked={roles.has(r)} onChange={() => toggleRole(r)} />
              {r === 'admin' ? 'Admin' : r === 'tenant-admin' ? 'Tenant Admin' : 'Member'}
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 mt-5 max-md:flex-col">
        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] max-md:w-full" disabled={saving || !email.trim() || !temporaryPassword.trim()}>
          {saving ? 'Creating…' : 'Create user'}
        </button>
        <button type="button" className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-5 py-2.5 rounded-xl border border-slate-200 transition-colors cursor-pointer min-h-[44px] max-md:w-full" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}

interface UserCardProps {
  user: AdminUser;
  onUpdated: () => void;
}

function UserCard({ user, onUpdated }: UserCardProps) {
  const [editing, setEditing] = useState(false);
  const [success, setSuccess] = useState(false);
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;

  function handleSaved() {
    setEditing(false);
    setSuccess(true);
    onUpdated();
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <div className={`bg-white rounded-2xl p-5 transition-all ${editing ? 'border-[1.5px] border-indigo-600 shadow-lg shadow-indigo-100' : 'border-[1.5px] border-transparent shadow-sm hover:border-indigo-100 hover:shadow-md'}`}>
      <div className="flex items-start justify-between gap-4 max-md:flex-col max-md:gap-3">
        <div>
          <div className="font-semibold text-base text-slate-900 mb-1">{displayName}</div>
          <div className="flex gap-4 flex-wrap mb-2">
            {user.email && <span className="text-sm text-slate-500">{user.email}</span>}
            {user.phoneNumber && <span className="text-sm text-slate-500">{user.phoneNumber}</span>}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {user.roles.length === 0
              ? <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-slate-100 text-slate-400">No role</span>
              : user.roles.map(r => <RoleBadge key={r} role={r} />)
            }
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 max-md:w-full max-md:justify-end">
          {success && <span className="text-sm text-emerald-600">✅ Saved</span>}
          {!editing && (
            <button className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-3.5 py-1.5 text-sm min-h-[36px] rounded-xl border border-slate-200 transition-colors cursor-pointer" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
      </div>
      {editing && <EditUserForm user={user} onSave={handleSaved} onCancel={() => setEditing(false)} />}
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [20, 50, 0] as const;
type RoleFilter = 'all' | 'none' | 'member' | 'tenant-admin' | 'admin';

function matchesRoleFilter(user: AdminUser, filter: RoleFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'none') return user.roles.length === 0;
  return user.roles.includes(filter);
}

function sortUsers(users: AdminUser[]): AdminUser[] {
  return [...users].sort((a, b) => {
    const fa = (a.firstName ?? '').toLowerCase();
    const fb = (b.firstName ?? '').toLowerCase();
    if (fa !== fb) return fa.localeCompare(fb);
    return (a.lastName ?? '').toLowerCase().localeCompare((b.lastName ?? '').toLowerCase());
  });
}

export function AdminUsersPage() {
  const auth = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [pageSize, setPageSize] = useState<number>(20);

  function loadUsers() {
    setLoading(true);
    setError(null);
    adminApi.getUsers()
      .then(setUsers)
      .catch(() => setError('Could not load users.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadUsers(); }, [auth.user?.access_token]);

  const query = search.trim().toLowerCase();
  const filtered = sortUsers(users).filter(u => {
    if (!matchesRoleFilter(u, roleFilter)) return false;
    if (!query) return true;
    return (
      (u.firstName ?? '').toLowerCase().includes(query) ||
      (u.lastName ?? '').toLowerCase().includes(query) ||
      (u.email ?? '').toLowerCase().includes(query) ||
      (u.username ?? '').toLowerCase().includes(query)
    );
  });
  const visible = pageSize === 0 ? filtered : filtered.slice(0, pageSize);

  const ROLE_FILTER_LABELS: Record<RoleFilter, string> = {
    all: 'All', none: 'No role', member: 'Member', 'tenant-admin': 'Tenant Admin', admin: 'Admin',
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap max-md:flex-col max-md:items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User management</h1>
          <p className="text-slate-500 mt-1">Manage users and their roles</p>
        </div>
        {!showCreateForm && (
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]" onClick={() => setShowCreateForm(true)}>
            + Add new user
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-2xl shadow-sm border-2 border-indigo-100 p-6 mb-8">
          <CreateUserForm onCreated={() => { setShowCreateForm(false); loadUsers(); }} onCancel={() => setShowCreateForm(false)} />
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">⚠️ {error}</div>}

      {!loading && (
        <div className="flex flex-wrap items-center gap-3 mb-5 max-md:flex-col max-md:items-stretch">
          <input
            className="flex-1 min-w-0 px-3.5 py-2 border-[1.5px] border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
            type="search"
            placeholder="Search by name, email or username…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'none', 'member', 'tenant-admin', 'admin'] as RoleFilter[]).map(f => (
              <button
                key={f}
                className={`px-3 py-1 rounded-full border-[1.5px] text-sm font-medium cursor-pointer transition-colors whitespace-nowrap ${roleFilter === f ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700' : 'border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300'}`}
                onClick={() => setRoleFilter(f)}
              >
                {ROLE_FILTER_LABELS[f]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-500">Show</span>
            {PAGE_SIZE_OPTIONS.map(n => (
              <button
                key={n}
                className={`px-3 py-1 rounded-full border-[1.5px] text-sm font-medium cursor-pointer transition-colors whitespace-nowrap ${pageSize === n ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700' : 'border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300'}`}
                onClick={() => setPageSize(n)}
              >
                {n === 0 ? 'All' : n}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading users…</div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-slate-400 mb-2">
            Showing {visible.length} of {filtered.length}
            {filtered.length !== users.length ? ` (${users.length} total)` : ' users'}
          </div>
          {visible.map(u => <UserCard key={u.id} user={u} onUpdated={loadUsers} />)}
          {pageSize !== 0 && filtered.length > pageSize && (
            <div className="text-center text-sm text-slate-400 py-3 border-t border-slate-100">
              {filtered.length - pageSize} users hidden — increase the limit or refine search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
