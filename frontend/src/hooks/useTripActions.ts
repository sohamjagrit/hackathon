import { useEffect, useReducer, useRef } from 'react'
import { useVocalBridge } from '@vocalbridgeai/react'
import { RoomEvent } from 'livekit-client'
import type {
  DestinationActivity,
  DestinationGuide,
  ForecastDay,
  TripAddon,
  TripState,
  TripSummary,
  LegStatus,
  SeatState,
} from './useSSE'
import type { UserProfile } from '../profile'

const emptyLeg = () => ({ status: 'empty' as LegStatus, options: [] })

const initialState: TripState = {
  flight: emptyLeg(),
  hotel: emptyLeg(),
  car: emptyLeg(),
}

const PROTOCOL_ACTIONS = new Set([
  'heartbeat',
  'heartbeat_ack',
  'send_transcript',
  'query_agent',
  'agent_response',
])

type Action =
  | { type: 'leg_loading'; payload: { leg: 'flight' | 'hotel' } }
  | { type: 'show_flights'; payload: { options: unknown[] } }
  | { type: 'show_hotels'; payload: { options: unknown[] } }
  | { type: 'flight_selected'; payload: { offer_id: string; detail?: string } }
  | { type: 'hotel_selected'; payload: { property_id: string; detail?: string } }
  | { type: 'booking_started'; payload: { message?: string } }
  | { type: 'booking_confirmed'; payload: { pnr: string; total_usd?: number } }
  | { type: 'show_destination_guide'; payload: DestinationGuide }
  | { type: 'show_trip_summary'; payload: TripSummary }
  | { type: 'show_seats'; payload: { preference?: string } }
  | { type: 'seat_selected'; payload: { seat: string; type?: string } }
  | { type: 'addons_selected'; payload: { addons: TripAddon[] } }
  | { type: 'reset' }

/** VB / LLM payloads sometimes arrive stringified or under alternate keys. */
function asRecord(payload: unknown): Record<string, unknown> {
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return {}
    }
  }
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>
  }
  return {}
}

function extractOptions(payload: unknown): unknown[] {
  const p = asRecord(payload)
  const raw = p.options ?? p.flights ?? p.hotels ?? p.results
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/**
 * Parse a LiveKit data-channel packet. More liberal than the VB SDK decoder:
 * accepts stringified payloads (SDK coerces those to {}).
 */
function parseClientAction(
  data: Uint8Array,
): { action: string; payload: Record<string, unknown> } | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(data))
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.type !== 'client_action' || typeof parsed.action !== 'string') return null
    let payload: unknown = parsed.payload
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload)
      } catch {
        payload = {}
      }
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      payload = {}
    }
    return { action: parsed.action, payload: payload as Record<string, unknown> }
  } catch {
    return null
  }
}

function reducer(state: TripState, action: Action): TripState {
  switch (action.type) {
    case 'leg_loading': {
      const leg = action.payload.leg
      if (leg !== 'flight' && leg !== 'hotel') return state
      return {
        ...state,
        [leg]: { ...state[leg], status: 'loading' },
      }
    }
    case 'show_flights': {
      const options = action.payload.options ?? []
      // Ignore empty payloads — the VB SDK drops stringified payloads to {} which
      // would otherwise wipe a good update or flash an empty Options card.
      if (options.length === 0) return state
      return {
        ...state,
        flight: { ...state.flight, status: 'options', options },
      }
    }
    case 'show_hotels': {
      const options = action.payload.options ?? []
      if (options.length === 0) return state
      return {
        ...state,
        hotel: { ...state.hotel, status: 'options', options },
      }
    }
    case 'flight_selected':
      return {
        ...state,
        flight: {
          ...state.flight,
          status: 'selected',
          selectedId: action.payload.offer_id,
          detail: action.payload.detail,
        },
      }
    case 'hotel_selected':
      return {
        ...state,
        hotel: {
          ...state.hotel,
          status: 'selected',
          selectedId: action.payload.property_id,
          detail: action.payload.detail,
        },
      }
    case 'booking_started':
      {
        const selectedFlight = state.flight.options.find((option) => {
          if (!option || typeof option !== 'object') return false
          const flight = option as Record<string, unknown>
          return flight.id === state.flight.selectedId || flight.offer_id === state.flight.selectedId
        }) as Record<string, unknown> | undefined
      return {
        ...state,
        bookingStatus: 'committing',
        destinationGuide: state.destinationGuide ?? {
          destination: String(selectedFlight?.destination ?? 'your destination'),
        },
      }
      }
    case 'booking_confirmed':
      return {
        ...state,
        pnr: action.payload.pnr,
        totalUsd: action.payload.total_usd,
        bookingStatus: 'confirmed',
        flight: { ...state.flight, status: state.flight.status === 'empty' ? 'empty' : 'confirmed' },
        hotel: { ...state.hotel, status: state.hotel.status === 'empty' ? 'empty' : 'confirmed' },
      }
    case 'show_destination_guide':
      return {
        ...state,
        destinationGuide: {
          ...state.destinationGuide,
          ...action.payload,
          forecast: action.payload.forecast ?? state.destinationGuide?.forecast,
          activities: action.payload.activities ?? state.destinationGuide?.activities,
        },
      }
    case 'show_trip_summary':
      return {
        ...state,
        tripSummary: { ...state.tripSummary, ...action.payload },
      }
    case 'show_seats': {
      const pref = action.payload.preference as SeatState['preference']
      return {
        ...state,
        seats: { status: 'choosing', preference: pref },
      }
    }
    case 'seat_selected':
      return {
        ...state,
        seats: {
          ...(state.seats ?? { status: 'assigned' }),
          status: 'assigned',
          assigned: action.payload.seat,
          seatType: action.payload.type,
        },
      }
    case 'addons_selected': {
      if (action.payload.addons.length === 0) return state
      return { ...state, addons: action.payload.addons }
    }
    case 'reset':
      return initialState
    default:
      return state
  }
}

function toDispatch(action: string, raw: unknown): Action | null {
  const p = asRecord(raw)
  switch (action) {
    case 'leg_loading':
      return {
        type: 'leg_loading',
        payload: { leg: p.leg === 'hotel' ? 'hotel' : 'flight' },
      }
    case 'show_flights':
      return { type: 'show_flights', payload: { options: extractOptions(raw) } }
    case 'show_hotels':
      return { type: 'show_hotels', payload: { options: extractOptions(raw) } }
    case 'flight_selected':
      return {
        type: 'flight_selected',
        payload: {
          offer_id: String(p.offer_id ?? p.offerId ?? ''),
          detail: typeof p.detail === 'string' ? p.detail : undefined,
        },
      }
    case 'hotel_selected':
      return {
        type: 'hotel_selected',
        payload: {
          property_id: String(p.property_id ?? p.propertyId ?? ''),
          detail: typeof p.detail === 'string' ? p.detail : undefined,
        },
      }
    case 'booking_started':
      return {
        type: 'booking_started',
        payload: {
          message: typeof p.message === 'string' ? p.message : undefined,
        },
      }
    case 'booking_confirmed': {
      const total = p.total_usd ?? p.totalUsd
      return {
        type: 'booking_confirmed',
        payload: {
          pnr: String(p.pnr ?? ''),
          total_usd: typeof total === 'number' ? total : Number(total) || undefined,
        },
      }
    }
    case 'show_destination_guide': {
      const rawForecast = Array.isArray(p.forecast)
        ? p.forecast.filter((item): item is ForecastDay => Boolean(item && typeof item === 'object'))
        : []
      const rawActivities = Array.isArray(p.activities)
        ? p.activities.filter((item): item is DestinationActivity => Boolean(item && typeof item === 'object'))
        : []
      // Empty arrays must not wipe previously populated data
      const forecast = rawForecast.length > 0 ? rawForecast : undefined
      const activities = rawActivities.length > 0 ? rawActivities : undefined
      return {
        type: 'show_destination_guide',
        payload: {
          destination: String(p.destination ?? 'Your destination'),
          forecast,
          activities,
        },
      }
    }
    case 'show_trip_summary': {
      const travelers = Number(p.travelers)
      return {
        type: 'show_trip_summary',
        payload: {
          origin: typeof p.origin === 'string' ? p.origin : undefined,
          destination: String(p.destination ?? ''),
          depart_date: typeof p.depart_date === 'string' ? p.depart_date : undefined,
          return_date: typeof p.return_date === 'string' ? p.return_date : undefined,
          trip_type: p.trip_type === 'one-way' ? 'one-way' : p.trip_type === 'round-trip' ? 'round-trip' : undefined,
          travelers: Number.isFinite(travelers) && travelers > 0 ? travelers : undefined,
        },
      }
    }
    case 'show_seats':
      return {
        type: 'show_seats',
        payload: { preference: typeof p.preference === 'string' ? p.preference : undefined },
      }
    case 'seat_selected':
      return {
        type: 'seat_selected',
        payload: {
          seat: String(p.seat ?? ''),
          type: typeof p.type === 'string' ? p.type : undefined,
        },
      }
    case 'addons_selected': {
      const raw = Array.isArray(p.addons) ? p.addons : []
      const addons = raw
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item) => ({
          name: String(item.name ?? ''),
          code: typeof item.code === 'string' ? item.code : undefined,
          price_usd: Number.isFinite(Number(item.price_usd)) ? Number(item.price_usd) : undefined,
          detail: typeof item.detail === 'string' ? item.detail : undefined,
        }))
        .filter((item) => item.name)
      return { type: 'addons_selected', payload: { addons } }
    }
    default:
      return null
  }
}

function pickSelected(
  options: unknown[],
  selectedId?: string,
): Record<string, unknown> | undefined {
  if (!selectedId || !Array.isArray(options)) return undefined
  const found = options.find((o) => {
    if (!o || typeof o !== 'object') return false
    const r = o as Record<string, unknown>
    return (
      String(r.id ?? '') === selectedId ||
      String(r.offer_id ?? '') === selectedId ||
      String(r.property_id ?? '') === selectedId
    )
  })
  return found && typeof found === 'object' ? (found as Record<string, unknown>) : undefined
}

function buildPersistPayload(
  sessionId: string,
  state: TripState,
  profile?: UserProfile,
) {
  const flight =
    pickSelected(state.flight.options, state.flight.selectedId) ??
    (state.flight.detail ? { detail: state.flight.detail } : undefined)
  const hotel =
    pickSelected(state.hotel.options, state.hotel.selectedId) ??
    (state.hotel.detail ? { detail: state.hotel.detail } : undefined)
  return {
    session_id: sessionId,
    pnr: state.pnr,
    total_usd: state.totalUsd,
    traveler_name: profile
      ? [profile.firstName, profile.lastName].filter(Boolean).join(' ')
      : undefined,
    traveler_first_name: profile?.firstName,
    traveler_email: profile?.email,
    addons: state.addons,
    flight: flight
      ? { ...flight, detail: state.flight.detail ?? flight.detail }
      : state.flight.detail
        ? { detail: state.flight.detail }
        : undefined,
    hotel: hotel
      ? { ...hotel, detail: state.hotel.detail ?? hotel.detail }
      : state.hotel.detail
        ? { detail: state.hotel.detail }
        : undefined,
  }
}

export function useTripActions(
  sessionId?: string,
  profile?: UserProfile,
): [TripState, () => void] {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { client } = useVocalBridge()
  const seenRef = useRef(new Set<string>())
  const persistedPnrRef = useRef<string | null>(null)

  // Act 1 → Act 2 handoff: persist confirmed booking for /debug/cancel
  useEffect(() => {
    if (!sessionId || !state.pnr) return
    if (persistedPnrRef.current === state.pnr) return
    persistedPnrRef.current = state.pnr
    const body = buildPersistPayload(sessionId, state, profile)
    void fetch('/debug/persist-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {
      // non-fatal — demo can still seed via curl
      persistedPnrRef.current = null
    })
  }, [sessionId, state, profile])

  useEffect(() => {
    const apply = (action: string, payload: unknown) => {
      if (PROTOCOL_ACTIONS.has(action)) return
      const next = toDispatch(action, payload)
      if (!next) return

      // Dedupe identical show_* payloads from dual listeners (SDK + raw room).
      if (next.type === 'show_flights' || next.type === 'show_hotels') {
        const key = `${next.type}:${JSON.stringify(next.payload.options)}`
        if (seenRef.current.has(key)) return
        seenRef.current.add(key)
      }

      dispatch(next)
    }

    const onAgentAction = (evt: { action: string; payload: Record<string, unknown> }) => {
      apply(evt.action, evt.payload)
    }

    const onRawData = (
      data: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string,
    ) => {
      // SDK only handles topic === "client_actions"; also accept missing topic.
      if (topic != null && topic !== 'client_actions') return
      const msg = parseClientAction(data)
      if (!msg) return
      apply(msg.action, msg.payload)
    }

    let detachRoom: (() => void) | undefined

    const attachRoom = () => {
      detachRoom?.()
      detachRoom = undefined
      const room = client.room
      if (!room) return
      room.on(RoomEvent.DataReceived, onRawData)
      detachRoom = () => {
        room.off(RoomEvent.DataReceived, onRawData)
      }
    }

    const onStateChange = (s: string) => {
      if (s === 'connected' || s === 'waiting_for_agent') {
        attachRoom()
      } else if (s === 'disconnected') {
        detachRoom?.()
        detachRoom = undefined
        seenRef.current.clear()
      }
    }

    client.on('agentAction', onAgentAction)
    client.on('connectionStateChanged', onStateChange)
    if (client.state === 'connected' || client.state === 'waiting_for_agent') {
      attachRoom()
    }

    return () => {
      client.off('agentAction', onAgentAction)
      client.off('connectionStateChanged', onStateChange)
      detachRoom?.()
    }
  }, [client])

  const reset = () => {
    seenRef.current.clear()
    persistedPnrRef.current = null
    dispatch({ type: 'reset' })
  }

  return [state, reset]
}
