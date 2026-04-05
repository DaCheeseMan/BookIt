import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { bookingsApi, resourcesApi, tenantsApi, getUserRoles, setAuthToken, type Resource, type ResourceBooking } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function toTimeStr(hour: number, minute: number = 0): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

type SlotState = 'past' | 'free' | 'mine' | 'taken';

interface SlotInfo {
  state: SlotState;
  booking?: ResourceBooking;
}

const SLOT_STATE_CLASSES: Record<SlotState, string> = {
  past: 'bg-slate-100 cursor-not-allowed',
  free: 'bg-white text-slate-400',
  mine: 'bg-indigo-100 cursor-default',
  taken: 'bg-red-50 cursor-default',
};

export function WeeklyCalendarPage() {
  const { slug, resourceId } = useParams<{ slug: string; resourceId: string }>();
  const navigate = useNavigate();
  const auth = useAuth();

  const [resource, setResource] = useState<Resource | null>(null);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [resourceBookings, setResourceBookings] = useState<ResourceBooking[]>([]);
  const [myFutureCount, setMyFutureCount] = useState(0);
  const [cancellingBooking, setCancellingBooking] = useState<number | null>(null);
  const [confirmBooking, setConfirmBooking] = useState<ResourceBooking | null>(null);
  const [infoBooking, setInfoBooking] = useState<ResourceBooking | null>(null);
  const [pendingSlot, setPendingSlot] = useState<{ dateStr: string; hour: number; minute: number } | null>(null);
  const [loadingSlot, setLoadingSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [confirmedSlot, setConfirmedSlot] = useState<string | null>(null);

  const myUserId = auth.user?.profile.sub;
  const userRoles = getUserRoles(auth.user?.access_token);
  const isAdmin = userRoles.includes('admin');

  const isMobile = useIsMobile();
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const monday = getMondayOf(new Date());
    const today = new Date();
    const diff = Math.floor((today.getTime() - monday.getTime()) / 86400000);
    return diff >= 0 && diff <= 6 ? diff : 0;
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekFrom = toDateStr(weekDays[0]);
  const weekTo = toDateStr(weekDays[6]);

  // Compute time slots from resource slot duration
  const slotDuration = resource?.slotDurationMinutes ?? 60;
  const slotsPerHour = 60 / slotDuration;
  const SLOTS: { hour: number; minute: number }[] = [];
  for (let h = 7; h < 23; h++) {
    for (let s = 0; s < slotsPerHour; s++) {
      SLOTS.push({ hour: h, minute: s * slotDuration });
    }
  }

  const loadBookings = useCallback(async () => {
    if (!tenantId || !resourceId) return;
    try {
      const weekData = await resourcesApi.getBookings(tenantId, Number(resourceId), weekFrom, weekTo);
      setResourceBookings(weekData);
      if (auth.isAuthenticated) {
        const myData = await bookingsApi.getMine();
        const now = new Date();
        const todayStr = toDateStr(now);
        const nowTime = now.toTimeString().slice(0, 8);
        const future = myData.filter(b =>
          b.date > todayStr || (b.date === todayStr && b.startTime > nowTime)
        );
        setMyFutureCount(future.length);
      }
    } catch {
      setError('Could not load bookings.');
    }
  }, [tenantId, resourceId, weekFrom, weekTo, auth.isAuthenticated]);

  useEffect(() => {
    if (auth.user?.access_token) setAuthToken(auth.user.access_token);
    if (!slug || !resourceId) return;
    tenantsApi.getById(slug).then(t => {
      setTenantId(t.id);
      return resourcesApi.getById(t.id, Number(resourceId));
    }).then(r => {
      setResource(r);
    }).catch((err: unknown) => {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 403) {
        setForbidden(true);
      } else {
        setError('Resource not found.');
      }
    }).finally(() => setLoading(false));
  }, [auth.user, slug, resourceId]);

  useEffect(() => {
    const idx = weekDays.findIndex(d => toDateStr(d) === toDateStr(new Date()));
    setSelectedDayIndex(idx >= 0 ? idx : 0);
  }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tenantId) loadBookings();
  }, [loadBookings, tenantId]);

  function getSlotInfo(dateStr: string, hour: number, minute: number): SlotInfo {
    const now = new Date();
    const todayStr = toDateStr(now);
    const slotTime = toTimeStr(hour, minute);
    const isPast = dateStr < todayStr || (dateStr === todayStr && slotTime <= now.toTimeString().slice(0, 8));
    if (isPast) return { state: 'past' };

    const booking = resourceBookings.find(b => {
      return b.date === dateStr && b.startTime.slice(0, 5) === slotTime.slice(0, 5);
    });

    if (!booking) return { state: 'free' };
    if (booking.userId === myUserId) return { state: 'mine', booking };
    return { state: 'taken', booking };
  }

  function handleSlotClick(dateStr: string, hour: number, minute: number) {
    const { state } = getSlotInfo(dateStr, hour, minute);
    if (state !== 'free') return;
    if (!auth.isAuthenticated) return;
    if (!isAdmin && myFutureCount >= 3) {
      setError('You cannot have more than 3 upcoming bookings for this space.');
      return;
    }
    if (!resourceId || !tenantId) return;
    setPendingSlot({ dateStr, hour, minute });
  }

  async function confirmSlotBooking() {
    if (!pendingSlot || !resourceId || !tenantId) return;
    const { dateStr, hour, minute } = pendingSlot;
    const slotKey = `${dateStr}-${hour}-${minute}`;
    setPendingSlot(null);
    setLoadingSlot(slotKey);
    setError(null);
    try {
      await bookingsApi.create({
        resourceId: Number(resourceId),
        date: dateStr,
        startTime: toTimeStr(hour, minute),
      });
      setConfirmedSlot(slotKey);
      await loadBookings();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: string | { title?: string } } };
      const data = axiosErr?.response?.data;
      const msg = typeof data === 'string' ? data : data?.title;
      setError(msg ?? 'Booking failed. Please try again.');
    } finally {
      setLoadingSlot(null);
    }
  }

  async function confirmAdminCancel() {
    if (!confirmBooking) return;
    setCancellingBooking(confirmBooking.id);
    setConfirmBooking(null);
    setError(null);
    try {
      await bookingsApi.cancel(confirmBooking.id);
      await loadBookings();
    } catch {
      setError('Could not cancel booking. Please try again.');
    } finally {
      setCancellingBooking(null);
    }
  }

  const atBookingLimit = !isAdmin && myFutureCount >= 3;

  if (loading) {
    return <div className="flex justify-center items-center h-48 text-slate-500 text-lg">Loading…</div>;
  }

  if (forbidden) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Access denied</h2>
        <p className="text-slate-500 mb-6">You are not a member of this private space.</p>
        <button
          className="text-indigo-600 hover:underline text-sm font-semibold"
          onClick={() => window.history.back()}
        >
          ← Go back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 max-sm:flex-col max-sm:items-start">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Book {resource?.name ?? '…'}</h1>
          {resource && (
            <span className="bg-indigo-100 text-indigo-700 rounded-full px-3 py-0.5 text-xs font-semibold">{resource.resourceType}</span>
          )}
          {resource && (
            <span className="bg-indigo-100 text-indigo-700 rounded-full px-3 py-0.5 text-xs font-semibold">⏱ {slotDuration} min slots</span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap max-sm:w-full max-sm:justify-between">
          <button
            className="bg-white hover:bg-indigo-600 text-indigo-600 hover:text-white font-semibold px-4 py-2 rounded-xl border-[1.5px] border-indigo-200 hover:border-indigo-600 text-sm cursor-pointer transition-colors"
            onClick={() => { setWeekStart(w => addDays(w, -7)); setConfirmedSlot(null); }}
          >
            ← Prev week
          </button>
          <span className="font-semibold text-slate-800 min-w-[11rem] text-center max-sm:min-w-0 max-sm:text-sm">
            {formatDate(weekDays[0])} – {formatDate(weekDays[6])}
          </span>
          <button
            className="bg-white hover:bg-indigo-600 text-indigo-600 hover:text-white font-semibold px-4 py-2 rounded-xl border-[1.5px] border-indigo-200 hover:border-indigo-600 text-sm cursor-pointer transition-colors"
            onClick={() => { setWeekStart(w => addDays(w, 7)); setConfirmedSlot(null); }}
          >
            Next week →
          </button>
        </div>
      </div>

      {atBookingLimit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-amber-800 text-sm">
          You have reached the limit of 3 upcoming bookings.{' '}
          <button className="bg-transparent border-none text-[inherit] font-bold cursor-pointer underline p-0" onClick={() => navigate('/my-bookings')}>My bookings</button>
        </div>
      )}

      {!auth.isAuthenticated && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-4 text-indigo-800 text-sm">
          <button className="bg-transparent border-none text-[inherit] font-bold cursor-pointer underline p-0" onClick={() => auth.signinRedirect()}>Sign in</button>
          {' '}to book a slot.
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-700 text-sm">{error}</div>}

      {confirmedSlot && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 text-emerald-700 text-sm">
          ✅ Booking confirmed!{' '}
          <button className="bg-transparent border-none text-[inherit] font-bold cursor-pointer underline p-0" onClick={() => navigate('/my-bookings')}>View my bookings</button>
        </div>
      )}

      {isMobile && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
          {weekDays.map((day, i) => {
            const ds = toDateStr(day);
            const todayStr = toDateStr(new Date());
            const isActive = selectedDayIndex === i;
            const isToday = ds === todayStr;
            return (
              <button
                key={i}
                className={[
                  'flex flex-col items-center px-2.5 py-2 rounded-xl border-[1.5px] min-w-[52px] min-h-[44px] shrink-0 transition-all',
                  isActive
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : isToday
                      ? 'border-indigo-600 text-indigo-600 bg-white cursor-pointer'
                      : 'border-slate-200 bg-white cursor-pointer',
                ].join(' ')}
                onClick={() => setSelectedDayIndex(i)}
              >
                <span className="text-xs font-bold uppercase">{DAY_NAMES[i]}</span>
                <span className="text-[0.7rem] opacity-80 mt-0.5">{formatDate(day)}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl shadow-md">
        {(() => {
          const visibleDays = isMobile ? [weekDays[selectedDayIndex]] : weekDays;
          return (
            <div
              className={`grid border border-slate-200 rounded-xl overflow-hidden bg-slate-50 ${isMobile ? 'min-w-0' : 'min-w-[540px]'}`}
              style={{ gridTemplateColumns: isMobile ? '3.5rem 1fr' : '3.5rem repeat(7, minmax(5.5rem, 1fr))' }}
            >
              {/* Header row */}
              <div className="bg-indigo-700" />
              {visibleDays.map((day, i) => {
                const ds = toDateStr(day);
                const todayStr = toDateStr(new Date());
                const originalIdx = isMobile ? selectedDayIndex : i;
                const isToday = ds === todayStr;
                return (
                  <div key={i} className={`${isToday ? 'bg-indigo-500' : 'bg-indigo-700'} text-white flex flex-col items-center py-2 px-1 text-sm border-l border-indigo-600`}>
                    <span className="font-bold">{DAY_NAMES[originalIdx]}</span>
                    <span className="text-xs opacity-85">{formatDate(day)}</span>
                  </div>
                );
              })}

              {/* Slot rows */}
              {SLOTS.map(({ hour, minute }) => (
                <React.Fragment key={`${hour}-${minute}`}>
                  <div className="bg-slate-100 text-xs text-slate-500 flex items-center justify-center border-t border-slate-200 font-semibold">
                    {minute === 0 ? `${hour}:00` : `${hour}:${String(minute).padStart(2, '0')}`}
                  </div>
                  {visibleDays.map((day, di) => {
                    const dateStr = toDateStr(day);
                    const slotKey = `${dateStr}-${hour}-${minute}`;
                    const { state, booking } = getSlotInfo(dateStr, hour, minute);
                    const isLoading = loadingSlot === slotKey;
                    const isConfirmed = confirmedSlot === slotKey;
                    const canBook = state === 'free' && auth.isAuthenticated && !atBookingLimit;

                    return (
                      <div
                        key={`${di}-${hour}-${minute}`}
                        className={[
                          'min-h-[3.5rem] md:min-h-[3rem] flex items-center justify-center border-t border-l border-slate-200 text-xs px-1 py-0.5 transition-colors relative',
                          SLOT_STATE_CLASSES[state],
                          isLoading && 'opacity-60 pointer-events-none',
                          isConfirmed && 'bg-indigo-100',
                          canBook && 'cursor-pointer hover:bg-indigo-50 group',
                        ].filter(Boolean).join(' ')}
                        onClick={() => handleSlotClick(dateStr, hour, minute)}
                        role={canBook ? 'button' : undefined}
                        title={
                          state === 'taken' && booking
                            ? `${booking.userName}${booking.userPhone ? ` · ${booking.userPhone}` : ''}`
                            : undefined
                        }
                      >
                        {isLoading && <span>⏳</span>}
                        {state === 'mine' && !isLoading && booking && (
                          <span className="flex flex-col items-center text-center gap-0.5 leading-tight break-words max-w-full font-bold text-indigo-700 text-sm">
                            <span>You</span>
                            <span className="flex gap-1 mt-0.5 justify-center">
                              <button className="px-1 bg-indigo-50 border border-indigo-200 rounded text-indigo-600 text-xs cursor-pointer leading-snug hover:bg-indigo-100" onClick={e => { e.stopPropagation(); setInfoBooking(booking); }} title="Info">ⓘ</button>
                              <button
                                className="block mt-0.5 px-1 bg-red-100 border border-red-300 rounded text-red-700 text-xs font-bold cursor-pointer leading-snug hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={e => { e.stopPropagation(); setConfirmBooking(booking); }}
                                disabled={cancellingBooking === booking.id}
                                title="Cancel"
                              >
                                {cancellingBooking === booking.id ? '…' : '×'}
                              </button>
                            </span>
                          </span>
                        )}
                        {state === 'taken' && !isLoading && booking && (
                          <span className="flex flex-col items-center text-center gap-0.5 leading-tight break-words max-w-full">
                            {auth.isAuthenticated
                              ? <><span className="text-red-700 font-semibold text-xs">{booking.userName}</span>
                                {booking.userPhone && <span className="text-red-700 text-[0.7rem] opacity-85">{booking.userPhone}</span>}
                                <span className="flex gap-1 mt-0.5 justify-center">
                                  <button className="px-1 bg-indigo-50 border border-indigo-200 rounded text-indigo-600 text-xs cursor-pointer leading-snug hover:bg-indigo-100" onClick={e => { e.stopPropagation(); setInfoBooking(booking); }} title="Info">ⓘ</button>
                                  {isAdmin && (
                                    <button
                                      className="block mt-0.5 px-1 bg-red-100 border border-red-300 rounded text-red-700 text-xs font-bold cursor-pointer leading-snug hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                      onClick={e => { e.stopPropagation(); setConfirmBooking(booking); }}
                                      disabled={cancellingBooking === booking.id}
                                      title="Cancel (admin)"
                                    >
                                      {cancellingBooking === booking.id ? '…' : '×'}
                                    </button>
                                  )}
                                </span></>
                              : <span className="text-red-700 font-semibold text-xs">Booked</span>
                            }
                          </span>
                        )}
                        {state === 'free' && !isLoading && auth.isAuthenticated && !atBookingLimit && (
                          <span className="flex flex-col items-center gap-px leading-none">
                            <span className="text-[0.7rem] font-semibold text-indigo-600 opacity-0 transition-opacity pointer-events-none group-hover:opacity-100">
                              {(() => {
                                const endTotalMin = hour * 60 + minute + slotDuration;
                                const endH = Math.floor(endTotalMin / 60);
                                const endM = endTotalMin % 60;
                                return `${hour}:${String(minute).padStart(2, '0')}–${endH}:${String(endM).padStart(2, '0')}`;
                              })()}
                            </span>
                            <span className="text-lg text-slate-300 transition-colors group-hover:text-indigo-600">+</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          );
        })()}
      </div>

      <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded border border-slate-300 bg-white" />Free</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded border border-slate-300 bg-indigo-100" />Your booking</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded border border-slate-300 bg-red-50" />Booked</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded border border-slate-300 bg-slate-100" />Past</span>
      </div>

      {infoBooking && (
        <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-[100]" onClick={() => setInfoBooking(null)}>
          <div className="bg-white rounded-2xl p-7 max-w-[360px] w-[90%] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-semibold text-slate-900">Booking info</h3>
            <div className="grid gap-x-4 gap-y-1.5 mb-5" style={{ gridTemplateColumns: 'auto 1fr' }}>
              {(infoBooking.userFirstName || infoBooking.userLastName) ? (
                <>
                  <div className="contents"><span className="font-semibold text-slate-500 text-sm whitespace-nowrap">First name</span><span className="text-slate-900 text-sm">{infoBooking.userFirstName || '–'}</span></div>
                  <div className="contents"><span className="font-semibold text-slate-500 text-sm whitespace-nowrap">Last name</span><span className="text-slate-900 text-sm">{infoBooking.userLastName || '–'}</span></div>
                </>
              ) : (
                <div className="contents"><span className="font-semibold text-slate-500 text-sm whitespace-nowrap">Name</span><span className="text-slate-900 text-sm">{infoBooking.userName || '–'}</span></div>
              )}
              <div className="contents"><span className="font-semibold text-slate-500 text-sm whitespace-nowrap">Phone</span><span className="text-slate-900 text-sm">{infoBooking.userPhone || '–'}</span></div>
              <div className="contents"><span className="font-semibold text-slate-500 text-sm whitespace-nowrap">Date</span><span className="text-slate-900 text-sm">📅 {infoBooking.date}</span></div>
              <div className="contents"><span className="font-semibold text-slate-500 text-sm whitespace-nowrap">Time</span><span className="text-slate-900 text-sm">⏰ {infoBooking.startTime.slice(0, 5)}–{infoBooking.endTime.slice(0, 5)} ({slotDuration} min)</span></div>
            </div>
            <div className="flex gap-3 justify-end">
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-lg px-5 py-2 text-sm font-semibold cursor-pointer transition-colors" onClick={() => setInfoBooking(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {confirmBooking && (
        <ConfirmDialog
          title="Cancel booking?"
          confirmLabel="Cancel booking"
          cancelLabel="Keep it"
          onConfirm={confirmAdminCancel}
          onCancel={() => setConfirmBooking(null)}
        >
          <div className="grid gap-x-4 gap-y-1.5" style={{ gridTemplateColumns: 'auto 1fr' }}>
            {confirmBooking.userId !== myUserId && (
              <>
                <div className="contents"><span className="font-semibold text-slate-500 text-sm whitespace-nowrap">First name</span><span className="text-slate-900 text-sm">{confirmBooking.userFirstName || '–'}</span></div>
                <div className="contents"><span className="font-semibold text-slate-500 text-sm whitespace-nowrap">Last name</span><span className="text-slate-900 text-sm">{confirmBooking.userLastName || '–'}</span></div>
                <div className="contents"><span className="font-semibold text-slate-500 text-sm whitespace-nowrap">Phone</span><span className="text-slate-900 text-sm">{confirmBooking.userPhone || '–'}</span></div>
              </>
            )}
            <div className="contents"><span className="font-semibold text-slate-500 text-sm whitespace-nowrap">Date</span><span className="text-slate-900 text-sm">📅 {confirmBooking.date}</span></div>
            <div className="contents"><span className="font-semibold text-slate-500 text-sm whitespace-nowrap">Time</span><span className="text-slate-900 text-sm">⏰ {confirmBooking.startTime.slice(0, 5)}–{confirmBooking.endTime.slice(0, 5)} ({slotDuration} min)</span></div>
          </div>
        </ConfirmDialog>
      )}

      {pendingSlot && (
        <ConfirmDialog
          title="Confirm booking"
          confirmLabel="Book slot"
          cancelLabel="Cancel"
          onConfirm={confirmSlotBooking}
          onCancel={() => setPendingSlot(null)}
        >
          <div className="grid gap-x-4 gap-y-1.5" style={{ gridTemplateColumns: 'auto 1fr' }}>
            <div className="contents"><span className="font-semibold text-slate-500 text-sm whitespace-nowrap">Date</span><span className="text-slate-900 text-sm">📅 {pendingSlot.dateStr}</span></div>
            <div className="contents">
              <span className="font-semibold text-slate-500 text-sm whitespace-nowrap">Time</span>
              <span className="text-slate-900 text-sm">
                ⏰ {pendingSlot.hour}:{String(pendingSlot.minute).padStart(2, '0')}–{(() => {
                  const endTotalMin = pendingSlot.hour * 60 + pendingSlot.minute + slotDuration;
                  const endH = Math.floor(endTotalMin / 60);
                  const endM = endTotalMin % 60;
                  return `${endH}:${String(endM).padStart(2, '0')}`;
                })()} ({slotDuration} min)
              </span>
            </div>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
