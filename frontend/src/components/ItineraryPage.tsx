import type { TripState, FlightOption, HotelOption, CarOption } from '../hooks/useSSE'

interface ItineraryPageProps {
  trip: TripState
  onCheckout: () => void
  onBack: () => void
}

function fmtTime(iso: string): string {
  const t = iso.split('T')[1] ?? iso
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  return `${h % 12 || 12}:${mStr ?? '00'}${h < 12 ? 'am' : 'pm'}`
}

function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid oklch(0.91 0.01 75)', borderRadius: 16, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'oklch(0.55 0.01 75)', textTransform: 'uppercase' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12.5, color: 'oklch(0.6 0.01 75)', minWidth: 90 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: accent ? 700 : 500, color: accent ? 'oklch(0.28 0.09 165)' : 'oklch(0.3 0.01 75)', flex: 1 }}>{value}</span>
    </div>
  )
}

export function ItineraryPage({ trip, onCheckout, onBack }: ItineraryPageProps) {
  const flight = trip.flight.options.find((o) => (o as FlightOption).id === trip.flight.selectedId) as FlightOption | undefined
    ?? (trip.flight.options[0] as FlightOption | undefined)
  const hotel = trip.hotel.options.find((o) => (o as HotelOption).id === trip.hotel.selectedId) as HotelOption | undefined
    ?? (trip.hotel.options[0] as HotelOption | undefined)
  const car = trip.car.options.find((o) => (o as CarOption).id === trip.car.selectedId) as CarOption | undefined

  const flightTotal = flight ? flight.price_usd : 0
  const hotelTotal = hotel ? hotel.rate_usd * hotel.nights : 0
  const carTotal = car ? car.total_usd : 0
  const grandTotal = trip.totalUsd ?? (flightTotal + hotelTotal + carTotal)

  const origin = flight?.origin ?? '—'
  const dest = flight?.destination ?? '—'
  const depDate = flight ? fmtDate(flight.depart) : '—'
  const retDate = hotel ? fmtDate(hotel.check_out) : '—'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'oklch(0.97 0.012 75)', overflowY: 'auto' }}>

      {/* Top bar */}
      <div style={{ padding: '14px 32px', borderBottom: '1px solid oklch(0.91 0.01 75)', background: 'oklch(0.985 0.006 75)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={onBack}
          style={{ border: '1px solid oklch(0.88 0.01 75)', background: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12.5, cursor: 'pointer', color: 'oklch(0.5 0.01 75)', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'oklch(0.28 0.01 75)' }}>
            {origin} → {dest}
          </span>
          <span style={{ fontSize: 13, color: 'oklch(0.55 0.01 75)', marginLeft: 12 }}>
            {depDate} – {retDate}
          </span>
        </div>
        {trip.pnr && (
          <div style={{ fontSize: 12.5, color: 'oklch(0.55 0.01 75)' }}>
            Confirmation: <strong style={{ color: 'oklch(0.45 0.09 165)', letterSpacing: '0.05em' }}>{trip.pnr}</strong>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '28px 32px 40px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 740 }}>

        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, fontStyle: 'italic', color: 'oklch(0.3 0.01 75)', marginBottom: 4 }}>
          Your itinerary
        </div>

        {/* Flight */}
        {flight ? (
          <Section label="Flight">
            <Row label="Route" value={`${flight.origin} → ${flight.destination}`} />
            <Row label="Departure" value={`${fmtDate(flight.depart)} at ${fmtTime(flight.depart)}`} />
            <Row label="Arrival" value={`${fmtDate(flight.arrive)} at ${fmtTime(flight.arrive)}`} />
            <Row label="Flight" value={`${flight.carrier} ${flight.flight_number}`} />
            <Row label="Stops" value={flight.stops === 0 ? 'Nonstop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`} />
            <Row label="Price" value={`$${flight.price_usd.toFixed(2)}`} accent />
          </Section>
        ) : (
          <Section label="Flight">
            <div style={{ fontSize: 12.5, color: 'oklch(0.6 0.01 75)' }}>{trip.flight.detail ?? 'No flight selected'}</div>
          </Section>
        )}

        {/* Hotel */}
        {hotel ? (
          <Section label="Hotel">
            <Row label="Property" value={hotel.name} />
            <Row label="Check-in" value={fmtDate(hotel.check_in)} />
            <Row label="Check-out" value={fmtDate(hotel.check_out)} />
            <Row label="Nights" value={String(hotel.nights)} />
            {hotel.amenities.length > 0 && (
              <Row label="Amenities" value={
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {hotel.amenities.slice(0, 4).map((a) => (
                    <span key={a} style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 10, background: 'oklch(0.93 0.03 165)', color: 'oklch(0.38 0.09 165)' }}>{a}</span>
                  ))}
                </div>
              } />
            )}
            <Row label="Rate" value={`$${hotel.rate_usd.toFixed(2)}/night · $${hotelTotal.toFixed(2)} total`} accent />
          </Section>
        ) : (
          <Section label="Hotel">
            <div style={{ fontSize: 12.5, color: 'oklch(0.6 0.01 75)' }}>{trip.hotel.detail ?? 'No hotel selected'}</div>
          </Section>
        )}

        {/* Car */}
        {car ? (
          <Section label="Car Rental">
            <Row label="Vendor" value={car.vendor} />
            <Row label="Category" value={`${car.category} · ${car.model}`} />
            <Row label="Pickup" value={`${fmtDate(car.pickup)} at ${fmtTime(car.pickup)}`} />
            <Row label="Dropoff" value={`${fmtDate(car.dropoff)} at ${fmtTime(car.dropoff)}`} />
            <Row label="Duration" value={`${car.days} day${car.days !== 1 ? 's' : ''}`} />
            <Row label="Price" value={`$${car.rate_usd_per_day.toFixed(2)}/day · $${car.total_usd.toFixed(2)} total`} accent />
          </Section>
        ) : (
          trip.car.status !== 'empty' && (
            <Section label="Car Rental">
              <div style={{ fontSize: 12.5, color: 'oklch(0.6 0.01 75)' }}>{trip.car.detail ?? 'No car rental'}</div>
            </Section>
          )
        )}

        {/* Total + CTA */}
        <div style={{ background: 'oklch(0.45 0.09 165)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'oklch(0.85 0.04 165)', marginBottom: 2 }}>Grand total</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
              ${grandTotal.toFixed(2)}
            </div>
            <div style={{ fontSize: 11.5, color: 'oklch(0.88 0.04 165)', marginTop: 2 }}>
              {[flight && 'flight', hotel && 'hotel', car && 'car'].filter(Boolean).join(' + ')}
            </div>
          </div>
          <button
            onClick={onCheckout}
            style={{ background: '#fff', color: 'oklch(0.38 0.09 165)', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'opacity .15s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Proceed to Checkout →
          </button>
        </div>
      </div>
    </div>
  )
}
