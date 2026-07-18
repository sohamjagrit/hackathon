import { useEffect, useReducer } from 'react'

export type LegStatus =
  | 'empty'
  | 'loading'
  | 'options'
  | 'selected'
  | 'confirmed'
  | 'conflict'
  | 'cancelled'
  | 'pending_change'

export interface FlightOption {
  id: string
  carrier: string
  airline_name: string
  flight_number: string
  origin: string
  destination: string
  depart: string
  arrive: string
  duration: string
  stops: number
  price_usd: number
  offer_id: string
  return_flight_number?: string
  return_origin?: string
  return_destination?: string
  return_depart?: string
  return_arrive?: string
  return_duration?: string
  return_stops?: number
}

export interface HotelOption {
  id: string
  name: string
  property_id: string
  rate_usd: number
  check_in: string
  check_out: string
  nights: number
  amenities: string[]
  rating: number
  area: string
}

export interface CarOption {
  id: string
  vendor: string
  category: string
  model: string
  rate_usd_per_day: number
  days: number
  total_usd: number
  pickup: string
  dropoff: string
  pickup_location: string
  rate_key: string
}

export interface LegState {
  status: LegStatus
  options: unknown[]
  selectedId?: string
  detail?: string
}

export interface SeatState {
  status: 'choosing' | 'assigned'
  preference?: 'window' | 'aisle'
  assigned?: string
  seatType?: string
}

export interface ForecastDay {
  date: string
  condition: string
  high_f: number
  low_f: number
  precipitation_percent?: number
}

export interface DestinationActivity {
  name: string
  category?: string
  description?: string
}

export interface DestinationGuide {
  destination: string
  forecast?: ForecastDay[]
  activities?: DestinationActivity[]
}

export interface TripAddon {
  name: string
  code?: string
  price_usd?: number
  detail?: string
}

export interface TripSummary {
  origin?: string
  destination: string
  depart_date?: string
  return_date?: string
  trip_type?: 'one-way' | 'round-trip'
  travelers?: number
}

export interface TripState {
  flight: LegState
  hotel: LegState
  car: LegState
  pnr?: string
  transactionId?: string
  totalUsd?: number
  seats?: SeatState
  addons?: TripAddon[]
  hotelCallStatus?: 'idle' | 'in_progress' | 'completed' | 'failed'
  hotelCallTranscript?: string
  hotelCallContactMode?: 'stay_on_line' | 'callback'
  bookingStatus?: 'committing' | 'confirmed' | 'failed'
  destinationGuide?: DestinationGuide
  tripSummary?: TripSummary
  travelerCallbackStatus?: 'queued' | 'calling' | 'completed' | 'failed'
  travelerCallbackTranscript?: string
}

const emptyLeg = (): LegState => ({ status: 'empty', options: [] })

const initialState: TripState = {
  flight: emptyLeg(),
  hotel: emptyLeg(),
  car: emptyLeg(),
}

type SSEEvent = { type: string; session_id: string; payload: Record<string, unknown> }

function applyEvent(state: TripState, event: SSEEvent): TripState {
  const { type, payload } = event
  switch (type) {
    case 'flight_options':
      return { ...state, flight: { ...state.flight, status: 'options', options: (payload.options as unknown[]) ?? [] } }
    case 'hotel_options':
      return { ...state, hotel: { ...state.hotel, status: 'options', options: (payload.options as unknown[]) ?? [] } }
    case 'car_options':
      return { ...state, car: { ...state.car, status: 'options', options: (payload.options as unknown[]) ?? [] } }
    case 'leg_status': {
      const leg = payload.leg as 'flight' | 'hotel' | 'car'
      const status = payload.status as LegStatus
      if (!['flight', 'hotel', 'car'].includes(leg)) return state
      return {
        ...state,
        [leg]: {
          ...state[leg],
          status,
          selectedId: (payload.selected_id as string) ?? state[leg].selectedId,
          detail: (payload.detail as string) ?? state[leg].detail,
        },
      }
    }
    case 'booking_confirmed':
      return {
        ...state,
        pnr: payload.pnr as string,
        transactionId: payload.transaction_id as string,
        totalUsd: payload.total_usd as number,
        flight: { ...state.flight, status: 'confirmed' },
        hotel: { ...state.hotel, status: 'confirmed' },
        car: { ...state.car, status: 'confirmed' },
      }
    case 'recovery_started': {
      const cancelled = (payload.cancelled_leg as string) || 'flight'
      const conflicts = Array.isArray(payload.conflict_legs)
        ? (payload.conflict_legs as string[])
        : ['hotel']
      const next = { ...state }
      if (cancelled === 'flight' || cancelled === 'hotel' || cancelled === 'car') {
        next[cancelled] = { ...next[cancelled], status: 'cancelled' }
      }
      for (const leg of conflicts) {
        if (leg === 'flight' || leg === 'hotel' || leg === 'car') {
          next[leg] = { ...next[leg], status: 'conflict' }
        }
      }
      return next
    }
    case 'hotel_call_status':
      return {
        ...state,
        hotelCallStatus: payload.status as TripState['hotelCallStatus'],
        hotelCallTranscript: (payload.transcript_line as string) ?? state.hotelCallTranscript,
        hotelCallContactMode:
          (payload.contact_mode as TripState['hotelCallContactMode']) ??
          state.hotelCallContactMode,
      }
    case 'traveler_callback_status':
      return {
        ...state,
        travelerCallbackStatus: payload.status as TripState['travelerCallbackStatus'],
        travelerCallbackTranscript:
          (payload.transcript_line as string) ?? state.travelerCallbackTranscript,
      }
    case 'recovery_confirmed': {
      const itinerary = (payload.itinerary as Record<string, { detail?: string }> | undefined) ?? {}
      return {
        ...state,
        pnr: (payload.pnr as string) ?? state.pnr,
        flight: {
          ...state.flight,
          status: 'confirmed',
          detail: itinerary.flight?.detail ?? state.flight.detail,
        },
        hotel: {
          ...state.hotel,
          status: 'confirmed',
          detail: itinerary.hotel?.detail ?? state.hotel.detail,
        },
        hotelCallStatus: 'completed',
      }
    }
    default:
      return state
  }
}

export function useSSE(sessionId: string): TripState {
  const [state, dispatch] = useReducer(
    (s: TripState, event: SSEEvent) => applyEvent(s, event),
    initialState,
  )

  useEffect(() => {
    if (!sessionId) return
    const es = new EventSource(`/events?session_id=${sessionId}`)
    es.onmessage = (e) => {
      try {
        dispatch(JSON.parse(e.data))
      } catch {
        // ignore malformed events
      }
    }
    return () => es.close()
  }, [sessionId])

  return state
}
