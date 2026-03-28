import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from 'react-oidc-context'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

;(async () => {
  // Fetch Keycloak authority at runtime so the deployed URL is always correct.
  // Falls back to the env var (or localhost) when running frontend-only without a server.
  let keycloakAuthority: string
  try {
    const res = await fetch('/api/config')
    const config = await res.json() as { keycloakAuthority: string }
    keycloakAuthority = config.keycloakAuthority
  } catch {
    keycloakAuthority = `${import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8080'}/realms/jtk`
  }

  const oidcConfig = {
    authority: keycloakAuthority,
    client_id: 'jtk-web',
    redirect_uri: window.location.origin,
    post_logout_redirect_uri: window.location.origin,
    response_type: 'code',
    scope: 'openid profile email',
    automaticSilentRenew: true,
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider {...oidcConfig}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </StrictMode>,
  )
})()

