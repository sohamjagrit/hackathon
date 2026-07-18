import type { TripSummary } from '../hooks/useSSE'
import { destinationName, formatDate } from '../tripView'

interface TripSummaryCardProps {
  summary: TripSummary
}

export function TripSummaryCard({ summary }: TripSummaryCardProps) {
  const tripType = summary.trip_type === 'one-way' ? 'One-way' : summary.trip_type === 'round-trip' ? 'Round trip' : 'Trip'
  const travelers = summary.travelers ?? 1

  return (
    <section className="trip-summary-card" aria-label="Trip summary">
      <div className="trip-summary-header">
        <p className="destination-guide-overline">Your trip</p>
        <span className="trip-summary-type">{tripType}</span>
      </div>
      <h3 className="trip-summary-route">
        {summary.origin ? `${destinationName(summary.origin)} → ` : ''}
        {destinationName(summary.destination)}
      </h3>
      <div className="trip-summary-facts">
        <div>
          <p className="bp-field-label">Departs</p>
          <p className="bp-field-value">{formatDate(summary.depart_date)}</p>
        </div>
        {summary.return_date && (
          <div>
            <p className="bp-field-label">Returns</p>
            <p className="bp-field-value">{formatDate(summary.return_date)}</p>
          </div>
        )}
        <div>
          <p className="bp-field-label">Travelers</p>
          <p className="bp-field-value">{travelers}</p>
        </div>
      </div>
    </section>
  )
}
