import type { FlightOption, HotelOption, TripState } from './hooks/useSSE'

const AIRPORT_NAMES: Record<string, string> = {
  AUS: 'Austin, TX',
  CUN: 'Cancún, Mexico',
  DFW: 'Dallas, TX',
  JFK: 'New York, NY',
  LAX: 'Los Angeles, CA',
  MCO: 'Orlando, FL',
  ORD: 'Chicago, IL',
  PHX: 'Phoenix, AZ',
  SEA: 'Seattle, WA',
  SFO: 'San Francisco, CA',
}

export const DESTINATION_IMAGE =
  'https://d8j0ntlcm91z4.cloudfront.net/user_3GFMoiC4bqHH8GpOL1rh6WWLlWf/hf_20260717_185040_589b5e9a-4764-49ea-90d2-805a3c043efc.png'

export function selectedFlight(trip: TripState): FlightOption | undefined {
  const selected = trip.flight.options.find((item) => {
    const flight = item as FlightOption
    return flight.id === trip.flight.selectedId || flight.offer_id === trip.flight.selectedId
  }) as FlightOption | undefined
  return selected ?? trip.flight.options[0] as FlightOption | undefined
}

export function selectedHotel(trip: TripState): HotelOption | undefined {
  const selected = trip.hotel.options.find((item) => {
    const hotel = item as HotelOption
    return hotel.id === trip.hotel.selectedId || hotel.property_id === trip.hotel.selectedId
  }) as HotelOption | undefined
  return selected ?? trip.hotel.options[0] as HotelOption | undefined
}

export function destinationName(code?: string): string {
  if (!code) return 'Your next destination'
  return AIRPORT_NAMES[code.toUpperCase()] ?? code.toUpperCase()
}

export function formatDate(value?: string, withYear = true): string {
  if (!value) return '—'
  const date = new Date(value + (value.includes('T') ? '' : 'T00:00:00'))
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}

export function formatTime(value?: string): string {
  if (!value) return '—'
  const time = value.includes('T') ? value.split('T')[1] ?? value : value
  const [hourString, minuteString = '00'] = time.split(':')
  const hour = Number.parseInt(hourString, 10)
  if (Number.isNaN(hour)) return value
  return `${hour % 12 || 12}:${minuteString.slice(0, 2)} ${hour < 12 ? 'AM' : 'PM'}`
}

export function daysUntil(value?: string): number | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000))
}

export function tripDates(trip: TripState): string {
  const flight = selectedFlight(trip)
  const hotel = selectedHotel(trip)
  const start = flight?.depart ?? hotel?.check_in
  const finish = hotel?.check_out ?? flight?.arrive
  if (!start && !finish) return 'Dates confirmed in your itinerary'
  return `${formatDate(start)}${finish ? ` – ${formatDate(finish)}` : ''}`
}

export function priceParts(trip: TripState) {
  const flight = selectedFlight(trip)
  const hotel = selectedHotel(trip)
  const flightTotal = Number(flight?.price_usd ?? 0)
  const hotelTotal = Number(hotel?.rate_usd ?? 0) * Number(hotel?.nights ?? 0)
  const addonsTotal = (trip.addons ?? []).reduce(
    (sum, addon) => sum + Number(addon.price_usd ?? 0),
    0,
  )
  const subtotal = flightTotal + hotelTotal + addonsTotal
  const reported = Number(trip.totalUsd ?? NaN)
  // Sabre background jobs sometimes report a total ~4x the itemized prices.
  // Trust the reported total only when it's plausibly subtotal + taxes/fees.
  const total =
    Number.isFinite(reported) && (subtotal === 0 || reported <= subtotal * 1.35)
      ? reported
      : subtotal
  const fees = Math.max(0, total - subtotal)
  return { flightTotal, hotelTotal, addonsTotal, fees, total }
}

export function statusLabel(trip: TripState): string {
  if (trip.flight.status === 'cancelled') return 'Disrupted'
  if (trip.hotelCallStatus === 'completed') return 'Recovered'
  return trip.pnr ? 'Confirmed' : 'Planning'
}
