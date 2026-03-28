import { useAuth } from 'react-oidc-context';
import { useLocation } from 'react-router-dom';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.isLoading) {
    return <div className="loading">Laddar...</div>;
  }

  if (!auth.isAuthenticated) {
    auth.signinRedirect({ state: { returnTo: location.pathname } });
    return <div className="loading">Omdirigerar till inloggning...</div>;
  }

  return <>{children}</>;
}
