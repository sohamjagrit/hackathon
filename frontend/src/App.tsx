import { useState } from 'react'
import { VocalBridgeProvider } from '@vocalbridgeai/react'
import { getSessionId, resetSession } from './session'
import { TripApp } from './TripApp'

export default function App() {
  const [sessionId, setSessionId] = useState(() => getSessionId())

  const handleReset = () => setSessionId(resetSession())

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
      <TripApp sessionId={sessionId} onReset={handleReset} />
    </VocalBridgeProvider>
  )
}
