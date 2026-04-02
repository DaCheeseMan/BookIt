import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { invitationsApi, type InviteDetails } from '../api/client';

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const auth = useAuth();

  const [details, setDetails] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptedSlug, setAcceptedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    invitationsApi.getDetails(token)
      .then(setDetails)
      .catch(() => setError('This invite link is invalid or no longer available.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    if (!auth.isAuthenticated) {
      // Redirect to Keycloak login, then return to this page
      auth.signinRedirect({ redirect_uri: window.location.href });
      return;
    }
    setAccepting(true);
    setError(null);
    try {
      const result = await invitationsApi.accept(token);
      setAccepted(true);
      setAcceptedSlug(result.tenantSlug);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { title?: string } } };
      const status = axiosErr?.response?.status;
      if (status === 409) setError('You have already accepted this invitation.');
      else if (status === 400) setError(axiosErr?.response?.data?.title ?? 'This invite is no longer valid.');
      else setError('Could not accept the invitation. Please try again.');
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-slate-500 text-sm">Loading invite…</div>
      </div>
    );
  }

  if (accepted && acceptedSlug) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">You've joined {details?.tenantName ?? 'the space'}!</h1>
          <p className="text-sm text-slate-500 mb-6">You can now browse resources and make bookings.</p>
          <button
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors cursor-pointer min-h-[44px] w-full"
            onClick={() => navigate(`/tenants/${acceptedSlug}`)}
          >
            Go to space →
          </button>
        </div>
      </div>
    );
  }

  if (error && !details) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid invite</h1>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <button
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-6 py-3 rounded-xl transition-colors cursor-pointer min-h-[44px] w-full"
            onClick={() => navigate('/')}
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  const isExpiredOrRevoked = details?.status === 'Expired' || details?.status === 'Revoked';
  const isAlreadyAccepted = details?.status === 'Accepted';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">✉️</div>
          <h1 className="text-xl font-bold text-slate-900">You've been invited</h1>
          {details && (
            <p className="text-sm text-slate-500 mt-1">
              to join <span className="font-semibold text-slate-800">{details.tenantName}</span>
            </p>
          )}
        </div>

        {details && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 mb-6 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Space</span>
              <span className="font-semibold text-slate-800">{details.tenantName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Role</span>
              <span className="font-semibold text-slate-800">{details.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <span className={`font-semibold ${
                details.status === 'Pending' ? 'text-amber-700' :
                details.status === 'Accepted' ? 'text-emerald-700' :
                'text-red-700'
              }`}>{details.status}</span>
            </div>
            {details.status === 'Pending' && (
              <div className="flex justify-between">
                <span className="text-slate-500">Expires</span>
                <span className="text-slate-700">{new Date(details.expiresAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
            ⚠️ {error}
          </div>
        )}

        {isAlreadyAccepted && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm mb-4">
            ✅ This invitation has already been accepted.
          </div>
        )}

        {isExpiredOrRevoked && (
          <div className="bg-slate-50 border border-slate-200 text-slate-600 rounded-xl px-4 py-3 text-sm mb-4">
            This invite link is no longer valid. Please ask the space admin for a new link.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {details?.status === 'Pending' && (
            <button
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] w-full"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? 'Joining…' : auth.isAuthenticated ? 'Join Space' : 'Sign in to join'}
            </button>
          )}
          {isAlreadyAccepted && details && (
            <button
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors cursor-pointer min-h-[44px] w-full"
              onClick={() => navigate(`/tenants/${details.tenantSlug}`)}
            >
              Go to space →
            </button>
          )}
          <button
            className="bg-white hover:bg-slate-50 text-slate-600 font-semibold px-6 py-3 rounded-xl border border-slate-200 transition-colors cursor-pointer min-h-[44px] w-full"
            onClick={() => navigate('/')}
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
