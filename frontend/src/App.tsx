import { useState } from 'react'
import { VocalBridgeProvider } from '@vocalbridgeai/react'
import { getSessionId, resetSession } from './session'
import { loadProfile, saveProfile, type UserProfile } from './profile'
import { SignupPage } from './components/SignupPage'
import { TripApp } from './TripApp'

export default function App() {
  const [sessionId, setSessionId] = useState(() => getSessionId())
  const [profile, setProfile] = useState<UserProfile | null>(() => loadProfile())

  const handleReset = () => setSessionId(resetSession())

  if (!profile) {
    return (
      <SignupPage
        onComplete={(next) => {
          saveProfile(next)
          setProfile(next)
        }}
      />
    )
  }

  return (
    <VocalBridgeProvider
      options={{
        auth: {
          tokenUrl: '/api/voice-token',
          body: { session_id: sessionId, participant_name: profile.firstName },
        },
        sessionId,
        participantName: profile.firstName,
      }}
    >
      <TripApp sessionId={sessionId} onReset={handleReset} profile={profile} />
    </VocalBridgeProvider>
  )
}
