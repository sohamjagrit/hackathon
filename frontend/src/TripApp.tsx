import { useState, useEffect } from 'react'
import { VoicePanel } from './components/VoicePanel'
import { Dashboard } from './components/Dashboard'
import { ItineraryPage } from './components/ItineraryPage'
import { CheckoutPage } from './components/CheckoutPage'
import { useTripActions } from './hooks/useTripActions'

type Page = 'book' | 'itinerary' | 'checkout' | 'confirmed'

interface TripAppProps {
  sessionId: string
  onReset: () => void
}

// This component lives inside VocalBridgeProvider so all VB hooks work correctly
export function TripApp({ sessionId, onReset }: TripAppProps) {
  const [page, setPage] = useState<Page>('book')
  const [trip, resetTrip] = useTripActions()

  const handleReset = () => {
    resetTrip()
    setPage('book')
    onReset()
  }

  useEffect(() => {
    if (trip.pnr && page === 'book') {
      const timer = setTimeout(() => setPage('itinerary'), 1200)
      return () => clearTimeout(timer)
    }
  }, [trip.pnr, page])

  const rightPanel = (() => {
    if (page === 'itinerary') {
      return (
        <ItineraryPage
          trip={trip}
          onCheckout={() => setPage('checkout')}
          onBack={() => setPage('book')}
        />
      )
    }
    if (page === 'checkout' || page === 'confirmed') {
      return (
        <CheckoutPage
          trip={trip}
          onBack={() => setPage('itinerary')}
          onPaid={() => setPage('confirmed')}
        />
      )
    }
    return (
      <Dashboard
        trip={trip}
        sessionId={sessionId}
        onViewItinerary={() => setPage('itinerary')}
      />
    )
  })()

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      background: 'oklch(0.97 0.012 75)',
      color: 'oklch(0.22 0.01 75)',
      overflow: 'hidden',
    }}>
      <VoicePanel onReset={handleReset} />
      {rightPanel}
    </div>
  )
}
