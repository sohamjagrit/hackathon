import { useState, useEffect } from 'react'
import { VocalBridgeProvider } from '@vocalbridgeai/react'
import { VoicePanel } from './components/VoicePanel'
import { Dashboard } from './components/Dashboard'
import { ItineraryPage } from './components/ItineraryPage'
import { CheckoutPage } from './components/CheckoutPage'
import { getSessionId, resetSession } from './session'
import { useSSE } from './hooks/useSSE'

type Page = 'book' | 'itinerary' | 'checkout' | 'confirmed'

export default function App() {
  const [sessionId, setSessionId] = useState(() => getSessionId())
  const [page, setPage] = useState<Page>('book')

  const handleReset = () => {
    setSessionId(resetSession())
    setPage('book')
  }

  const trip = useSSE(sessionId)

  // Auto-navigate to itinerary when booking is confirmed
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
    <VocalBridgeProvider
      options={{
        auth: {
          tokenUrl: '/api/voice-token',
          body: { session_id: sessionId, participant_name: 'Traveler' },
        },
        sessionId,
        participantName: 'Traveler',
      }}
    >
      <div style={{
        width: '100%',
        height: '100vh',
        minHeight: 640,
        display: 'flex',
        background: 'oklch(0.97 0.012 75)',
        color: 'oklch(0.22 0.01 75)',
        overflow: 'hidden',
      }}>
        <VoicePanel sessionId={sessionId} onReset={handleReset} />
        {rightPanel}
      </div>
    </VocalBridgeProvider>
  )
}
