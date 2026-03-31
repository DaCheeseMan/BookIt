import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';
import { keycloakAccountApi } from '../api/client';

const DISMISS_KEY = 'passkey_prompt_dismissed';
const webAuthnSupported =
  typeof window !== 'undefined' &&
  'credentials' in navigator &&
  typeof window.PublicKeyCredential !== 'undefined';

export function PasskeyPromptBanner() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!auth.isAuthenticated || !webAuthnSupported) return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    keycloakAccountApi.listPasskeys()
      .then(keys => { if (keys.length === 0) setShow(true); })
      .catch(() => {});
  }, [auth.isAuthenticated]);

  if (!show) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setShow(false);
  }

  return (
    <div className="bg-indigo-50 border-b border-indigo-100 flex items-center gap-3 px-4 py-2 flex-wrap" role="status">
      <span className="text-lg">🔑</span>
      <span className="text-indigo-800 font-medium text-sm flex-1">
        Sign in faster with Face ID, Touch ID, or Windows Hello
      </span>
      <button
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-1.5 rounded-lg text-sm transition-colors cursor-pointer"
        onClick={() => { dismiss(); navigate('/profile#passkeys'); }}
      >
        Set up passkey
      </button>
      <button
        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md p-1 transition-colors cursor-pointer"
        onClick={dismiss}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
