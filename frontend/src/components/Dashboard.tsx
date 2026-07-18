import { useState } from 'react'
import { TripCard } from './TripCard'
import { DestinationGuideCard } from './DestinationGuideCard'
import { TripSummaryCard } from './TripSummaryCard'
import type { TripState } from '../hooks/useSSE'

interface DashboardProps {
  trip: TripState
  sessionId: string
  onViewItinerary: () => void
  onDisrupt?: () => Promise<void> | void
  phoneOnly?: boolean
}

const FlightIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#2743F4" strokeWidth={2} strokeLinecap="round">
    <path d="M2 12l19-9-6 19-4-8-9-2z" />
  </svg>
)

const HotelIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#2743F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21V8a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v13" />
    <path d="M3 12h18" /><path d="M7 21v-4" /><path d="M17 21v-4" />
  </svg>
)

export function Dashboard({ trip, sessionId, onViewItinerary, onDisrupt, phoneOnly }: DashboardProps) {
  const [disruptBusy, setDisruptBusy] = useState(false)
  const [disruptError, setDisruptError] = useState<string | null>(null)

  const flightActive = trip.flight.status !== 'empty'
  const hotelActive = trip.hotel.status !== 'empty'
  const anyActive = flightActive || hotelActive || Boolean(trip.tripSummary)
  const recovering =
    trip.flight.status === 'cancelled' ||
    trip.hotel.status === 'conflict' ||
    trip.hotel.status === 'pending_change' ||
    trip.hotelCallStatus === 'in_progress' ||
    trip.hotelCallStatus === 'failed'
  const recoveryDone =
    trip.hotelCallStatus === 'completed' &&
    trip.flight.status === 'confirmed' &&
    trip.hotel.status === 'confirmed'
  const allConfirmed = trip.pnr != null && !recovering
  const canDisrupt = Boolean(trip.pnr && onDisrupt && !recovering && !recoveryDone)
  const bookingInProgress = trip.bookingStatus === 'committing'

  const activeCount = [flightActive, hotelActive].filter(Boolean).length

  const handleDisrupt = async () => {
    if (!onDisrupt || disruptBusy) return
    setDisruptBusy(true)
    setDisruptError(null)
    try {
      await onDisrupt()
    } catch (e) {
      setDisruptError(e instanceof Error ? e.message : 'Failed to trigger disruption')
    } finally {
      setDisruptBusy(false)
    }
  }

  const heading = recovering
    ? 'Disruption'
    : bookingInProgress
      ? 'Confirming your trip'
    : recoveryDone
      ? 'Trip recovered'
      : 'Your trip'
  const subheading = recovering
    ? 'Live from the phone call — Miles is fixing what broke'
    : bookingInProgress
      ? 'Sabre is securing the PNR — this usually takes 45–90 seconds'
    : recoveryDone
      ? 'Flight rebooked · hotel confirmed · same PNR'
      : phoneOnly
        ? 'Spectator view — conversation is on your phone'
        : 'Options fill in live as Miles searches'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: '#FFF7E4' }}>

      {/* Status bar */}
      <div style={{
        padding: '11px 28px',
        borderBottom: '1px solid rgba(35,35,35,0.08)',
        background: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 44,
      }}>
        {bookingInProgress ? (
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: '#C8862E',
            fontWeight: 500,
            animation: 'captionIn .25s ease',
          }}>
            Securing your booking with Sabre… keep this call open
          </div>
        ) : trip.hotelCallStatus === 'in_progress' ? (
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: '#C8862E',
            fontWeight: 500,
            animation: 'captionIn .25s ease',
          }}>
            {trip.hotelCallContactMode === 'callback'
              ? 'Calling the hotel, then the traveler back…'
              : 'Calling the hotel on your behalf…'}
            {trip.hotelCallTranscript && (
              <span style={{ fontWeight: 400, color: 'rgba(35,35,35,0.5)', marginLeft: 8 }}>
                {trip.hotelCallTranscript}
              </span>
            )}
          </div>
        ) : recovering ? (
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: '#C8862E',
            fontWeight: 500,
            animation: 'captionIn .25s ease',
          }}>
            Disruption — recovering PNR <strong>{trip.pnr}</strong>
            {trip.hotelCallStatus === 'failed' && trip.hotelCallTranscript && (
              <span style={{ fontWeight: 400, color: 'rgba(35,35,35,0.5)', marginLeft: 8 }}>
                {trip.hotelCallTranscript}
              </span>
            )}
          </div>
        ) : recoveryDone || allConfirmed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, animation: 'captionIn .25s ease' }}>
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#2F6B4F',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13.5,
                fontWeight: 500,
                color: '#232323',
              }}>
                {recoveryDone ? 'Recovered' : 'Booked'} — <strong>{trip.pnr}</strong>
                {trip.totalUsd && (
                  <span style={{ color: '#2743F4', marginLeft: 8 }}>${trip.totalUsd} total</span>
                )}
              </span>
            </div>
            <div style={{ flex: 1 }} />
            {canDisrupt && (
              <button
                onClick={() => void handleDisrupt()}
                disabled={disruptBusy}
                style={{
                  background: 'transparent',
                  color: '#B23A2E',
                  border: '1px solid rgba(178,58,46,0.35)',
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: disruptBusy ? 'wait' : 'pointer',
                  opacity: disruptBusy ? 0.6 : 1,
                }}
              >
                {disruptBusy ? 'Calling traveler…' : 'Simulate cancellation'}
              </button>
            )}
            <button
              onClick={onViewItinerary}
              style={{
                background: '#2743F4',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 999,
                padding: '6px 16px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              View Itinerary →
            </button>
          </>
        ) : (
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12.5,
            color: 'rgba(35,35,35,0.42)',
          }}>
            Session{' '}
            <code style={{
              fontSize: 11,
              background: 'rgba(35,35,35,0.06)',
              padding: '1px 5px',
              borderRadius: 4,
              fontFamily: 'monospace',
            }}>
              {sessionId.slice(0, 8)}
            </code>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 32px' }}>

        {/* Idle / hero state */}
        {!anyActive && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            minHeight: 340,
            gap: 20,
            textAlign: 'center',
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'rgba(39,67,244,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#2743F4" strokeWidth={1.8} strokeLinecap="round">
                <path d="M2 12l19-9-6 19-4-8-9-2z" />
              </svg>
            </div>
            <div>
              <div style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 26,
                fontWeight: 600,
                color: '#232323',
                marginBottom: 8,
              }}>
                Where are you headed?
              </div>
              <div style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                color: 'rgba(35,35,35,0.45)',
                lineHeight: 1.65,
                maxWidth: 300,
              }}>
                Tap the mic and tell Miles your destination and dates.
                Flight and hotel options will appear here as you speak.
              </div>
            </div>
          </div>
        )}

        {/* Active cards */}
        {anyActive && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 26,
                fontWeight: 700,
                color: '#232323',
              }}>
                {heading}
              </div>
              <div style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12.5,
                color: 'rgba(35,35,35,0.42)',
                marginTop: 3,
              }}>
                {subheading}
              </div>
              {disruptError && (
                <div style={{
                  marginTop: 8,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12.5,
                  color: '#B23A2E',
                }}>
                  {disruptError}
                </div>
              )}
            </div>

            {/* Act 2 cascade banner */}
            {recovering && (
              <div style={{
                marginBottom: 16,
                padding: '14px 16px',
                borderRadius: 14,
                background: trip.hotelCallStatus === 'in_progress'
                  ? 'rgba(200,134,46,0.12)'
                  : 'rgba(178,58,46,0.08)',
                border: `1px solid ${trip.hotelCallStatus === 'in_progress'
                  ? 'rgba(200,134,46,0.35)'
                  : 'rgba(178,58,46,0.25)'}`,
                animation: 'fadeUp .25s ease',
              }}>
                <div style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#232323',
                  marginBottom: 6,
                }}>
                  {trip.hotelCallStatus === 'in_progress'
                    ? 'Miles is on hold with you — calling the hotel now'
                    : 'Outbound flight cancelled — downstream bookings broke'}
                </div>
                <div style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12.5,
                  color: 'rgba(35,35,35,0.55)',
                  lineHeight: 1.55,
                }}>
                  {trip.hotelCallStatus === 'in_progress'
                    ? (trip.hotelCallTranscript || 'Nested hotel call in progress. Dashboard updates when it finishes.')
                    : 'Flight went red. Hotel is amber because check-in no longer matches arrival — Miles is fixing both on one call.'}
                </div>
              </div>
            )}

            {recoveryDone && (
              <div style={{
                marginBottom: 16,
                padding: '14px 16px',
                borderRadius: 14,
                background: 'rgba(47,107,79,0.10)',
                border: '1px solid rgba(47,107,79,0.30)',
                animation: 'fadeUp .25s ease',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                color: '#2F6B4F',
                fontWeight: 500,
              }}>
                All set — flight rebooked, hotel dates confirmed, confirmation {trip.pnr}.
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: activeCount === 1 ? '1fr' : '1fr 1fr',
              gap: 14,
              maxWidth: activeCount === 1 ? 520 : 'none',
            }}>
              {trip.tripSummary && (
                <TripSummaryCard summary={trip.tripSummary} />
              )}
              {flightActive && (
                <TripCard title="Flights" icon={<FlightIcon />} kind="flight" leg={trip.flight} />
              )}
              {hotelActive && (
                <TripCard title="Hotel" icon={<HotelIcon />} kind="hotel" leg={trip.hotel} />
              )}
              {trip.destinationGuide && (
                <DestinationGuideCard guide={trip.destinationGuide} />
              )}

              {/* Summary / Act 2 call card */}
              {flightActive && hotelActive && (
                <div style={{
                  background: '#FFFFFF',
                  border: `1px solid ${trip.hotelCallStatus === 'in_progress'
                    ? 'rgba(200,134,46,0.40)'
                    : 'rgba(35,35,35,0.1)'}`,
                  borderRadius: 16,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  gridColumn: activeCount >= 2 ? '1 / -1' : undefined,
                  maxWidth: 520,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#2743F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.7 2.35a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.75.34 1.54.57 2.35.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <div style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13.5,
                      fontWeight: 600,
                      flex: 1,
                      color: '#232323',
                    }}>
                      {trip.hotelCallStatus === 'in_progress'
                        ? 'Hotel call'
                        : recovering
                          ? 'Recovery call'
                          : 'Summary'}
                    </div>
                    {trip.hotelCallStatus === 'in_progress' && (
                      <span style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#C8862E',
                        background: 'rgba(200,134,46,0.12)',
                        padding: '3px 8px',
                        borderRadius: 999,
                      }}>
                        Live
                      </span>
                    )}
                  </div>

                  {trip.hotelCallStatus === 'in_progress' ? (
                    <div style={{ animation: 'fadeUp .3s ease' }}>
                      <div style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 13,
                        color: '#232323',
                        lineHeight: 1.55,
                      }}>
                        {trip.hotelCallContactMode === 'callback'
                          ? 'The traveler chose to hang up. Miles is negotiating with the hotel, then will call them back.'
                          : 'Traveler is on hold. Miles is negotiating the new hotel dates with the front desk.'}
                      </div>
                      {trip.hotelCallTranscript && (
                        <div style={{
                          marginTop: 10,
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: '#FAFAF8',
                          border: '1px solid rgba(35,35,35,0.08)',
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: 12.5,
                          color: 'rgba(35,35,35,0.65)',
                          fontStyle: 'italic',
                        }}>
                          {trip.hotelCallTranscript}
                        </div>
                      )}
                    </div>
                  ) : trip.pnr ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, animation: 'fadeUp .3s ease' }}>
                      <div style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'rgba(35,35,35,0.45)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                      }}>
                        Confirmation
                      </div>
                      <div style={{
                        fontFamily: "'Bricolage Grotesque', sans-serif",
                        fontSize: 22,
                        fontWeight: 700,
                        color: recovering ? '#B23A2E' : '#2743F4',
                        letterSpacing: '0.04em',
                      }}>
                        {trip.pnr}
                      </div>
                      {trip.totalUsd && (
                        <div style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: 12.5,
                          color: 'rgba(35,35,35,0.5)',
                        }}>
                          Total: <strong style={{ color: '#232323' }}>${trip.totalUsd}</strong>
                        </div>
                      )}
                      {canDisrupt && (
                        <button
                          onClick={() => void handleDisrupt()}
                          disabled={disruptBusy}
                          style={{
                            marginTop: 4,
                            alignSelf: 'flex-start',
                            background: 'rgba(178,58,46,0.08)',
                            color: '#B23A2E',
                            border: '1px solid rgba(178,58,46,0.25)',
                            borderRadius: 999,
                            padding: '7px 14px',
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: disruptBusy ? 'wait' : 'pointer',
                            opacity: disruptBusy ? 0.6 : 1,
                          }}
                        >
                          {disruptBusy ? 'Triggering…' : 'Simulate flight cancellation'}
                        </button>
                      )}
                      {!recovering && (
                        <button
                          onClick={onViewItinerary}
                          style={{
                            marginTop: 4,
                            alignSelf: 'flex-start',
                            background: 'rgba(39,67,244,0.08)',
                            color: '#2743F4',
                            border: 'none',
                            borderRadius: 999,
                            padding: '7px 14px',
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          View full itinerary →
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      color: 'rgba(35,35,35,0.4)',
                      textAlign: 'center',
                      padding: '8px 0',
                    }}>
                      Booking summary appears after confirmation
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
