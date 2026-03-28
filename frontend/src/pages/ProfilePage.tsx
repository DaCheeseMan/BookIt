import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { profileApi } from '../api/client';
import './ProfilePage.css';

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
    </div>
  );
}
