import { useState } from 'react'
import { useVocalBridge, useAIAgent, useTranscript } from '@vocalbridgeai/react'

interface VoicePanelProps {
  sessionId: string  // used in the agent query relay below
  onReset: () => void
}

export function VoicePanel({ sessionId, onReset }: VoicePanelProps) {
  const [muted, setMuted] = useState(false)
  const { state, connect, disconnect } = useVocalBridge()
  const { transcript } = useTranscript()

  const isConnected = state === 'connected'
  const isConnecting = state === 'connecting'
  const isListening = isConnected
  const isDone = state === 'disconnected' && transcript.length > 0

  useAIAgent({
    onQuery: async (query: string) => {
      const r = await fetch('/agent/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, query }),
      })
      if (!r.ok) return 'Something went wrong — please try again.'
      const data = await r.json()
      return (data.speech as string) ?? ''
    },
  })

  const handleMicClick = () => {
    if (isConnected) {
      disconnect()
    } else {
      connect()
    }
  }

  const micBg = isConnected
    ? 'oklch(0.45 0.09 165)'
    : isConnecting
    ? 'oklch(0.65 0.05 165)'
    : 'oklch(0.35 0.07 75)'

  const micAnim = isConnected ? 'pulse 1.5s infinite' : 'none'
  const micLabel = isConnecting ? 'Connecting…' : isConnected ? 'Tap to stop' : 'Tap to talk'

  return (
    <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'oklch(0.985 0.006 75)', borderRight: '1px solid oklch(0.9 0.01 75)' }}>

      {/* Header */}
      <div style={{ padding: '22px 22px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid oklch(0.92 0.01 75)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'oklch(0.45 0.09 165)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
            <path d="M2 12l19-9-6 19-4-8-9-2z" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>Miles</div>
          <div style={{ fontSize: 12, color: 'oklch(0.55 0.01 75)' }}>your trip, spoken into being</div>
        </div>
        <button
          onClick={() => setMuted(!muted)}
          title={muted ? 'Unmute' : 'Mute'}
          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
        >
          {muted ? (
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="oklch(0.5 0.01 75)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <line x1={23} y1={9} x2={17} y2={15} />
              <line x1={17} y1={9} x2={23} y2={15} />
            </svg>
          ) : (
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="oklch(0.5 0.01 75)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 6a9 9 0 0 1 0 12" />
            </svg>
          )}
        </button>
      </div>

      {/* Transcript */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {transcript.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'oklch(0.65 0.01 75)', textAlign: 'center', marginTop: 24 }}>
            Tap the mic and start speaking
          </div>
        )}
        {transcript.map((entry, i) => {
          const isAgent = entry.role === 'agent'
          return (
            <div key={i} style={{ display: 'flex', justifyContent: isAgent ? 'flex-start' : 'flex-end' }}>
              <div style={{
                maxWidth: '85%',
                fontSize: 13.5,
                lineHeight: 1.5,
                padding: '8px 12px',
                borderRadius: isAgent ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                background: isAgent ? 'oklch(0.94 0.012 75)' : 'oklch(0.45 0.09 165)',
                color: isAgent ? 'oklch(0.28 0.01 75)' : '#fff',
                animation: 'fadeUp .2s ease',
              }}>
                {entry.text}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mic controls */}
      <div style={{ padding: '16px 20px 22px', borderTop: '1px solid oklch(0.92 0.01 75)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          {isListening && (
            <>
              <span style={{ width: 3, background: 'oklch(0.45 0.09 165)', borderRadius: 2, animation: 'bar1 .6s infinite ease-in-out' }} />
              <span style={{ width: 3, background: 'oklch(0.45 0.09 165)', borderRadius: 2, animation: 'bar2 .6s infinite ease-in-out' }} />
              <span style={{ width: 3, background: 'oklch(0.45 0.09 165)', borderRadius: 2, animation: 'bar3 .6s infinite ease-in-out' }} />
              <span style={{ width: 3, background: 'oklch(0.45 0.09 165)', borderRadius: 2, animation: 'bar1 .6s infinite ease-in-out .2s' }} />
            </>
          )}
        </div>

        <button
          onClick={handleMicClick}
          disabled={isConnecting}
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: 'none',
            cursor: isConnecting ? 'default' : 'pointer',
            background: micBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: micAnim,
            transition: 'background .2s',
          }}
        >
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x={9} y={2} width={6} height={12} rx={3} />
            <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
            <line x1={12} y1={19} x2={12} y2={22} />
          </svg>
        </button>

        <div style={{ fontSize: 12.5, color: 'oklch(0.55 0.01 75)', textAlign: 'center' }}>{micLabel}</div>

        {isDone && (
          <button
            onClick={onReset}
            style={{ border: '1px solid oklch(0.85 0.01 75)', background: 'none', color: 'oklch(0.5 0.01 75)', fontSize: 12, padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Start over
          </button>
        )}
      </div>
    </div>
  )
}
