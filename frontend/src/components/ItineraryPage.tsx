import type { LegStatus, TripState } from '../hooks/useSSE'
import {
  DESTINATION_IMAGE,
  daysUntil,
  destinationName,
  formatDate,
  formatTime,
  priceParts,
  selectedFlight,
  selectedHotel,
} from '../tripView'

interface ItineraryPageProps {
  trip: TripState
  phoneOnly?: boolean
  disrupting?: boolean
  voiceConnected?: boolean
  onCheckout: () => void
  onBack: () => void
  onDisrupt?: () => Promise<void> | void
  onToggleVoice?: () => void
}

function stateLabel(status: LegStatus): string {
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'conflict') return 'Conflict'
  if (status === 'pending_change') return 'Updating'
  return 'Confirmed'
}

function stateClass(status: LegStatus): 'cancelled' | 'conflict' | 'confirmed' {
  if (status === 'cancelled') return 'cancelled'
  if (status === 'conflict' || status === 'pending_change') return 'conflict'
  return 'confirmed'
}

export function ItineraryPage({
  trip,
  phoneOnly,
  disrupting,
  voiceConnected,
  onCheckout,
  onBack,
  onDisrupt,
  onToggleVoice,
}: ItineraryPageProps) {
  const flight = selectedFlight(trip)
  const hotel = selectedHotel(trip)
  const { flightTotal, hotelTotal, addonsTotal, fees, total } = priceParts(trip)
  const destination = destinationName(flight?.destination)
  const countdown = daysUntil(flight?.depart)
  const recovering =
    trip.flight.status === 'cancelled' ||
    trip.hotel.status === 'conflict' ||
    trip.hotel.status === 'pending_change' ||
    trip.hotelCallStatus === 'in_progress' ||
    trip.hotelCallStatus === 'failed'
  const recovered = trip.hotelCallStatus === 'completed'
  const callbackMode = trip.hotelCallContactMode === 'callback'
  const travelerOnHold = trip.hotelCallStatus === 'in_progress' && !callbackMode
  const callbackQueued = trip.travelerCallbackStatus === 'queued'
  const callbackCalling = trip.travelerCallbackStatus === 'calling'
  const flightNumbers = String(flight?.flight_number || '').split('/').map((value) => value.trim())
  const outboundNumber = flightNumbers[0] || flight?.flight_number
  const returnNumber = flight?.return_flight_number || flightNumbers[1]
  const hasReturn = Boolean(returnNumber || flight?.return_depart)

  return (
    <div className="prototype-page">
      <div
        className="detail-hero"
        style={{ backgroundImage: `url("${DESTINATION_IMAGE}")` }}
      >
        {!phoneOnly && <button className="detail-back" onClick={onBack}>← Home</button>}
        <div className="detail-hero-content">
          <p className="eyebrow">{recovering ? 'Miles is recovering your trip to' : 'Your next trip to'}</p>
          <h1 className="detail-title">{destination}</h1>
          <span className="countdown-pill">
            {recovering
              ? 'Live recovery · phone only'
              : flight?.depart
                ? `Departs ${formatDate(flight.depart)}`
                : `Confirmation ${trip.pnr ?? 'pending'}`}
          </span>
        </div>
      </div>

      <main className="detail-shell">
        <div className="stats-row">
          <div className="stat-card">
            <p className="stat-label">Your trip starts in</p>
            <p className="stat-value">
              {countdown == null ? 'Confirmed' : countdown === 0 ? 'Today' : `${countdown} days`}
            </p>
            <p className="stat-sub">{formatDate(flight?.depart)}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Confirmation</p>
            <p className="stat-value">{trip.pnr ?? 'Pending'}</p>
            <p className="stat-sub">
              {recovered ? 'Recovered under the same PNR' : 'Flight + hotel'}
            </p>
          </div>
        </div>

        {trip.flight.status === 'cancelled' && (
          <div className="recovery-alert error">
            <p>
              <strong>Your outbound flight was cancelled.</strong>{' '}
              Your hotel check-in is now in conflict. Miles is calling your phone to fix both.
            </p>
          </div>
        )}

        {phoneOnly && !recovering && !recovered && (
          <div className="recovery-alert">
            <p>
              <strong>Miles is calling your phone.</strong>{' '}
              Answer there—this browser is now a read-only spectator view.
            </p>
          </div>
        )}

        {travelerOnHold && (
          <div className="recovery-alert">
            <p>
              <strong>You’re on hold while Miles calls the hotel.</strong>{' '}
              {trip.hotelCallTranscript || 'The nested front-desk call is in progress.'}
            </p>
          </div>
        )}

        {callbackMode && trip.hotelCallStatus === 'in_progress' && (
          <div className="recovery-alert">
            <p>
              <strong>You chose a callback.</strong>{' '}
              Miles is speaking with the hotel now and will call as soon as that call finishes.
            </p>
          </div>
        )}

        {(callbackQueued || callbackCalling) && (
          <div className="recovery-alert">
            <p>
              <strong>{callbackCalling ? 'Miles is calling the traveler back now.' : 'Traveler callback queued.'}</strong>{' '}
              {trip.travelerCallbackTranscript}
            </p>
          </div>
        )}

        {trip.hotelCallStatus === 'failed' && (
          <div className="recovery-alert error">
            <p><strong>The hotel call needs attention.</strong> {trip.hotelCallTranscript}</p>
          </div>
        )}

        {recovered && (
          <div className="recovery-alert success">
            <p>
              <strong>Trip recovered.</strong> Your flight and hotel are confirmed under {trip.pnr}.
            </p>
          </div>
        )}

        {!recovering && !recovered && onDisrupt && (
          <div className="prototype-section compact">
            <div className="act2-launch-card">
              <div className="act2-launch-copy">
                <p className="act2-launch-label">Act 2 · Two days later</p>
                <h2 className="act2-launch-title">Show disruption recovery</h2>
                <p className="act2-launch-body">
                  Cancel the outbound flight, mark the hotel at risk, and have Miles call the traveler to recover both.
                </p>
              </div>
              <button
                className="danger-demo-button"
                onClick={() => void onDisrupt()}
                disabled={disrupting}
              >
                {disrupting ? 'Calling traveler…' : 'Simulate cancellation'}
              </button>
            </div>
          </div>
        )}

        {(phoneOnly || recovering || recovered) && (
          <div className="recovery-timeline" aria-label="Recovery progress">
            <div className="recovery-step done">
              <span className="recovery-step-index">Step 1</span>
              <p className="recovery-step-title">Disruption detected</p>
              <p className="recovery-step-detail">Flight cancelled · hotel at risk</p>
            </div>
            <div className={`recovery-step ${travelerOnHold || callbackMode || recovered ? 'done' : 'active'}`}>
              <span className="recovery-step-index">Step 2</span>
              <p className="recovery-step-title">Traveler call</p>
              <p className="recovery-step-detail">{travelerOnHold || callbackMode || recovered ? 'Flight approved' : 'Miles is calling'}</p>
            </div>
            <div className={`recovery-step ${recovered ? 'done' : travelerOnHold || callbackMode ? 'active' : ''}`}>
              <span className="recovery-step-index">Step 3</span>
              <p className="recovery-step-title">Hotel call</p>
              <p className="recovery-step-detail">{recovered ? 'Dates confirmed' : travelerOnHold ? 'Nested call live' : callbackMode ? 'Calling front desk' : 'Waiting for approval'}</p>
            </div>
            <div className={`recovery-step ${recovered ? 'done' : ''}`}>
              <span className="recovery-step-index">Step 4</span>
              <p className="recovery-step-title">Recovered</p>
              <p className="recovery-step-detail">{recovered ? `PNR ${trip.pnr}` : 'Pending'}</p>
            </div>
          </div>
        )}

        <section className="prototype-section compact">
          <h2 className="prototype-section-title">Itinerary</h2>

          <article className={`boarding-card ${stateClass(trip.flight.status)}`}>
            <div className="bp-main">
              <div className="bp-type">
                <div className="bp-type-icon">
                  <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                    <path d="M2.5 12.5 21 6l-6.5 18.5-2.5-8-8-2.5Z" transform="translate(0 -3)" />
                  </svg>
                </div>
                <p className="bp-type-label">
                  {flight ? `${flight.airline_name || flight.carrier} · ${outboundNumber}` : 'Outbound flight'}
                </p>
                <span className={`leg-state-pill ${stateClass(trip.flight.status)}`}>
                  {stateLabel(trip.flight.status)}
                </span>
              </div>
              <p className="bp-route">
                {flight?.origin ?? 'Origin'} <span>→</span> {flight?.destination ?? 'Destination'}
              </p>
              <div className="bp-fields">
                <div><p className="bp-field-label">Date</p><p className="bp-field-value">{formatDate(flight?.depart)}</p></div>
                <div><p className="bp-field-label">Departs</p><p className="bp-field-value">{formatTime(flight?.depart)}</p></div>
                <div><p className="bp-field-label">Arrives</p><p className="bp-field-value">{formatTime(flight?.arrive)}</p></div>
                <div><p className="bp-field-label">Seat</p><p className="bp-field-value">{trip.seats?.assigned ?? 'Not assigned'}</p></div>
              </div>
            </div>
            <div className="bp-divider"><span className="bp-notch top" /><span className="bp-notch bottom" /></div>
            <div className="bp-stub">
              <div className="bp-barcode" />
              <p className="bp-stub-price">${flightTotal.toFixed(0)}</p>
              <p className="bp-stub-code">{trip.pnr}</p>
            </div>
          </article>

          {hasReturn && (
            <article className={`boarding-card ${stateClass(trip.flight.status)}`}>
              <div className="bp-main">
                <div className="bp-type">
                  <div className="bp-type-icon">
                    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                      <path d="M21.5 12.5 3 6l6.5 18.5 2.5-8 8-2.5Z" transform="translate(0 -3)" />
                    </svg>
                  </div>
                  <p className="bp-type-label">
                    Return · {flight?.airline_name || flight?.carrier} · {returnNumber}
                  </p>
                  <span className={`leg-state-pill ${stateClass(trip.flight.status)}`}>
                    {stateLabel(trip.flight.status)}
                  </span>
                </div>
                <p className="bp-route">
                  {flight?.return_origin || flight?.destination || 'Destination'} <span>→</span>{' '}
                  {flight?.return_destination || flight?.origin || 'Origin'}
                </p>
                <div className="bp-fields">
                  <div><p className="bp-field-label">Date</p><p className="bp-field-value">{formatDate(flight?.return_depart || hotel?.check_out)}</p></div>
                  <div><p className="bp-field-label">Departs</p><p className="bp-field-value">{flight?.return_depart ? formatTime(flight.return_depart) : 'See booking'}</p></div>
                  <div><p className="bp-field-label">Arrives</p><p className="bp-field-value">{flight?.return_arrive ? formatTime(flight.return_arrive) : 'See booking'}</p></div>
                  <div><p className="bp-field-label">Seat</p><p className="bp-field-value">Not assigned</p></div>
                </div>
              </div>
              <div className="bp-divider"><span className="bp-notch top" /><span className="bp-notch bottom" /></div>
              <div className="bp-stub">
                <div className="bp-barcode" />
                <p className="bp-stub-price">Included</p>
                <p className="bp-stub-code">{trip.pnr}</p>
              </div>
            </article>
          )}

          <article className={`boarding-card ${stateClass(trip.hotel.status)}`}>
            <div className="bp-main">
              <div className="bp-type">
                <div className="bp-type-icon">
                  <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 21V9l8-5 8 5v12" /><path d="M9 21v-6h6v6" />
                  </svg>
                </div>
                <p className="bp-type-label">{hotel?.name ?? 'Hotel'}</p>
                <span className={`leg-state-pill ${stateClass(trip.hotel.status)}`}>
                  {stateLabel(trip.hotel.status)}
                </span>
              </div>
              <p className="bp-route">{hotel?.nights ?? '—'} nights</p>
              <div className="bp-fields">
                <div><p className="bp-field-label">Check-in</p><p className="bp-field-value">{formatDate(hotel?.check_in, false)}</p></div>
                <div><p className="bp-field-label">Check-out</p><p className="bp-field-value">{formatDate(hotel?.check_out, false)}</p></div>
                <div><p className="bp-field-label">Area</p><p className="bp-field-value">{hotel?.area ?? flight?.destination ?? '—'}</p></div>
                <div><p className="bp-field-label">Rate</p><p className="bp-field-value">{hotel?.rate_usd ? `$${hotel.rate_usd}/night` : 'Confirmed'}</p></div>
              </div>
            </div>
            <div className="bp-divider"><span className="bp-notch top" /><span className="bp-notch bottom" /></div>
            <div className="bp-stub">
              <div className="bp-barcode" />
              <p className="bp-stub-price">${hotelTotal.toFixed(0)}</p>
              <p className="bp-stub-code">{hotel?.property_id ?? trip.pnr}</p>
            </div>
          </article>
        </section>

        <section className="prototype-section compact">
          <h2 className="prototype-section-title">Travelers</h2>
          <div className="travelers-row">
            <div className="traveler-chip">
              <span className="traveler-avatar">T</span>
              <span className="traveler-name">Primary traveler</span>
            </div>
          </div>
        </section>

        <section className="prototype-section compact">
          <h2 className="prototype-section-title">Total cost</h2>
          <div className="cost-card">
            <div className="cost-row"><span>Flight</span><span>${flightTotal.toFixed(2)}</span></div>
            <div className="cost-row"><span>Hotel · {hotel?.nights ?? 0} nights</span><span>${hotelTotal.toFixed(2)}</span></div>
            {addonsTotal > 0 && <div className="cost-row"><span>Add-ons</span><span>${addonsTotal.toFixed(2)}</span></div>}
            {fees > 0 && <div className="cost-row"><span>Taxes & fees</span><span>${fees.toFixed(2)}</span></div>}
            <div className="cost-row total"><span>Total</span><span>${total.toFixed(2)}</span></div>
          </div>
        </section>

        <section className="prototype-section compact">
          <h2 className="prototype-section-title">Booking</h2>
          <div className="payment-card">
            <div>
              <p className="payment-status">Sabre booking confirmed</p>
              <p className="payment-sub">PNR {trip.pnr} · {trip.transactionId ? `Transaction ${trip.transactionId}` : 'Payment not captured in app'}</p>
            </div>
            {!phoneOnly && (
              <button className="primary-checkout-button" onClick={onCheckout}>
                Pay securely with PayPal
              </button>
            )}
          </div>
        </section>

        <section className="prototype-section compact">
          <h2 className="prototype-section-title">Add-ons</h2>
          <div className="cost-card">
            <div className="cost-row">
              <span>Seat assignment</span>
              <span>{trip.seats?.assigned ?? 'None attached'}</span>
            </div>
            {(trip.addons ?? []).map((addon) => (
              <div className="cost-row" key={`${addon.code ?? addon.name}`}>
                <span>
                  {addon.name}
                  {addon.code && <code className="addon-code">{addon.code}</code>}
                  {addon.detail && <em className="addon-detail">{addon.detail}</em>}
                </span>
                <span>{addon.price_usd != null ? `$${addon.price_usd.toFixed(2)}` : 'Included'}</span>
              </div>
            ))}
          </div>
          {(trip.addons ?? []).length === 0 && (
            <div className="addon-catalog">
              <p className="addon-catalog-title">Available on this booking (just ask Miles)</p>
              {[
                { name: 'Extra checked bag', code: 'XBAG', note: 'Second bag up to 50 lb' },
                { name: 'Prepaid meal', code: 'VGML+', note: 'Vegetarian, kosher, halal & more' },
                { name: 'Pet in cabin', code: 'PETC', note: 'Carrier fits under the seat' },
                { name: 'Pet in hold', code: 'AVIH', note: 'Climate-controlled crate transport' },
                { name: 'Wheelchair assistance', code: 'WCHR', note: 'Gate-to-gate, no charge' },
              ].map((item) => (
                <div className="addon-catalog-row" key={item.code}>
                  <span className="addon-catalog-name">{item.name}</span>
                  <code className="addon-code">{item.code}</code>
                  <span className="addon-catalog-note">{item.note}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {phoneOnly ? (
          <section className="prototype-section compact">
            <div className="modify-card">
              <div className={`modify-mic ${travelerOnHold ? 'active' : ''}`}>
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.7 2.35a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.75.34 1.54.57 2.35.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <p className="modify-title">{recovered ? 'Recovery complete' : 'Continue on your phone'}</p>
              <p className="modify-body">
                {travelerOnHold
                  ? 'Stay on the line. Miles is calling the hotel on your behalf.'
                  : recovered
                    ? 'Miles recovered the flight and hotel in one phone call.'
                    : 'Act 2 is phone-only. This page is the live spectator view.'}
              </p>
            </div>
          </section>
        ) : (
          <section className="prototype-section compact">
            <div className="modify-card">
              <button
                className={`modify-mic ${voiceConnected ? 'active' : ''}`}
                onClick={onToggleVoice}
                aria-label="Modify this trip by voice"
              >
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 0 0-7 0v5A3.5 3.5 0 0 0 12 15Z" />
                  <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21" />
                </svg>
              </button>
              <p className="modify-title">Need to change something?</p>
              <p className="modify-body">Tap the mic and tell Miles what to adjust.</p>
            </div>
          </section>
        )}

        <button className="secondary-block" onClick={onBack}>Back to home</button>
      </main>
    </div>
  )
}
