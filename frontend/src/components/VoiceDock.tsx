import { useTranscript, useVocalBridge } from '@vocalbridgeai/react'

interface VoiceDockProps {
  fallback?: string
}

export function VoiceDock({ fallback = 'Tell Miles what you need' }: VoiceDockProps) {
  const { state, connect, disconnect } = useVocalBridge()
  const { transcript } = useTranscript()
  const connected = state === 'connected'
  const connecting = state === 'connecting' || state === 'waiting_for_agent'
  const current = transcript[transcript.length - 1]

  return (
    <div className="voice-dock" aria-live="polite">
      <div className="voice-dock-copy">
        <div className="voice-dock-label">
          {current?.role === 'agent' ? 'Miles' : current ? 'You' : connected ? 'Listening' : 'Voice'}
        </div>
        <div className="voice-dock-text">
          {current?.text || (connecting ? 'Connecting to Miles…' : connected ? fallback : 'Voice session paused')}
        </div>
      </div>
      <button
        className={`voice-dock-button ${connected ? 'active' : ''}`}
        onClick={() => void (connected ? disconnect() : connect())}
        disabled={connecting}
        aria-label={connected ? 'End voice session' : 'Start voice session'}
      >
        <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x={9} y={2} width={6} height={12} rx={3} />
          <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
          <path d="M12 18v4" />
        </svg>
      </button>
    </div>
  )
}
