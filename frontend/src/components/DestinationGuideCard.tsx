import type { DestinationGuide } from '../hooks/useSSE'

interface DestinationGuideCardProps {
  guide: DestinationGuide
}

function shortDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

export function DestinationGuideCard({ guide }: DestinationGuideCardProps) {
  const forecast = guide.forecast ?? []
  const activities = guide.activities ?? []

  return (
    <section className="destination-guide-card">
      <div className="destination-guide-header">
        <div>
          <p className="destination-guide-overline">While Sabre secures your PNR</p>
          <h3 className="destination-guide-title">A quick look at {guide.destination}</h3>
        </div>
        <span className="destination-guide-live">Live</span>
      </div>

      <div>
        <p className="destination-guide-label">3-day forecast</p>
        {forecast.length > 0 ? (
          <div className="forecast-grid">
            {forecast.slice(0, 3).map((day) => (
              <div className="forecast-day" key={day.date}>
                <span className="forecast-weekday">{shortDate(day.date)}</span>
                <strong>{Math.round(day.high_f)}°</strong>
                <span>{Math.round(day.low_f)}° · {day.condition}</span>
                {day.precipitation_percent != null && (
                  <span>{Math.round(day.precipitation_percent)}% rain</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="destination-guide-placeholder">Miles is fetching the live forecast…</div>
        )}
      </div>

      <div>
        <p className="destination-guide-label">Three things worth doing</p>
        {activities.length > 0 ? (
          <div className="activity-list">
            {activities.slice(0, 3).map((activity, index) => (
              <div className="activity-item" key={`${activity.name}-${index}`}>
                <span className="activity-number">{index + 1}</span>
                <div>
                  <strong>{activity.name}</strong>
                  {(activity.category || activity.description) && (
                    <p>{[activity.category, activity.description].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="destination-guide-placeholder">Miles is finding three current recommendations…</div>
        )}
      </div>
    </section>
  )
}
