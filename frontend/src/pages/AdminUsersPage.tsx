import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { adminApi, type AdminUser, type AdminCreateUserRequest, type AdminUpdateUserRequest } from '../api/client';
import './AdminUsersPage.css';

const ALL_ROLES = ['member', 'tenant-admin', 'admin'] as const;
type AppRole = typeof ALL_ROLES[number];

function RoleBadge({ role }: { role: string }) {
  const label = role === 'admin' ? 'Admin' : role === 'tenant-admin' ? 'Tenant Admin' : 'Member';
  return (
    <span className={`role-badge role-badge--${role}`}>{label}</span>
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
    <form className="user-edit-form" onSubmit={handleSave} noValidate>
      {error && <div className="error-banner">⚠️ {error}</div>}
      <div className="form-row">
        <div className="form-group">
          <label>First name</label>
          <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
        </div>
        <div className="form-group">
          <label>Last name</label>
          <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
        </div>
        <div className="form-group">
          <label>Phone number</label>
          <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+1 234 567 8900" />
        </div>
      </div>
      <div className="form-group">
        <label>Roles</label>
        <div className="role-checkboxes">
          {ALL_ROLES.map(r => (
            <label key={r} className="checkbox-label">
              <input type="checkbox" checked={roles.has(r)} onChange={() => toggleRole(r)} />
              {r === 'admin' ? 'Admin' : r === 'tenant-admin' ? 'Tenant Admin' : 'Member'}
            </label>
          ))}
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
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
    <form className="create-user-form" onSubmit={handleCreate} noValidate>
      <h2>Add new user</h2>
      {error && <div className="error-banner">⚠️ {error}</div>}
      <div className="form-row">
        <div className="form-group">
          <label>First name</label>
          <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
        </div>
        <div className="form-group">
          <label>Last name</label>
          <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Email <span className="required">*</span></label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" required />
        </div>
        <div className="form-group">
          <label>Phone number</label>
          <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+1 234 567 8900" />
        </div>
      </div>
      <div className="form-group">
        <label>Temporary password <span className="required">*</span></label>
        <input type="text" value={temporaryPassword} onChange={e => setTemporaryPassword(e.target.value)} placeholder="User will be asked to change on first login" required />
        <span className="field-hint">The user will be prompted to set a new password on next login.</span>
      </div>
      <div className="form-group">
        <label>Roles</label>
        <div className="role-checkboxes">
          {ALL_ROLES.map(r => (
            <label key={r} className="checkbox-label">
              <input type="checkbox" checked={roles.has(r)} onChange={() => toggleRole(r)} />
              {r === 'admin' ? 'Admin' : r === 'tenant-admin' ? 'Tenant Admin' : 'Member'}
            </label>
          ))}
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || !email.trim() || !temporaryPassword.trim()}>
          {saving ? 'Creating…' : 'Create user'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
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
    <div className={`user-card ${editing ? 'user-card--editing' : ''}`}>
      <div className="user-card-header">
        <div className="user-card-info">
          <div className="user-card-name">{displayName}</div>
          <div className="user-card-meta">
            {user.email && <span className="user-card-email">{user.email}</span>}
            {user.phoneNumber && <span className="user-card-phone">{user.phoneNumber}</span>}
          </div>
          <div className="user-card-roles">
            {user.roles.length === 0
              ? <span className="role-badge role-badge--none">No role</span>
              : user.roles.map(r => <RoleBadge key={r} role={r} />)
            }
          </div>
        </div>
        <div className="user-card-actions">
          {success && <span className="save-success">✅ Saved</span>}
          {!editing && (
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Edit</button>
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
    <div className="admin-users-page">
      <div className="page-header">
        <div>
          <h1>User management</h1>
          <p>Manage users and their roles</p>
        </div>
        {!showCreateForm && (
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
            + Add new user
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="create-form-container">
          <CreateUserForm onCreated={() => { setShowCreateForm(false); loadUsers(); }} onCancel={() => setShowCreateForm(false)} />
        </div>
      )}

      {error && <div className="error-banner">⚠️ {error}</div>}

      {!loading && (
        <div className="users-toolbar">
          <input
            className="users-search"
            type="search"
            placeholder="Search by name, email or username…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="role-filter-chips">
            {(['all', 'none', 'member', 'tenant-admin', 'admin'] as RoleFilter[]).map(f => (
              <button
                key={f}
                className={`filter-chip${roleFilter === f ? ' filter-chip--active' : ''}`}
                onClick={() => setRoleFilter(f)}
              >
                {ROLE_FILTER_LABELS[f]}
              </button>
            ))}
          </div>
          <div className="page-size-control">
            <span>Show</span>
            {PAGE_SIZE_OPTIONS.map(n => (
              <button
                key={n}
                className={`filter-chip${pageSize === n ? ' filter-chip--active' : ''}`}
                onClick={() => setPageSize(n)}
              >
                {n === 0 ? 'All' : n}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading users…</div>
      ) : (
        <div className="users-list">
          <div className="users-count">
            Showing {visible.length} of {filtered.length}
            {filtered.length !== users.length ? ` (${users.length} total)` : ' users'}
          </div>
          {visible.map(u => <UserCard key={u.id} user={u} onUpdated={loadUsers} />)}
          {pageSize !== 0 && filtered.length > pageSize && (
            <div className="users-truncated">
              {filtered.length - pageSize} users hidden — increase the limit or refine search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
