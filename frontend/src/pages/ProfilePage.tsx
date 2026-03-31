import { useEffect, useRef, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { keycloakAccountApi, profileApi } from '../api/client';
import type { PasskeyCredential } from '../api/client';

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

  if (loading) return <div className="flex justify-center items-center py-12 text-slate-500 text-lg">Loading profile…</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">My profile</h1>
        <p className="text-slate-500 mt-1">Update your contact details</p>
      </div>

      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm font-medium mb-6">✅ Profile saved!</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">⚠️ {error}</div>}

      <form className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="firstName" className="block text-sm font-semibold text-slate-700 mb-1.5">First name</label>
            <input
              id="firstName"
              type="text"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 focus:bg-white transition-colors"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="First name (optional)"
              autoComplete="given-name"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-semibold text-slate-700 mb-1.5">Last name</label>
            <input
              id="lastName"
              type="text"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 focus:bg-white transition-colors"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Last name (optional)"
              autoComplete="family-name"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            type="email"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 focus:bg-white transition-colors"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="phoneNumber" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Phone number <span className="text-red-500">*</span>
          </label>
          <input
            id="phoneNumber"
            type="tel"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 focus:bg-white transition-colors"
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            placeholder="+1 234 567 8900"
            required
            autoComplete="tel"
          />
        </div>

        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] self-start mt-1 max-sm:w-full max-sm:self-stretch"
          disabled={saving || !email.trim() || !phoneNumber.trim()}
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      {/* ── Passkeys ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mt-6" id="passkeys" ref={passkeysRef}>
        <div className="flex items-start justify-between gap-4 mb-5 max-md:flex-col max-md:items-stretch">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Passkeys</h2>
            <p className="text-sm text-slate-500">Sign in with Face ID, Touch ID, Windows Hello, or a security key — no password needed.</p>
          </div>
          <button
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] whitespace-nowrap shrink-0 max-md:w-full max-md:text-center"
            onClick={handleAddPasskey}
            disabled={!webAuthnSupported}
            title={webAuthnSupported ? undefined : 'Your browser does not support passkeys'}
          >
            + Add passkey
          </button>
        </div>

        {passkeySuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm font-medium mb-6">✅ {passkeySuccess}</div>
        )}
        {passkeyError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">⚠️ {passkeyError}</div>
        )}

        {!webAuthnSupported && (
          <p className="text-sm text-red-500 mt-2">
            Passkeys are not supported in this browser or device.
          </p>
        )}

        {passkeysLoading ? (
          <p className="text-sm text-slate-400 mt-2">Loading passkeys…</p>
        ) : passkeys.length === 0 ? (
          <p className="text-sm text-slate-400 mt-2">No passkeys registered yet.</p>
        ) : (
          <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
            {passkeys.map(pk => (
              <li key={pk.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xl shrink-0">🔑</span>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-semibold text-sm text-slate-900">{pk.userLabel || 'Passkey'}</span>
                  <span className="text-xs text-slate-400">
                    Added {pk.createdDate ? new Date(pk.createdDate).toLocaleDateString() : '—'}
                  </span>
                </div>
                <button
                  className="bg-white hover:bg-red-50 text-red-600 font-semibold px-3 py-1.5 text-sm rounded-xl border-[1.5px] border-red-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 max-md:min-h-[44px] max-md:min-w-[44px]"
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
