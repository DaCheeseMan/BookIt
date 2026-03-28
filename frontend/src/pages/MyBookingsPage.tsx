import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { bookingsApi, setAuthToken, type Booking } from '../api/client';
import './MyBookingsPage.css';

function isPast(booking: Booking) {
  const bookingDate = new Date(`${booking.date}T${booking.startTime}`);
  return bookingDate < new Date();
}

export function MyBookingsPage() {
  const auth = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);

  useEffect(() => {
    if (auth.user?.access_token) setAuthToken(auth.user.access_token);
    bookingsApi.getMine()
      .then(setBookings)
      .catch(() => setError('Kunde inte hämta bokningar.'))
      .finally(() => setLoading(false));
  }, [auth.user]);

  async function handleCancel(id: number) {
    setCancelling(id);
    try {
      await bookingsApi.cancel(id);
      setBookings(prev => prev.filter(b => b.id !== id));
    } catch {
      setError('Kunde inte avboka. Försök igen.');
    } finally {
      setCancelling(null);
    }
  }

  if (loading) return <div className="loading">Laddar bokningar...</div>;

  const upcoming = bookings.filter(b => !isPast(b));
  const past = bookings.filter(b => isPast(b));

  return (
    <div className="my-bookings-page">
      <div className="page-header">
        <h1>Mina bokningar</h1>
        <p>Välkommen, {auth.user?.profile.preferred_username}!</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <section>
        <h2>Kommande ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p className="empty-msg">Inga kommande bokningar.</p>
        ) : (
          <div className="bookings-list">
            {upcoming.map(b => (
              <div key={b.id} className="booking-item upcoming">
                <div className="booking-details">
                  <strong>{b.court?.name ?? `Bana ${b.courtId}`}</strong>
                  <span className="booking-time">
                    📅 {b.date} &nbsp;⏰ {b.startTime.slice(0, 5)}–{b.endTime.slice(0, 5)}
                  </span>
                  {b.court && (
                    <span className={`surface-badge ${b.court.surface.toLowerCase()}`}>
                      {b.court.surface}
                    </span>
                  )}
                </div>
                <button
                  className="cancel-btn"
                  onClick={() => handleCancel(b.id)}
                  disabled={cancelling === b.id}
                >
                  {cancelling === b.id ? 'Avbokar...' : 'Avboka'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="past-section">
          <h2>Historik ({past.length})</h2>
          <div className="bookings-list">
            {past.map(b => (
              <div key={b.id} className="booking-item past">
                <div className="booking-details">
                  <strong>{b.court?.name ?? `Bana ${b.courtId}`}</strong>
                  <span className="booking-time">
                    📅 {b.date} &nbsp;⏰ {b.startTime.slice(0, 5)}–{b.endTime.slice(0, 5)}
                  </span>
                </div>
                <span className="past-label">Spelad</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
