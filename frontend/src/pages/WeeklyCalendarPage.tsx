import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { bookingsApi, courtsApi, getUserRoles, setAuthToken, type Court, type CourtBooking } from '../api/client';
import './WeeklyCalendarPage.css';

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07–22
const DAY_NAMES = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

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
  const day = d.getDay(); // 0=Sun
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
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

type SlotState = 'past' | 'free' | 'mine' | 'taken';

interface SlotInfo {
  state: SlotState;
  booking?: CourtBooking;
}

export function WeeklyCalendarPage() {
  const { courtId } = useParams<{ courtId: string }>();
  const navigate = useNavigate();
  const auth = useAuth();

  const [court, setCourt] = useState<Court | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [courtBookings, setCourtBookings] = useState<CourtBooking[]>([]);
  const [myFutureCount, setMyFutureCount] = useState(0);
  const [cancellingBooking, setCancellingBooking] = useState<number | null>(null);
  const [confirmBooking, setConfirmBooking] = useState<CourtBooking | null>(null);
  const [infoBooking, setInfoBooking] = useState<CourtBooking | null>(null);
  const [loadingSlot, setLoadingSlot] = useState<string | null>(null); // "YYYY-MM-DD-HH"
  const [error, setError] = useState<string | null>(null);
  const [confirmedSlot, setConfirmedSlot] = useState<string | null>(null); // "YYYY-MM-DD-HH"

  const myUserId = auth.user?.profile.sub;
  const userRoles = getUserRoles(auth.user?.access_token);
  const isAdmin = userRoles.includes('admin');
  const isMember = userRoles.includes('member') || isAdmin;

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

  const loadBookings = useCallback(async () => {
    if (!courtId) return;
    try {
      const weekData = await bookingsApi.getForCourt(Number(courtId), weekFrom, weekTo);
      setCourtBookings(weekData);
      if (auth.isAuthenticated) {
        const myData = await bookingsApi.getMine();
        const now = new Date();
        const todayStr = toDateStr(now);
        const nowHour = now.getHours();
        const future = myData.filter(b =>
          b.date > todayStr || (b.date === todayStr && parseInt(b.startTime.slice(0, 2)) > nowHour)
        );
        setMyFutureCount(future.length);
      }
    } catch {
      setError('Kunde inte ladda bokningar.');
    }
  }, [courtId, weekFrom, weekTo, auth.isAuthenticated]);

  useEffect(() => {
    if (auth.user?.access_token) setAuthToken(auth.user.access_token);
    if (courtId) {
      courtsApi.getById(Number(courtId)).then(setCourt).catch(() => setError('Bana hittades inte.'));
    }
  }, [auth.user, courtId]);

  // Reset selected day when navigating to a different week
  useEffect(() => {
    const idx = weekDays.findIndex(d => toDateStr(d) === toDateStr(new Date()));
    setSelectedDayIndex(idx >= 0 ? idx : 0);
  }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  function getSlotInfo(dateStr: string, hour: number): SlotInfo {
    const now = new Date();
    const todayStr = toDateStr(now);
    const nowHour = now.getHours();

    const isPast = dateStr < todayStr || (dateStr === todayStr && hour <= nowHour);
    if (isPast) return { state: 'past' };

    const booking = courtBookings.find(b => {
      const bHour = parseInt(b.startTime.slice(0, 2));
      return b.date === dateStr && bHour === hour;
    });

    if (!booking) return { state: 'free' };
    if (booking.userId === myUserId) return { state: 'mine', booking };
    return { state: 'taken', booking };
  }

  async function handleSlotClick(dateStr: string, hour: number) {
    const slotKey = `${dateStr}-${hour}`;
    const { state } = getSlotInfo(dateStr, hour);

    if (state !== 'free') return;
    if (!isMember) return;
    if (!isAdmin && myFutureCount >= 2) {
      setError('Du kan inte ha fler än 2 kommande bokningar.');
      return;
    }
    if (!courtId) return;

    setLoadingSlot(slotKey);
    setError(null);
    try {
      await bookingsApi.create({ courtId: Number(courtId), date: dateStr, startHour: hour });
      setConfirmedSlot(slotKey);
      await loadBookings();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: string | { title?: string } } };
      const data = axiosErr?.response?.data;
      const msg = typeof data === 'string' ? data : data?.title;
      setError(msg ?? 'Bokning misslyckades. Försök igen.');
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
      setError('Kunde inte avboka. Försök igen.');
    } finally {
      setCancellingBooking(null);
    }
  }

  const atBookingLimit = !isAdmin && myFutureCount >= 2;

  return (
    <div className="weekly-page">
      <div className="weekly-header">
        <div className="weekly-title">
          <h1>Boka {court?.name ?? '...'}</h1>
          {court && (
            <span className={`surface-badge ${court.surface.toLowerCase()}`}>{court.surface}</span>
          )}
        </div>
        <div className="week-nav">
          <button
            className="btn-secondary"
            onClick={() => { setWeekStart(w => addDays(w, -7)); setConfirmedSlot(null); }}
          >
            ← Förra veckan
          </button>
          <span className="week-label">
            {formatDate(weekDays[0])} – {formatDate(weekDays[6])}
          </span>
          <button
            className="btn-secondary"
            onClick={() => { setWeekStart(w => addDays(w, 7)); setConfirmedSlot(null); }}
          >
            Nästa vecka →
          </button>
        </div>
      </div>

      {atBookingLimit && (
        <div className="booking-limit-notice">
          Du kan bara boka två tider. Avboka en för att kunna boka igen.{' '}
          <button className="link-btn" onClick={() => navigate('/my-bookings')}>Mina bokningar</button>
        </div>
      )}

      {auth.isAuthenticated && !isMember && (
        <div className="login-notice">
          Du behöver rollen <strong>Medlem</strong> för att kunna boka tider. Kontakta en administratör.
        </div>
      )}

      {!auth.isAuthenticated && (
        <div className="login-notice">
          <button className="link-btn" onClick={() => auth.signinRedirect()}>Logga in</button>
          {' '}för att boka en tid.
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {confirmedSlot && (
        <div className="success-notice">
          ✅ Bokning bekräftad!{' '}
          <button className="link-btn" onClick={() => navigate('/my-bookings')}>Visa mina bokningar</button>
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

              {/* Time rows */}
              {HOURS.map(hour => (
                <React.Fragment key={hour}>
                  <div className="time-label">{hour}:00</div>
                  {visibleDays.map((day, di) => {
                    const dateStr = toDateStr(day);
                    const slotKey = `${dateStr}-${hour}`;
                    const { state, booking } = getSlotInfo(dateStr, hour);
                    const isLoading = loadingSlot === slotKey;
                    const isConfirmed = confirmedSlot === slotKey;

                    return (
                      <div
                        key={`${di}-${hour}`}
                        className={`slot slot-${state}${isLoading ? ' slot-loading' : ''}${isConfirmed ? ' slot-confirmed' : ''}${state === 'free' && auth.isAuthenticated && isMember && !atBookingLimit ? ' slot-clickable' : ''}`}
                        onClick={() => handleSlotClick(dateStr, hour)}
                        role={state === 'free' && auth.isAuthenticated && isMember && !atBookingLimit ? 'button' : undefined}
                        title={
                          state === 'taken' && booking
                            ? `${booking.userName}${booking.userPhone ? ` · ${booking.userPhone}` : ''}`
                            : undefined
                        }
                      >
                        {isLoading && <span className="slot-spinner">⏳</span>}
                        {state === 'mine' && !isLoading && booking && (
                          <span className="slot-label">
                            <span>Du</span>
                            <span className="slot-actions">
                              <button
                                className="slot-info-btn"
                                onClick={e => { e.stopPropagation(); setInfoBooking(booking); }}
                                title="Visa info"
                              >ⓘ</button>
                              <button
                                className="slot-admin-cancel"
                                onClick={e => { e.stopPropagation(); setConfirmBooking(booking); }}
                                disabled={cancellingBooking === booking.id}
                                title="Avboka"
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
                                {booking.userPhone && (
                                  <span className="slot-phone">{booking.userPhone}</span>
                                )}
                                <span className="slot-actions">
                                  <button
                                    className="slot-info-btn"
                                    onClick={e => { e.stopPropagation(); setInfoBooking(booking); }}
                                    title="Visa info"
                                  >ⓘ</button>
                                  {isAdmin && (
                                    <button
                                      className="slot-admin-cancel"
                                      onClick={e => { e.stopPropagation(); setConfirmBooking(booking); }}
                                      disabled={cancellingBooking === booking.id}
                                      title="Avboka (admin)"
                                    >
                                      {cancellingBooking === booking.id ? '…' : '×'}
                                    </button>
                                  )}
                                </span></>
                              : <span className="slot-name">Bokad</span>
                            }
                          </span>
                        )}
                        {state === 'free' && !isLoading && auth.isAuthenticated && !atBookingLimit && (
                          <span className="slot-free-icon">
                            <span className="slot-hover-time">{hour}:00</span>
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
        <span className="legend-item"><span className="legend-swatch swatch-free" />Ledig</span>
        <span className="legend-item"><span className="legend-swatch swatch-mine" />Din bokning</span>
        <span className="legend-item"><span className="legend-swatch swatch-taken" />Bokad</span>
        <span className="legend-item"><span className="legend-swatch swatch-past" />Passerad</span>
      </div>

      {infoBooking && (
        <div className="confirm-overlay" onClick={() => setInfoBooking(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Bokningsinformation</h3>
            <div className="info-rows">
              {(infoBooking.userFirstName || infoBooking.userLastName) ? (
                <>
                  <div className="info-row">
                    <span className="info-label">Förnamn</span>
                    <span>{infoBooking.userFirstName || '–'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Efternamn</span>
                    <span>{infoBooking.userLastName || '–'}</span>
                  </div>
                </>
              ) : (
                <div className="info-row">
                  <span className="info-label">Namn</span>
                  <span>{infoBooking.userName || '–'}</span>
                </div>
              )}
              <div className="info-row">
                <span className="info-label">Telefon</span>
                <span>{infoBooking.userPhone || '–'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Datum</span>
                <span>📅 {infoBooking.date}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Tid</span>
                <span>⏰ {infoBooking.startTime.slice(0, 5)}–{infoBooking.endTime.slice(0, 5)}</span>
              </div>
            </div>
            <div className="confirm-actions">
              <button className="btn-primary" onClick={() => setInfoBooking(null)}>Stäng</button>
            </div>
          </div>
        </div>
      )}

      {confirmBooking && (
        <div className="confirm-overlay" onClick={() => setConfirmBooking(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Avboka bokning?</h3>
            <div className="info-rows">
              {confirmBooking.userId !== myUserId && (
                <>
                  <div className="info-row">
                    <span className="info-label">Förnamn</span>
                    <span>{confirmBooking.userFirstName || '–'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Efternamn</span>
                    <span>{confirmBooking.userLastName || '–'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Telefon</span>
                    <span>{confirmBooking.userPhone || '–'}</span>
                  </div>
                </>
              )}
              <div className="info-row">
                <span className="info-label">Datum</span>
                <span>📅 {confirmBooking.date}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Tid</span>
                <span>⏰ {confirmBooking.startTime.slice(0, 5)}–{confirmBooking.endTime.slice(0, 5)}</span>
              </div>
            </div>
            <div className="confirm-actions">
              <button className="btn-danger" onClick={confirmAdminCancel}>Avboka</button>
              <button className="btn-secondary" onClick={() => setConfirmBooking(null)}>Avbryt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
