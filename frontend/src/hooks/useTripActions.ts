import { useEffect, useReducer } from 'react'
import { useAgentActions } from '@vocalbridgeai/react'
import type { TripState, LegStatus } from './useSSE'

const emptyLeg = () => ({ status: 'empty' as LegStatus, options: [] })

const initialState: TripState = {
  flight: emptyLeg(),
  hotel: emptyLeg(),
  car: emptyLeg(),
}

type Action =
  | { type: 'leg_loading'; payload: { leg: 'flight' | 'hotel' } }
  | { type: 'show_flights'; payload: { options: unknown[] } }
  | { type: 'show_hotels'; payload: { options: unknown[] } }
  | { type: 'flight_selected'; payload: { offer_id: string; detail?: string } }
  | { type: 'hotel_selected'; payload: { property_id: string; detail?: string } }
  | { type: 'booking_confirmed'; payload: { pnr: string; total_usd?: number; itinerary?: unknown } }
  | { type: 'reset' }

function reducer(state: TripState, action: Action): TripState {
  switch (action.type) {
    case 'leg_loading':
      return {
        ...state,
        [action.payload.leg]: { ...state[action.payload.leg as 'flight' | 'hotel'], status: 'loading' },
      }
    case 'show_flights':
      return {
        ...state,
        flight: { ...state.flight, status: 'options', options: action.payload.options ?? [] },
      }
    case 'show_hotels':
      return {
        ...state,
        hotel: { ...state.hotel, status: 'options', options: action.payload.options ?? [] },
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
    case 'booking_confirmed':
      return {
        ...state,
        pnr: action.payload.pnr,
        totalUsd: action.payload.total_usd,
        flight: { ...state.flight, status: state.flight.status === 'empty' ? 'empty' : 'confirmed' },
        hotel: { ...state.hotel, status: state.hotel.status === 'empty' ? 'empty' : 'confirmed' },
      }
    case 'reset':
      return initialState
    default:
      return state
  }
}

export function useTripActions(): [TripState, () => void] {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { onAction } = useAgentActions()

  useEffect(() => {
    const cleanups = [
      onAction('leg_loading',       (p) => dispatch({ type: 'leg_loading',       payload: p as { leg: 'flight' | 'hotel' } })),
      onAction('show_flights',      (p) => dispatch({ type: 'show_flights',      payload: p as { options: unknown[] } })),
      onAction('show_hotels',       (p) => dispatch({ type: 'show_hotels',       payload: p as { options: unknown[] } })),
      onAction('flight_selected',   (p) => dispatch({ type: 'flight_selected',   payload: p as { offer_id: string; detail?: string } })),
      onAction('hotel_selected',    (p) => dispatch({ type: 'hotel_selected',    payload: p as { property_id: string; detail?: string } })),
      onAction('booking_confirmed', (p) => dispatch({ type: 'booking_confirmed', payload: p as { pnr: string; total_usd?: number } })),
    ]
    return () => cleanups.forEach((fn) => fn?.())
  }, [onAction])

  const reset = () => dispatch({ type: 'reset' })

  return [state, reset]
}
