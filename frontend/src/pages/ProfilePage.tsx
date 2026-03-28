import { useEffect, useRef, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { keycloakAccountApi, profileApi } from '../api/client';
import type { PasskeyCredential } from '../api/client';
import './ProfilePage.css';

const webAuthnSupported =
  typeof window !== 'undefined' &&
  'credentials' in navigator &&
  typeof window.PublicKeyCredential !== 'undefined';

export function ProfilePage() {
  const auth = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Passkeys state
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);
  const [passkeysLoading, setPasskeysLoading] = useState(true);
  const [passkeySuccess, setPasskeySuccess] = useState<string | null>(null);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const passkeysRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    profileApi.get()
      .then(profile => {
        setFirstName(profile.firstName ?? '');
        setLastName(profile.lastName ?? '');
        setEmail(profile.email ?? '');
        setPhoneNumber(profile.attributes?.phone_number?.[0] ?? '');
      })
      .catch(() => setError('Could not load profile.'))
      .finally(() => setLoading(false));
  }, [auth.user?.access_token]);

  useEffect(() => {
    setPasskeysLoading(true);
    keycloakAccountApi.listPasskeys()
      .then(setPasskeys)
      .catch(() => setPasskeyError('Could not load passkeys.'))
      .finally(() => setPasskeysLoading(false));

    // Show success message if returning from passkey registration
    if (sessionStorage.getItem('passkey_registering')) {
      sessionStorage.removeItem('passkey_registering');
      setPasskeySuccess('Passkey registered! You can now sign in with biometrics.');
      // Scroll to passkeys section after a short delay
      setTimeout(() => passkeysRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
    }
  }, [auth.user?.access_token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      await profileApi.update({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim(),
        attributes: { phone_number: [phoneNumber.trim()] },
      });

      await auth.signinSilent();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }

  function handleAddPasskey() {
    sessionStorage.setItem('passkey_registering', '1');
    auth.signinRedirect({
      redirect_uri: `${window.location.origin}/profile`,
      extraQueryParams: { kc_action: 'webauthn-register-passwordless' },
    });
  }

  async function handleDeletePasskey(id: string) {
    setDeletingId(id);
    setPasskeyError(null);
    try {
      await keycloakAccountApi.deletePasskey(id);
      setPasskeys(prev => prev.filter(p => p.id !== id));
      setPasskeySuccess('Passkey removed.');
    } catch {
      setPasskeyError('Could not remove passkey. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <div className="loading">Loading profile…</div>;

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>My profile</h1>
        <p>Update your contact details</p>
      </div>

      {success && <div className="success-banner">✅ Profile saved!</div>}
      {error && <div className="error-banner">⚠️ {error}</div>}

      <form className="profile-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="firstName">First name</label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="First name (optional)"
              autoComplete="given-name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="lastName">Last name</label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Last name (optional)"
              autoComplete="family-name"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="email">
            Email <span className="required">*</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="phoneNumber">
            Phone number <span className="required">*</span>
          </label>
          <input
            id="phoneNumber"
            type="tel"
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            placeholder="+1 234 567 8900"
            required
            autoComplete="tel"
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary save-btn"
          disabled={saving || !email.trim() || !phoneNumber.trim()}
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      {/* ── Passkeys ──────────────────────────────────── */}
      <div className="passkeys-card" id="passkeys" ref={passkeysRef}>
        <div className="passkeys-header">
          <div>
            <h2>Passkeys</h2>
            <p>Sign in with Face ID, Touch ID, Windows Hello, or a security key — no password needed.</p>
          </div>
          <button
            className="btn btn-primary add-passkey-btn"
            onClick={handleAddPasskey}
            disabled={!webAuthnSupported}
            title={webAuthnSupported ? undefined : 'Your browser does not support passkeys'}
          >
            + Add passkey
          </button>
        </div>

        {passkeySuccess && (
          <div className="success-banner passkey-msg">✅ {passkeySuccess}</div>
        )}
        {passkeyError && (
          <div className="error-banner passkey-msg">⚠️ {passkeyError}</div>
        )}

        {!webAuthnSupported && (
          <p className="passkey-unsupported">
            Passkeys are not supported in this browser or device.
          </p>
        )}

        {passkeysLoading ? (
          <p className="passkey-loading">Loading passkeys…</p>
        ) : passkeys.length === 0 ? (
          <p className="passkey-empty">No passkeys registered yet.</p>
        ) : (
          <ul className="passkey-list">
            {passkeys.map(pk => (
              <li key={pk.id} className="passkey-row">
                <span className="passkey-icon">🔑</span>
                <div className="passkey-info">
                  <span className="passkey-label">{pk.userLabel || 'Passkey'}</span>
                  <span className="passkey-date">
                    Added {pk.createdDate ? new Date(pk.createdDate).toLocaleDateString() : '—'}
                  </span>
                </div>
                <button
                  className="btn btn-danger passkey-delete-btn"
                  onClick={() => handleDeletePasskey(pk.id)}
                  disabled={deletingId === pk.id}
                  aria-label={`Remove passkey ${pk.userLabel || ''}`}
                >
                  {deletingId === pk.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
