import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { bookingsApi, setAuthToken, type Booking } from '../api/client';

const TYPE_ICONS: Record<string, string> = {
  court: '🏓', tennis: '🎾', padel: '🏓', sauna: '🧖', restaurant: '🍽️',
  boat: '⛵', car: '🚗', vehicle: '🚘', meeting: '🏢', gym: '🏋️', pool: '🏊', default: '📅',
};

function getTypeIcon(resourceType: string): string {
  const key = (resourceType ?? '').toLowerCase();
  for (const [k, v] of Object.entries(TYPE_ICONS)) {
    if (key.includes(k)) return v;
  }
  return TYPE_ICONS.default;
}

function isPast(booking: Booking) {
  return new Date(`${booking.date}T${booking.startTime}`) < new Date();
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
      .catch(() => setError('Could not load bookings.'))
      .finally(() => setLoading(false));
  }, [auth.user]);

  async function handleCancel(id: number) {
    setCancelling(id);
    try {
      await bookingsApi.cancel(id);
      setBookings(prev => prev.filter(b => b.id !== id));
    } catch {
      setError('Could not cancel booking. Please try again.');
    } finally {
      setCancelling(null);
    }
  }

  if (loading) return <div className="flex justify-center items-center py-12 text-slate-500 text-lg">Loading bookings…</div>;

  const upcoming = bookings.filter(b => !isPast(b));
  const past = bookings.filter(b => isPast(b));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">My bookings</h1>
        <p className="text-slate-500 mt-1">Welcome, {auth.user?.profile.preferred_username}!</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">{error}</div>}

      <section>
        <h2 className="text-xl font-semibold text-slate-800 mb-4 pb-2 border-b-2 border-indigo-100">Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p className="text-slate-400 italic py-4">No upcoming bookings.</p>
        ) : (
          <div className="flex flex-col gap-3 mb-8">
            {upcoming.map(b => (
              <div key={b.id} className="flex items-center justify-between bg-white rounded-2xl shadow-sm p-5 border-l-4 border-indigo-500 max-md:flex-col max-md:items-start max-md:gap-3">
                <div className="text-3xl shrink-0">{getTypeIcon(b.resourceType)}</div>
                <div className="flex flex-col gap-1">
                  <strong className="text-base text-slate-900">{b.resourceName}</strong>
                  <span className="text-sm text-indigo-600">{b.tenantName}</span>
                  <span className="text-sm text-slate-500">
                    📅 {b.date} &nbsp;⏰ {b.startTime.slice(0, 5)}–{b.endTime.slice(0, 5)}
                  </span>
                  <span className="inline-block bg-indigo-100 text-indigo-700 rounded-full px-3 py-0.5 text-xs font-semibold capitalize mt-0.5 w-fit">{b.resourceType}</span>
                </div>
                <button
                  className="bg-white hover:bg-red-50 text-red-600 font-semibold px-4 py-2 rounded-xl border-[1.5px] border-red-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap min-h-[44px] max-md:w-full"
                  onClick={() => handleCancel(b.id)}
                  disabled={cancelling === b.id}
                >
                  {cancelling === b.id ? 'Cancelling…' : 'Cancel'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-4 pb-2 border-b-2 border-indigo-100">History ({past.length})</h2>
          <div className="flex flex-col gap-3 mb-8">
            {past.map(b => (
              <div key={b.id} className="flex items-center justify-between bg-white rounded-2xl shadow-sm p-5 border-l-4 border-slate-300 opacity-75 max-md:flex-col max-md:items-start max-md:gap-3">
                <div className="text-3xl shrink-0">{getTypeIcon(b.resourceType)}</div>
                <div className="flex flex-col gap-1">
                  <strong className="text-base text-slate-900">{b.resourceName}</strong>
                  <span className="text-sm text-indigo-600">{b.tenantName}</span>
                  <span className="text-sm text-slate-500">
                    📅 {b.date} &nbsp;⏰ {b.startTime.slice(0, 5)}–{b.endTime.slice(0, 5)}
                  </span>
                </div>
                <span className="text-sm text-slate-400 italic">Done</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
