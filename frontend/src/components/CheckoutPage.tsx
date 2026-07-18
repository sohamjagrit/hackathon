import { useState } from 'react'
import type { TripState, FlightOption, HotelOption, CarOption } from '../hooks/useSSE'

interface CheckoutPageProps {
  trip: TripState
  onBack: () => void
  onPaid: () => void
}

function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function LineItem({ label, sub, amount }: { label: string; sub?: string; amount: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid oklch(0.93 0.01 75)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'oklch(0.28 0.01 75)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'oklch(0.58 0.01 75)', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'oklch(0.3 0.01 75)', flexShrink: 0 }}>
        ${amount.toFixed(2)}
      </div>
    </div>
  )
}

export function CheckoutPage({ trip, onBack, onPaid }: CheckoutPageProps) {
  const [paying, setPaying] = useState(false)
  const [paid, setPaid] = useState(false)

  const flight = trip.flight.options.find((o) => (o as FlightOption).id === trip.flight.selectedId) as FlightOption | undefined
    ?? (trip.flight.options[0] as FlightOption | undefined)
  const hotel = trip.hotel.options.find((o) => (o as HotelOption).id === trip.hotel.selectedId) as HotelOption | undefined
    ?? (trip.hotel.options[0] as HotelOption | undefined)
  const car = trip.car.options.find((o) => (o as CarOption).id === trip.car.selectedId) as CarOption | undefined

  const flightTotal = flight ? flight.price_usd : 0
  const hotelTotal = hotel ? hotel.rate_usd * hotel.nights : 0
  const carTotal = car ? car.total_usd : 0
  const grandTotal = trip.totalUsd ?? (flightTotal + hotelTotal + carTotal)

  const handlePay = async () => {
    setPaying(true)
    // TODO: wire PayPal sandbox when PAYPAL_CLIENT_ID is set:
    // POST /api/paypal/create-order → { orderID }
    // open PayPal popup → capture
    // POST /api/paypal/capture-order → { transactionId }
    await new Promise((r) => setTimeout(r, 1800)) // simulate payment delay
    setPaid(true)
    setTimeout(onPaid, 1200)
  }

  if (paid) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, background: 'oklch(0.97 0.012 75)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'oklch(0.45 0.09 165)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeUp .4s ease' }}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'oklch(0.28 0.01 75)', animation: 'fadeUp .4s ease .1s both' }}>
          Payment confirmed!
        </div>
        <div style={{ fontSize: 14, color: 'oklch(0.55 0.01 75)', animation: 'fadeUp .4s ease .2s both' }}>
          PNR <strong style={{ color: 'oklch(0.45 0.09 165)' }}>{trip.pnr}</strong> — have a great trip ✈
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'oklch(0.97 0.012 75)', overflowY: 'auto' }}>

      {/* Top bar */}
      <div style={{ padding: '14px 32px', borderBottom: '1px solid oklch(0.91 0.01 75)', background: 'oklch(0.985 0.006 75)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={onBack}
          style={{ border: '1px solid oklch(0.88 0.01 75)', background: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12.5, cursor: 'pointer', color: 'oklch(0.5 0.01 75)', fontFamily: 'inherit' }}
        >
          ← Back
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'oklch(0.28 0.01 75)', flex: 1 }}>Checkout</span>
        {trip.pnr && (
          <span style={{ fontSize: 12.5, color: 'oklch(0.55 0.01 75)' }}>
            PNR: <strong style={{ color: 'oklch(0.45 0.09 165)', letterSpacing: '0.05em' }}>{trip.pnr}</strong>
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '32px', display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Left: price breakdown */}
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, fontStyle: 'italic', color: 'oklch(0.3 0.01 75)', marginBottom: 20 }}>
            Order summary
          </div>

          <div style={{ background: '#fff', border: '1px solid oklch(0.91 0.01 75)', borderRadius: 16, padding: '6px 20px 16px' }}>
            {flight && (
              <LineItem
                label={`${flight.carrier} ${flight.flight_number}`}
                sub={`${flight.origin} → ${flight.destination} · ${fmtDate(flight.depart)}`}
                amount={flightTotal}
              />
            )}
            {hotel && (
              <LineItem
                label={hotel.name}
                sub={`${hotel.nights} nights · ${fmtDate(hotel.check_in)} – ${fmtDate(hotel.check_out)}`}
                amount={hotelTotal}
              />
            )}
            {car && (
              <LineItem
                label={`${car.vendor} ${car.category}`}
                sub={`${car.days} days · ${fmtDate(car.pickup)}`}
                amount={carTotal}
              />
            )}
            {/* Total row */}
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: 14, marginTop: 4 }}>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'oklch(0.28 0.01 75)' }}>Total</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'oklch(0.28 0.01 75)' }}>${grandTotal.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Right: payment */}
        <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, fontStyle: 'italic', color: 'oklch(0.3 0.01 75)', marginBottom: 6 }}>
            Payment
          </div>

          {/* Pay button */}
          <button
            onClick={handlePay}
            disabled={paying}
            style={{
              width: '100%',
              padding: '16px',
              background: paying ? 'oklch(0.65 0.05 165)' : 'oklch(0.45 0.09 165)',
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              fontSize: 15,
              fontWeight: 700,
              cursor: paying ? 'default' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'background .2s',
            }}
          >
            {paying ? (
              <>
                <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                Processing…
              </>
            ) : (
              <>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x={1} y={4} width={22} height={16} rx={2} />
                  <line x1={1} y1={10} x2={23} y2={10} />
                </svg>
                Pay ${grandTotal.toFixed(2)}
              </>
            )}
          </button>

          <div style={{ fontSize: 11.5, color: 'oklch(0.6 0.01 75)', textAlign: 'center', lineHeight: 1.6 }}>
            Sandbox mode — no real charge.
            <br />
            {/* Wire PayPal here when PAYPAL_CLIENT_ID is set */}
            Secured by 256-bit TLS encryption.
          </div>

          {/* Security badges */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 4 }}>
            {['🔒 Secure', '✓ Encrypted', '↩ Refundable'].map((label) => (
              <div key={label} style={{ fontSize: 10.5, padding: '3px 10px', borderRadius: 20, background: 'oklch(0.93 0.02 75)', color: 'oklch(0.5 0.01 75)' }}>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
