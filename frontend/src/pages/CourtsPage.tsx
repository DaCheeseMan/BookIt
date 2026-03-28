import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Link } from 'react-router-dom';
import { courtsApi, setAuthToken, type Court } from '../api/client';
import './CourtsPage.css';

export function CourtsPage() {
  const auth = useAuth();
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.user?.access_token) setAuthToken(auth.user.access_token);
    courtsApi.getAll()
      .then(setCourts)
      .catch(() => setError('Kunde inte hämta banor.'))
      .finally(() => setLoading(false));
  }, [auth.user]);

  if (loading) return <div className="loading">Laddar banor...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="courts-page">
      <div className="page-header">
        <h1>Banor</h1>
        <p>Välj en bana och boka din tid</p>
      </div>
      <div className="courts-list">
        {courts.map(court => (
          <div key={court.id} className="court-item">
            <div className="court-info">
              <h2>{court.name}</h2>
              <span className={`surface-badge ${court.surface.toLowerCase()}`}>
                {court.surface}
              </span>
              <p>{court.description}</p>
            </div>
            <Link to={`/book/${court.id}`} className="book-btn">
              Boka →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
