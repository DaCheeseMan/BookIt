import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { bookingsApi, resourcesApi, tenantsApi, getUserRoles, setAuthToken, type Resource, type ResourceBooking } from '../api/client';
import './WeeklyCalendarPage.css';

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
  const [loadingSlot, setLoadingSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    }).then(setResource).catch(() => setError('Resource not found.'));
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

  async function handleSlotClick(dateStr: string, hour: number, minute: number) {
    const slotKey = `${dateStr}-${hour}-${minute}`;
    const { state } = getSlotInfo(dateStr, hour, minute);
    if (state !== 'free') return;
    if (!auth.isAuthenticated) return;
    if (!isAdmin && myFutureCount >= 3) {
      setError('You cannot have more than 3 upcoming bookings for this space.');
      return;
    }
    if (!resourceId || !tenantId) return;

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

  return (
    <div className="weekly-page">
      <div className="weekly-header">
        <div className="weekly-title">
          <h1>Book {resource?.name ?? '…'}</h1>
          {resource && (
            <span className="resource-type-badge">{resource.resourceType}</span>
          )}
        </div>
        <div className="week-nav">
          <button
            className="btn-secondary"
            onClick={() => { setWeekStart(w => addDays(w, -7)); setConfirmedSlot(null); }}
          >
            ← Prev week
          </button>
          <span className="week-label">
            {formatDate(weekDays[0])} – {formatDate(weekDays[6])}
          </span>
          <button
            className="btn-secondary"
            onClick={() => { setWeekStart(w => addDays(w, 7)); setConfirmedSlot(null); }}
          >
            Next week →
          </button>
        </div>
      </div>

      {atBookingLimit && (
        <div className="booking-limit-notice">
          You have reached the limit of 3 upcoming bookings.{' '}
          <button className="link-btn" onClick={() => navigate('/my-bookings')}>My bookings</button>
        </div>
      )}

      {!auth.isAuthenticated && (
        <div className="login-notice">
          <button className="link-btn" onClick={() => auth.signinRedirect()}>Sign in</button>
          {' '}to book a slot.
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {confirmedSlot && (
        <div className="success-notice">
          ✅ Booking confirmed!{' '}
          <button className="link-btn" onClick={() => navigate('/my-bookings')}>View my bookings</button>
        </div>
      )}

      {isMobile && (
        <div className="day-picker">
          {weekDays.map((day, i) => {
            const ds = toDateStr(day);
            const todayStr = toDateStr(new Date());
            return (
              <button
                key={i}
                className={`day-chip${selectedDayIndex === i ? ' day-chip--active' : ''}${ds === todayStr ? ' day-chip--today' : ''}`}
                onClick={() => setSelectedDayIndex(i)}
              >
                <span className="day-chip-name">{DAY_NAMES[i]}</span>
                <span className="day-chip-date">{formatDate(day)}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="calendar-scroll">
        {(() => {
          const visibleDays = isMobile ? [weekDays[selectedDayIndex]] : weekDays;
          return (
            <div className={`calendar-grid${isMobile ? ' calendar-grid--mobile' : ''}`}>
              {/* Header row */}
              <div className="time-header" />
              {visibleDays.map((day, i) => {
                const ds = toDateStr(day);
                const todayStr = toDateStr(new Date());
                const originalIdx = isMobile ? selectedDayIndex : i;
                return (
                  <div key={i} className={`day-header${ds === todayStr ? ' today' : ''}`}>
                    <span className="day-name">{DAY_NAMES[originalIdx]}</span>
                    <span className="day-date">{formatDate(day)}</span>
                  </div>
                );
              })}

              {/* Slot rows */}
              {SLOTS.map(({ hour, minute }) => (
                <React.Fragment key={`${hour}-${minute}`}>
                  <div className="time-label">
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
                        className={`slot slot-${state}${isLoading ? ' slot-loading' : ''}${isConfirmed ? ' slot-confirmed' : ''}${canBook ? ' slot-clickable' : ''}`}
                        onClick={() => handleSlotClick(dateStr, hour, minute)}
                        role={canBook ? 'button' : undefined}
                        title={
                          state === 'taken' && booking
                            ? `${booking.userName}${booking.userPhone ? ` · ${booking.userPhone}` : ''}`
                            : undefined
                        }
                      >
                        {isLoading && <span className="slot-spinner">⏳</span>}
                        {state === 'mine' && !isLoading && booking && (
                          <span className="slot-label">
                            <span>You</span>
                            <span className="slot-actions">
                              <button className="slot-info-btn" onClick={e => { e.stopPropagation(); setInfoBooking(booking); }} title="Info">ⓘ</button>
                              <button
                                className="slot-admin-cancel"
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
                          <span className="slot-label">
                            {auth.isAuthenticated
                              ? <><span className="slot-name">{booking.userName}</span>
                                {booking.userPhone && <span className="slot-phone">{booking.userPhone}</span>}
                                <span className="slot-actions">
                                  <button className="slot-info-btn" onClick={e => { e.stopPropagation(); setInfoBooking(booking); }} title="Info">ⓘ</button>
                                  {isAdmin && (
                                    <button
                                      className="slot-admin-cancel"
                                      onClick={e => { e.stopPropagation(); setConfirmBooking(booking); }}
                                      disabled={cancellingBooking === booking.id}
                                      title="Cancel (admin)"
                                    >
                                      {cancellingBooking === booking.id ? '…' : '×'}
                                    </button>
                                  )}
                                </span></>
                              : <span className="slot-name">Booked</span>
                            }
                          </span>
                        )}
                        {state === 'free' && !isLoading && auth.isAuthenticated && !atBookingLimit && (
                          <span className="slot-free-icon">
                            <span className="slot-hover-time">
                              {hour}:{String(minute).padStart(2, '0')}
                            </span>
                            <span className="slot-plus">+</span>
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

      <div className="calendar-legend">
        <span className="legend-item"><span className="legend-swatch swatch-free" />Free</span>
        <span className="legend-item"><span className="legend-swatch swatch-mine" />Your booking</span>
        <span className="legend-item"><span className="legend-swatch swatch-taken" />Booked</span>
        <span className="legend-item"><span className="legend-swatch swatch-past" />Past</span>
      </div>

      {infoBooking && (
        <div className="confirm-overlay" onClick={() => setInfoBooking(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Booking info</h3>
            <div className="info-rows">
              {(infoBooking.userFirstName || infoBooking.userLastName) ? (
                <>
                  <div className="info-row"><span className="info-label">First name</span><span>{infoBooking.userFirstName || '–'}</span></div>
                  <div className="info-row"><span className="info-label">Last name</span><span>{infoBooking.userLastName || '–'}</span></div>
                </>
              ) : (
                <div className="info-row"><span className="info-label">Name</span><span>{infoBooking.userName || '–'}</span></div>
              )}
              <div className="info-row"><span className="info-label">Phone</span><span>{infoBooking.userPhone || '–'}</span></div>
              <div className="info-row"><span className="info-label">Date</span><span>📅 {infoBooking.date}</span></div>
              <div className="info-row"><span className="info-label">Time</span><span>⏰ {infoBooking.startTime.slice(0, 5)}–{infoBooking.endTime.slice(0, 5)}</span></div>
            </div>
            <div className="confirm-actions">
              <button className="btn-primary" onClick={() => setInfoBooking(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {confirmBooking && (
        <div className="confirm-overlay" onClick={() => setConfirmBooking(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Cancel booking?</h3>
            <div className="info-rows">
              {confirmBooking.userId !== myUserId && (
                <>
                  <div className="info-row"><span className="info-label">First name</span><span>{confirmBooking.userFirstName || '–'}</span></div>
                  <div className="info-row"><span className="info-label">Last name</span><span>{confirmBooking.userLastName || '–'}</span></div>
                  <div className="info-row"><span className="info-label">Phone</span><span>{confirmBooking.userPhone || '–'}</span></div>
                </>
              )}
              <div className="info-row"><span className="info-label">Date</span><span>📅 {confirmBooking.date}</span></div>
              <div className="info-row"><span className="info-label">Time</span><span>⏰ {confirmBooking.startTime.slice(0, 5)}–{confirmBooking.endTime.slice(0, 5)}</span></div>
            </div>
            <div className="confirm-actions">
              <button className="btn-danger" onClick={confirmAdminCancel}>Cancel booking</button>
              <button className="btn-secondary" onClick={() => setConfirmBooking(null)}>Keep it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
