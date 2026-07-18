import type { TripState } from '../hooks/useSSE'
import { useLocalWeather } from '../hooks/useLocalWeather'
import { greetingForNow } from '../profile'
import {
  DESTINATION_IMAGE,
  daysUntil,
  destinationName,
  selectedFlight,
  statusLabel,
  tripDates,
} from '../tripView'

interface HomeDashboardProps {
  trip: TripState
  connecting: boolean
  firstName: string
  onPlanTrip: () => void
  onOpenTrip: () => void
}

const MicIcon = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 0 0-7 0v5A3.5 3.5 0 0 0 12 15Z" />
    <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21" />
  </svg>
)

export function HomeDashboard({
  trip,
  connecting,
  firstName,
  onPlanTrip,
  onOpenTrip,
}: HomeDashboardProps) {
  const flight = selectedFlight(trip)
  const destination = destinationName(flight?.destination)
  const countdown = daysUntil(flight?.depart)
  const hasTrip = Boolean(trip.pnr)
  const status = statusLabel(trip)
  const weather = useLocalWeather()

  return (
    <div className="prototype-page">
      <main className="home-shell">
        <header className="home-header">
          <div>
            <p className="eyebrow">Miles</p>
            <h1 className="home-title">{greetingForNow(firstName)}</h1>
          </div>
          <div className="weather-chip" aria-label="Weather in Mountain View">
            <span className="weather-icon">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
                <circle cx="12" cy="12" r="4.5" />
                <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2 6 6m12 12 1.8 1.8M2.5 12H5m14 0h2.5M4.2 19.8 6 18M18 6l1.8-1.8" />
              </svg>
            </span>
            <span>
              {weather
                ? <><strong>{weather.tempF}°F</strong> {weather.condition} · Mountain View</>
                : 'Mountain View, CA'}
            </span>
          </div>
        </header>

        <button
          className="primary-voice-cta"
          onClick={onPlanTrip}
          disabled={connecting}
        >
          <MicIcon />
          {connecting ? 'Connecting to Miles…' : 'Plan a new trip'}
        </button>

        <section className="prototype-section">
          <h2 className="prototype-section-title">Upcoming trips</h2>
          {hasTrip ? (
            <div className="trip-grid">
              <article
                className="prototype-trip-card"
                onClick={onOpenTrip}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onOpenTrip()
                }}
                role="button"
                tabIndex={0}
              >
                <div
                  className="prototype-trip-photo"
                  style={{ backgroundImage: `url("${DESTINATION_IMAGE}")` }}
                >
                  <span className={`trip-status-pill ${status === 'Disrupted' ? 'error' : status === 'Recovered' ? 'success' : ''}`}>
                    {status === 'Disrupted'
                      ? 'Flight cancelled'
                      : countdown != null
                        ? countdown === 0 ? 'Departs today' : `In ${countdown} days`
                        : status}
                  </span>
                </div>
                <div className="trip-perf" />
                <div className="trip-stub">
                  <p className="trip-destination">{destination}</p>
                  <p className="trip-date-line">{tripDates(trip)}</p>
                  <div className="trip-meta">
                    <strong>{status}</strong>
                    <code>{trip.pnr}</code>
                  </div>
                </div>
              </article>
            </div>
          ) : (
            <div className="empty-trips">
              No upcoming trip yet. Tell Miles where you want to go.
            </div>
          )}
        </section>

        <section className="prototype-section">
          <h2 className="prototype-section-title">Past trips</h2>
          <div className="trip-grid">
            <article className="prototype-trip-card past">
              <div
                className="prototype-trip-photo past"
                style={{ backgroundImage: `url("${DESTINATION_IMAGE}")` }}
              >
                <span className="past-trip-stamp">Travelled · May 2026</span>
              </div>
              <div className="trip-perf" />
              <div className="trip-stub">
                <p className="trip-destination">Dallas, TX</p>
                <p className="trip-date-line">May 8 – May 12, 2026</p>
                <div className="trip-meta">
                  <strong className="past-meta">Completed</strong>
                  <code>KXQJRM</code>
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  )
}
