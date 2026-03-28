import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { bookingsApi, courtsApi, setAuthToken, type Court } from '../api/client';
import './BookingPage.css';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07–20

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function BookingPage() {
  const { courtId } = useParams<{ courtId: string }>();
  const navigate = useNavigate();
  const auth = useAuth();

  const [court, setCourt] = useState<Court | null>(null);
  const [date, setDate] = useState(todayStr());
  const [startHour, setStartHour] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (auth.user?.access_token) setAuthToken(auth.user.access_token);
    if (courtId) {
      courtsApi.getById(Number(courtId)).then(setCourt).catch(() => setError('Bana hittades inte.'));
    }
  }, [auth.user, courtId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startHour || !courtId) return;
    setSubmitting(true);
    setError(null);
    try {
      await bookingsApi.create({ courtId: Number(courtId), date, startHour });
      setSuccess(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { title?: string } } };
      setError(axiosErr?.response?.data?.title ?? 'Bokning misslyckades. Försök igen.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="booking-page">
        <div className="success-card">
          <div className="success-icon">✅</div>
          <h2>Bokning bekräftad!</h2>
          <p>
            <strong>{court?.name}</strong> — {date}, kl {startHour}:00–{(startHour ?? 0) + 1}:00
          </p>
          <div className="success-actions">
            <button className="btn-primary" onClick={() => navigate('/my-bookings')}>
              Mina bokningar
            </button>
            <button className="btn-secondary" onClick={() => navigate('/courts')}>
              Boka fler banor
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-page">
      <div className="booking-card">
        <h1>Boka {court?.name ?? '...'}</h1>
        {court && (
          <span className={`surface-badge ${court.surface.toLowerCase()}`}>{court.surface}</span>
        )}
        <form onSubmit={handleSubmit} className="booking-form">
          <label>
            Datum
            <input
              type="date"
              value={date}
              min={todayStr()}
              onChange={e => setDate(e.target.value)}
              required
            />
          </label>
          <label>
            Tid (1-timmestid)
            <div className="time-slots">
              {HOURS.map(h => (
                <button
                  key={h}
                  type="button"
                  className={`slot${startHour === h ? ' selected' : ''}`}
                  onClick={() => setStartHour(h)}
                >
                  {h}:00
                </button>
              ))}
            </div>
          </label>
          {error && <div className="error-msg">{error}</div>}
          <button
            type="submit"
            className="btn-primary submit-btn"
            disabled={!startHour || submitting}
          >
            {submitting ? 'Bokar...' : 'Bekräfta bokning'}
          </button>
        </form>
      </div>
    </div>
  );
}
