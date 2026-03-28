import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';
import { keycloakAccountApi } from '../api/client';
import './PasskeyPromptBanner.css';

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
    <div className="passkey-prompt-banner" role="status">
      <span className="passkey-prompt-icon">🔑</span>
      <span className="passkey-prompt-text">
        Sign in faster with Face ID, Touch ID, or Windows Hello
      </span>
      <button
        className="passkey-prompt-action"
        onClick={() => { dismiss(); navigate('/profile#passkeys'); }}
      >
        Set up passkey
      </button>
      <button
        className="passkey-prompt-dismiss"
        onClick={dismiss}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
