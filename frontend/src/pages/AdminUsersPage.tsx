import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { adminApi, type AdminUser, type AdminCreateUserRequest, type AdminUpdateUserRequest } from '../api/client';
import './AdminUsersPage.css';

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`role-badge role-badge--${role}`}>
      {role === 'admin' ? 'Admin' : 'Medlem'}
    </span>
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
  const [isMember, setIsMember] = useState(user.roles.includes('member'));
  const [isAdmin, setIsAdmin] = useState(user.roles.includes('admin'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const roles: string[] = [];
    if (isMember) roles.push('member');
    if (isAdmin) roles.push('admin');
    try {
      const req: AdminUpdateUserRequest = {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        roles,
      };
      await adminApi.updateUser(user.id, req);
      onSave();
    } catch {
      setError('Kunde inte spara användaren.');
      setSaving(false);
    }
  }

  return (
    <form className="user-edit-form" onSubmit={handleSave} noValidate>
      {error && <div className="error-banner">⚠️ {error}</div>}
      <div className="form-row">
        <div className="form-group">
          <label>Förnamn</label>
          <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Förnamn" />
        </div>
        <div className="form-group">
          <label>Efternamn</label>
          <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Efternamn" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>E-postadress</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="epost@exempel.se" />
        </div>
        <div className="form-group">
          <label>Telefonnummer</label>
          <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="070-000 00 00" />
        </div>
      </div>
      <div className="form-group">
        <label>Roller</label>
        <div className="role-checkboxes">
          <label className="checkbox-label">
            <input type="checkbox" checked={isMember} onChange={e => setIsMember(e.target.checked)} />
            Medlem
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} />
            Admin
          </label>
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Sparar...' : 'Spara'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Avbryt
        </button>
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
  const [isMember, setIsMember] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const roles: string[] = [];
    if (isMember) roles.push('member');
    if (isAdmin) roles.push('admin');
    try {
      const req: AdminCreateUserRequest = {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        temporaryPassword,
        roles,
      };
      await adminApi.createUser(req);
      onCreated();
    } catch {
      setError('Kunde inte skapa användaren. Kontrollera att e-postadressen inte redan är registrerad.');
      setSaving(false);
    }
  }

  return (
    <form className="create-user-form" onSubmit={handleCreate} noValidate>
      <h2>Lägg till ny användare</h2>
      {error && <div className="error-banner">⚠️ {error}</div>}
      <div className="form-row">
        <div className="form-group">
          <label>Förnamn</label>
          <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Förnamn" />
        </div>
        <div className="form-group">
          <label>Efternamn</label>
          <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Efternamn" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>E-postadress <span className="required">*</span></label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="epost@exempel.se" required />
        </div>
        <div className="form-group">
          <label>Telefonnummer</label>
          <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="070-000 00 00" />
        </div>
      </div>
      <div className="form-group">
        <label>Tillfälligt lösenord <span className="required">*</span></label>
        <input type="text" value={temporaryPassword} onChange={e => setTemporaryPassword(e.target.value)}
          placeholder="Användaren måste byta lösenord vid första inloggning" required />
        <span className="field-hint">Användaren uppmanas att byta lösenord vid nästa inloggning.</span>
      </div>
      <div className="form-group">
        <label>Roller</label>
        <div className="role-checkboxes">
          <label className="checkbox-label">
            <input type="checkbox" checked={isMember} onChange={e => setIsMember(e.target.checked)} />
            Medlem
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} />
            Admin
          </label>
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || !email.trim() || !temporaryPassword.trim()}>
          {saving ? 'Skapar...' : 'Skapa användare'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Avbryt
        </button>
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
              ? <span className="role-badge role-badge--none">Ingen roll</span>
              : user.roles.map(r => <RoleBadge key={r} role={r} />)
            }
          </div>
        </div>
        <div className="user-card-actions">
          {success && <span className="save-success">✅ Sparat</span>}
          {!editing && (
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
              Redigera
            </button>
          )}
        </div>
      </div>
      {editing && (
        <EditUserForm
          user={user}
          onSave={handleSaved}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [20, 50, 0] as const; // 0 = All
type RoleFilter = 'all' | 'none' | 'member' | 'admin';

function matchesRoleFilter(user: AdminUser, filter: RoleFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'none') return user.roles.length === 0;
  return user.roles.includes(filter);
}

function sortUsers(users: AdminUser[]): AdminUser[] {
  return [...users].sort((a, b) => {
    const firstA = (a.firstName ?? '').toLowerCase();
    const firstB = (b.firstName ?? '').toLowerCase();
    if (firstA !== firstB) return firstA.localeCompare(firstB, 'sv');
    const lastA = (a.lastName ?? '').toLowerCase();
    const lastB = (b.lastName ?? '').toLowerCase();
    return lastA.localeCompare(lastB, 'sv');
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
      .catch(() => setError('Kunde inte hämta användarlistan.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadUsers(); }, [auth.user?.access_token]);

  function handleCreated() {
    setShowCreateForm(false);
    loadUsers();
  }

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
    all: 'Alla',
    none: 'Ingen roll',
    member: 'Medlem',
    admin: 'Admin',
  };

  return (
    <div className="admin-users-page">
      <div className="page-header">
        <div>
          <h1>Användarhantering</h1>
          <p>Hantera klubbens användare och deras roller</p>
        </div>
        {!showCreateForm && (
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
            + Lägg till ny användare
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="create-form-container">
          <CreateUserForm
            onCreated={handleCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {error && <div className="error-banner">⚠️ {error}</div>}

      {!loading && (
        <div className="users-toolbar">
          <input
            className="users-search"
            type="search"
            placeholder="Sök på namn, e-post eller användarnamn…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="role-filter-chips">
            {(['all', 'none', 'member', 'admin'] as RoleFilter[]).map(f => (
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
            <span>Visa</span>
            {PAGE_SIZE_OPTIONS.map(n => (
              <button
                key={n}
                className={`filter-chip${pageSize === n ? ' filter-chip--active' : ''}`}
                onClick={() => setPageSize(n)}
              >
                {n === 0 ? 'Alla' : n}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Laddar användare...</div>
      ) : (
        <div className="users-list">
          <div className="users-count">
            Visar {visible.length} av {filtered.length}
            {filtered.length !== users.length ? ` (${users.length} totalt)` : ' användare'}
          </div>
          {visible.map(u => (
            <UserCard key={u.id} user={u} onUpdated={loadUsers} />
          ))}
          {pageSize !== 0 && filtered.length > pageSize && (
            <div className="users-truncated">
              {filtered.length - pageSize} användare döljs — öka gränsen eller förfina sökningen.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
