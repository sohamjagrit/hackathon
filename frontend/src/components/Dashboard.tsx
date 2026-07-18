import { TripCard } from './TripCard'
import type { TripState } from '../hooks/useSSE'

interface DashboardProps {
  trip: TripState
  sessionId: string
  onViewItinerary: () => void
}

const FlightIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="oklch(0.45 0.09 165)" strokeWidth={2} strokeLinecap="round">
    <path d="M2 12l19-9-6 19-4-8-9-2z" />
  </svg>
)

const HotelIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="oklch(0.45 0.09 165)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21V8a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v13" />
    <path d="M3 12h18" /><path d="M7 21v-4" /><path d="M17 21v-4" />
  </svg>
)

export function Dashboard({ trip, sessionId, onViewItinerary }: DashboardProps) {
  const flightActive = trip.flight.status !== 'empty'
  const hotelActive = trip.hotel.status !== 'empty'
  const anyActive = flightActive || hotelActive
  const allConfirmed = trip.pnr != null

  const activeCount = [flightActive, hotelActive].filter(Boolean).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'oklch(0.97 0.012 75)' }}>

      {/* Status bar */}
      <div style={{ padding: '11px 28px', borderBottom: '1px solid oklch(0.92 0.01 75)', background: 'oklch(0.985 0.006 75)', display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 }}>
        {allConfirmed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, animation: 'captionIn .25s ease' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'oklch(0.45 0.09 165)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 500, color: 'oklch(0.28 0.01 75)' }}>
                Booked — <strong>{trip.pnr}</strong>
                {trip.totalUsd && <span style={{ color: 'oklch(0.45 0.09 165)', marginLeft: 8 }}>${trip.totalUsd} total</span>}
              </span>
            </div>
            <div style={{ flex: 1 }} />
            <button
              onClick={onViewItinerary}
              style={{ background: 'oklch(0.45 0.09 165)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              View Itinerary →
            </button>
          </>
        ) : trip.hotelCallStatus === 'in_progress' ? (
          <div style={{ fontSize: 13, color: 'oklch(0.45 0.09 55)', fontWeight: 500 }}>
            📞 Hotel call in progress…
            {trip.hotelCallTranscript && (
              <span style={{ fontWeight: 400, color: 'oklch(0.55 0.01 75)', marginLeft: 8 }}>{trip.hotelCallTranscript}</span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: 'oklch(0.6 0.01 75)' }}>
            Session <code style={{ fontSize: 11, background: 'oklch(0.94 0.01 75)', padding: '1px 5px', borderRadius: 4 }}>{sessionId.slice(0, 8)}</code>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 32px' }}>

        {/* Hero / idle state */}
        {!anyActive && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 340, gap: 16, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'oklch(0.93 0.05 165)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="oklch(0.45 0.09 165)" strokeWidth={1.8} strokeLinecap="round">
                <path d="M2 12l19-9-6 19-4-8-9-2z" />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, fontStyle: 'italic', color: 'oklch(0.3 0.01 75)', marginBottom: 6 }}>
                Where are you headed?
              </div>
              <div style={{ fontSize: 13, color: 'oklch(0.6 0.01 75)', lineHeight: 1.6, maxWidth: 320 }}>
                Tap the mic and tell Miles your destination and dates.
                Flight and hotel options will appear here as you speak.
              </div>
            </div>
          </div>
        )}

        {/* Active cards */}
        {anyActive && (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, fontStyle: 'italic', color: 'oklch(0.3 0.01 75)' }}>
                Your trip
              </div>
              <div style={{ fontSize: 12, color: 'oklch(0.58 0.01 75)', marginTop: 2 }}>
                Options fill in live as Miles searches
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: activeCount === 1 ? '1fr' : '1fr 1fr',
              gap: 14,
              maxWidth: activeCount === 1 ? 520 : 'none',
            }}>
              {flightActive && (
                <TripCard title="Flights" icon={<FlightIcon />} kind="flight" leg={trip.flight} />
              )}
              {hotelActive && (
                <TripCard title="Hotel" icon={<HotelIcon />} kind="hotel" leg={trip.hotel} />
              )}

              {/* Summary card — shown once both legs are active */}
              {flightActive && hotelActive && (
                <div style={{ background: '#fff', border: '1px solid oklch(0.91 0.01 75)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="oklch(0.45 0.09 165)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x={3} y={4} width={18} height={18} rx={2} /><line x1={16} y1={2} x2={16} y2={6} /><line x1={8} y1={2} x2={8} y2={6} /><line x1={3} y1={10} x2={21} y2={10} />
                    </svg>
                    <div style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>Summary</div>
                  </div>
                  {trip.pnr ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, animation: 'fadeUp .3s ease' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.45 0.01 75)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confirmation</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: 'oklch(0.45 0.09 165)', letterSpacing: '0.06em' }}>{trip.pnr}</div>
                      {trip.totalUsd && <div style={{ fontSize: 12.5, color: 'oklch(0.55 0.01 75)' }}>Total: <strong>${trip.totalUsd}</strong></div>}
                      <button onClick={onViewItinerary} style={{ marginTop: 4, background: 'oklch(0.93 0.06 165)', color: 'oklch(0.35 0.09 165)', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        View full itinerary →
                      </button>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'oklch(0.65 0.01 75)', textAlign: 'center', padding: '8px 0' }}>
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
