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
  flight_number: string
  origin: string
  destination: string
  depart: string
  arrive: string
  stops: number
  price_usd: number
  offer_id: string
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

export interface TripState {
  flight: LegState
  hotel: LegState
  car: LegState
  pnr?: string
  transactionId?: string
  totalUsd?: number
  hotelCallStatus?: 'idle' | 'in_progress' | 'completed' | 'failed'
  hotelCallTranscript?: string
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
    case 'recovery_started':
      return {
        ...state,
        flight: { ...state.flight, status: 'cancelled' },
        hotel: { ...state.hotel, status: 'conflict' },
        car: { ...state.car, status: 'conflict' },
      }
    case 'hotel_call_status':
      return {
        ...state,
        hotelCallStatus: payload.status as TripState['hotelCallStatus'],
        hotelCallTranscript: (payload.transcript_line as string) ?? state.hotelCallTranscript,
      }
    case 'recovery_confirmed':
      return {
        ...state,
        flight: { ...state.flight, status: 'confirmed' },
        hotel: { ...state.hotel, status: 'confirmed' },
        car: { ...state.car, status: 'confirmed' },
        hotelCallStatus: 'completed',
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
