import { useState, useEffect, useMemo, useRef } from 'react'
import { useVocalBridge } from '@vocalbridgeai/react'
import { Dashboard } from './components/Dashboard'
import { HomeDashboard } from './components/HomeDashboard'
import { ItineraryPage } from './components/ItineraryPage'
import { CheckoutPage } from './components/CheckoutPage'
import { VoiceDock } from './components/VoiceDock'
import { useTripActions } from './hooks/useTripActions'
import { useSSE, type TripState, type LegStatus } from './hooks/useSSE'
import type { UserProfile } from './profile'

type Page = 'home' | 'booking' | 'detail' | 'checkout' | 'confirmed'

interface TripAppProps {
  sessionId: string
  onReset: () => void
  profile: UserProfile
}

const RECOVERY_STATUSES: LegStatus[] = ['cancelled', 'conflict', 'pending_change']

const emptyLeg = () => ({ status: 'empty' as LegStatus, options: [] })

function isRecovering(trip: TripState): boolean {
  return (
    RECOVERY_STATUSES.includes(trip.flight.status) ||
    trip.hotel.status === 'conflict' ||
    trip.hotel.status === 'pending_change' ||
    trip.hotelCallStatus === 'in_progress' ||
    trip.hotelCallStatus === 'failed'
  )
}

function isRecovered(trip: TripState): boolean {
  return (
    trip.hotelCallStatus === 'completed' &&
    trip.flight.status === 'confirmed' &&
    trip.hotel.status === 'confirmed'
  )
}

/** Overlay Act 2 SSE recovery fields onto the Act 1 client-action trip. */
function mergeTrips(voice: TripState, sse: TripState, hydrated: TripState): TripState {
  const base: TripState = {
    flight: voice.flight.status !== 'empty' ? voice.flight : hydrated.flight,
    hotel: voice.hotel.status !== 'empty' ? voice.hotel : hydrated.hotel,
    car: voice.car,
    pnr: voice.pnr ?? hydrated.pnr,
    transactionId: voice.transactionId ?? hydrated.transactionId,
    totalUsd: voice.totalUsd ?? hydrated.totalUsd,
    seats: voice.seats ?? hydrated.seats,
    addons: voice.addons ?? hydrated.addons,
    bookingStatus: voice.bookingStatus ?? hydrated.bookingStatus,
    destinationGuide: voice.destinationGuide ?? hydrated.destinationGuide,
    tripSummary: voice.tripSummary ?? hydrated.tripSummary,
  }

  const mergeLeg = (
    v: TripState['flight'],
    s: TripState['flight'],
  ): TripState['flight'] => {
    if (RECOVERY_STATUSES.includes(s.status)) {
      return { ...v, status: s.status, detail: s.detail ?? v.detail }
    }
    if (s.status === 'confirmed' && sse.hotelCallStatus === 'completed') {
      return { ...v, status: 'confirmed', detail: s.detail ?? v.detail }
    }
    return v
  }

  return {
    ...base,
    flight: mergeLeg(base.flight, sse.flight),
    hotel: mergeLeg(base.hotel, sse.hotel),
    car: base.car,
    pnr: sse.pnr ?? base.pnr,
    hotelCallStatus: sse.hotelCallStatus ?? base.hotelCallStatus ?? 'idle',
    hotelCallTranscript: sse.hotelCallTranscript ?? base.hotelCallTranscript,
    hotelCallContactMode:
      sse.hotelCallContactMode ?? base.hotelCallContactMode,
    travelerCallbackStatus:
      sse.travelerCallbackStatus ?? base.travelerCallbackStatus,
    travelerCallbackTranscript:
      sse.travelerCallbackTranscript ?? base.travelerCallbackTranscript,
  }
}

function bookingToTrip(booking: Record<string, unknown>): TripState {
  const flight = (booking.flight as Record<string, unknown> | undefined) ?? {}
  const hotel = (booking.hotel as Record<string, unknown> | undefined) ?? {}
  const cancelled = Boolean(booking.flight_cancelled)
  const conflict = Boolean(booking.hotel_conflict)
  return {
    flight: {
      status: cancelled ? 'cancelled' : booking.pnr ? 'confirmed' : 'empty',
      options: flight.id || flight.offer_id ? [flight] : [],
      selectedId: String(flight.offer_id ?? flight.id ?? ''),
      detail: typeof flight.detail === 'string'
        ? flight.detail
        : [flight.flight_number, flight.origin, flight.destination].filter(Boolean).join(' '),
    },
    hotel: {
      status: conflict ? 'conflict' : booking.pnr ? 'confirmed' : 'empty',
      options: hotel.id || hotel.property_id ? [hotel] : [],
      selectedId: String(hotel.property_id ?? hotel.id ?? ''),
      detail: typeof hotel.detail === 'string'
        ? hotel.detail
        : [hotel.name, hotel.nights != null ? `${hotel.nights} nights` : ''].filter(Boolean).join(', '),
    },
    car: emptyLeg(),
    pnr: typeof booking.pnr === 'string' ? booking.pnr : undefined,
    totalUsd: typeof booking.total_usd === 'number' ? booking.total_usd : undefined,
    addons: Array.isArray(booking.addons)
      ? (booking.addons as TripState['addons'])
      : undefined,
  }
}

// This component lives inside VocalBridgeProvider so all VB hooks work correctly
export function TripApp({ sessionId, onReset, profile }: TripAppProps) {
  const firstName = profile.firstName
  const [page, setPage] = useState<Page>('home')
  const [act2Phone, setAct2Phone] = useState(false)
  const [disrupting, setDisrupting] = useState(false)
  const [voiceTrip, resetTrip] = useTripActions(sessionId, profile)
  const sseTrip = useSSE(sessionId)
  const { connect, disconnect, state: vbState, client } = useVocalBridge()
  const connectAfterReset = useRef(false)

  // Hand the signed-in traveler's profile to Miles as soon as the voice
  // session is live, so she never has to ask for name or email.
  useEffect(() => {
    if (vbState !== 'connected') return
    void client
      .sendAction('traveler_profile', {
        first_name: profile.firstName,
        last_name: profile.lastName,
        email: profile.email,
      })
      .catch(() => {})
  }, [vbState, client, profile])
  const [hydrated, setHydrated] = useState<TripState>({
    flight: emptyLeg(),
    hotel: emptyLeg(),
    car: emptyLeg(),
  })

  useEffect(() => {
    let cancelled = false
    void fetch(`/debug/booking/${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data || data.error || !data.pnr) return
        setHydrated(bookingToTrip(data as Record<string, unknown>))
        if (data.flight_cancelled || data.hotel_conflict) {
          setAct2Phone(true)
          setPage('detail')
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const trip = useMemo(
    () => mergeTrips(voiceTrip, sseTrip, hydrated),
    [voiceTrip, sseTrip, hydrated],
  )

  const recovering = isRecovering(trip)
  const recovered = isRecovered(trip)
  // Act 2 = phone-only UI (no web mic) once disruption starts or completes
  const phoneOnly = act2Phone || recovering || recovered
  const voiceConnected = vbState === 'connected'
  const voiceConnecting = vbState === 'connecting' || vbState === 'waiting_for_agent'

  useEffect(() => {
    if (recovering || recovered) {
      setAct2Phone(true)
      setPage('detail')
    }
  }, [recovering, recovered])

  // Hang up the Act 1 web voice session — Act 2 is PSTN only
  useEffect(() => {
    if (!phoneOnly) return
    if (vbState === 'connected' || vbState === 'connecting' || vbState === 'waiting_for_agent') {
      void disconnect()
    }
  }, [phoneOnly, vbState, disconnect])

  useEffect(() => {
    if (!connectAfterReset.current) return
    connectAfterReset.current = false
    void connect()
  }, [sessionId, connect])

  // A confirmed booking becomes the live prototype Trip Detail.
  useEffect(() => {
    if (!trip.pnr || page !== 'booking') return
    const timer = window.setTimeout(() => setPage('detail'), 900)
    return () => window.clearTimeout(timer)
  }, [trip.pnr, page])

  const handlePlanTrip = () => {
    if (trip.pnr) {
      resetTrip()
      setHydrated({ flight: emptyLeg(), hotel: emptyLeg(), car: emptyLeg() })
      setAct2Phone(false)
      connectAfterReset.current = true
      onReset()
    } else {
      void connect()
    }
    setPage('booking')
  }

  const handleDisrupt = async () => {
    if (!trip.pnr) throw new Error('No PNR to cancel')
    setDisrupting(true)
    try {
      setAct2Phone(true)
      setPage('detail')
      if (voiceConnected || voiceConnecting) void disconnect()
      const res = await fetch(`/debug/cancel/${encodeURIComponent(trip.pnr)}`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        setAct2Phone(false)
        throw new Error(data.error || data.note || `Cancel failed (${res.status})`)
      }
      const bookingRes = await fetch(`/debug/booking/${sessionId}`)
      const booking = await bookingRes.json().catch(() => null)
      if (booking && !booking.error) {
        setHydrated(bookingToTrip(booking as Record<string, unknown>))
      }
    } finally {
      setDisrupting(false)
    }
  }

  const handleToggleVoice = () => {
    void (voiceConnected ? disconnect() : connect())
  }

  const content = (() => {
    if (page === 'home') {
      return (
        <HomeDashboard
          trip={trip}
          connecting={voiceConnecting}
          firstName={firstName}
          onPlanTrip={handlePlanTrip}
          onOpenTrip={() => setPage('detail')}
        />
      )
    }
    if (page === 'detail') {
      return (
        <ItineraryPage
          trip={trip}
          phoneOnly={phoneOnly}
          disrupting={disrupting}
          voiceConnected={voiceConnected}
          onCheckout={() => setPage('checkout')}
          onBack={() => setPage('home')}
          onDisrupt={!phoneOnly && trip.pnr ? handleDisrupt : undefined}
          onToggleVoice={phoneOnly ? undefined : handleToggleVoice}
        />
      )
    }
    if (page === 'checkout' || page === 'confirmed') {
      return (
        <CheckoutPage
          trip={trip}
          onBack={() => setPage('detail')}
          onPaid={(transactionId) => {
            setHydrated((current) => ({ ...current, transactionId }))
            setPage('confirmed')
          }}
        />
      )
    }
    return (
      <div style={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Dashboard
          trip={trip}
          sessionId={sessionId}
          onViewItinerary={() => setPage('detail')}
        />
      </div>
    )
  })()

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      background: '#FFF7E4',
      color: '#232323',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {content}
      {(page === 'booking' || (page === 'detail' && (voiceConnected || voiceConnecting))) && !phoneOnly && (
        <VoiceDock
          fallback={page === 'booking' ? 'Tell Miles where you want to go' : 'Tell Miles what to change'}
        />
      )}
    </div>
  )
}
