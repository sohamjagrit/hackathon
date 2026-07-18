import { useState } from 'react'
import { useVocalBridge, useTranscript } from '@vocalbridgeai/react'

interface VoicePanelProps {
  onReset: () => void
}

export function VoicePanel({ onReset }: VoicePanelProps) {
  const [muted, setMuted] = useState(false)
  const { state, connect, disconnect } = useVocalBridge()
  const { transcript } = useTranscript()

  const isConnected = state === 'connected'
  const isConnecting = state === 'connecting'
  const isDone = state === 'disconnected' && transcript.length > 0

  const currentEntry = transcript[transcript.length - 1]
  const isAgent = currentEntry?.role === 'agent'

  const micBg = isConnected
    ? '#2743F4'
    : isConnecting
    ? 'rgba(39,67,244,0.55)'
    : '#232323'

  const micLabel = isConnecting ? 'Connecting…' : isConnected ? 'Tap to stop' : 'Tap to talk'

  return (
    <div style={{
      width: 380,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#FFFFFF',
      borderRight: '1px solid rgba(35,35,35,0.08)',
    }}>

      {/* Header */}
      <div style={{
        padding: '22px 24px 18px',
        borderBottom: '1px solid rgba(35,35,35,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#2743F4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
            <path d="M2 12l19-9-6 19-4-8-9-2z" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: 16,
            fontWeight: 700,
            color: '#232323',
            lineHeight: 1.2,
          }}>
            Miles
          </div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: 'rgba(35,35,35,0.42)',
            marginTop: 1,
          }}>
            your trip, spoken into being
          </div>
        </div>
        <button
          onClick={() => setMuted(!muted)}
          title={muted ? 'Unmute' : 'Mute'}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            color: 'rgba(35,35,35,0.35)',
          }}
        >
          {muted ? (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <line x1={23} y1={9} x2={17} y2={15} /><line x1={17} y1={9} x2={23} y2={15} />
            </svg>
          ) : (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 6a9 9 0 0 1 0 12" />
            </svg>
          )}
        </button>
      </div>

      {/* Ephemeral transcript zone — only current utterance */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 28px',
        textAlign: 'center',
      }}>
        {!currentEntry && (
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            color: 'rgba(35,35,35,0.32)',
            lineHeight: 1.75,
            maxWidth: 240,
          }}>
            Tap the mic and tell Miles<br />where you want to go
          </div>
        )}

        {currentEntry && (
          <div
            key={transcript.length}
            style={{ animation: 'fadeUp .15s ease', maxWidth: 300 }}
          >
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: isAgent ? 'rgba(39,67,244,0.7)' : 'rgba(35,35,35,0.35)',
              marginBottom: 10,
            }}>
              {isAgent ? 'Miles' : 'You'}
            </div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              lineHeight: 1.65,
              color: '#232323',
              fontWeight: 400,
            }}>
              {currentEntry.text}
            </div>
          </div>
        )}
      </div>

      {/* Mic controls */}
      <div style={{
        padding: '0 24px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}>
        {/* Audio activity bars */}
        <div style={{ height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          {isConnected && (
            [1, 2, 3, 4].map(n => (
              <span key={n} style={{
                width: 3,
                height: 14,
                background: '#2743F4',
                borderRadius: 2,
                display: 'inline-block',
                animation: `bar${n <= 2 ? n : n - 2} .6s infinite ease-in-out${n > 2 ? ' .2s' : ''}`,
              }} />
            ))
          )}
        </div>

        <button
          onClick={isConnected ? disconnect : connect}
          disabled={isConnecting}
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: 'none',
            cursor: isConnecting ? 'default' : 'pointer',
            background: micBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: isConnected ? 'pulse 1.8s infinite' : 'none',
            transition: 'background .2s, box-shadow .2s',
            boxShadow: isConnected
              ? '0 8px 24px rgba(39,67,244,0.25)'
              : '0 4px 16px rgba(35,35,35,0.14)',
          }}
        >
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <rect x={9} y={2} width={6} height={12} rx={3} />
            <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
            <line x1={12} y1={19} x2={12} y2={22} />
          </svg>
        </button>

        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12,
          fontWeight: 500,
          color: 'rgba(35,35,35,0.38)',
        }}>
          {micLabel}
        </div>

        {isDone && (
          <button
            onClick={onReset}
            style={{
              border: '1px solid rgba(35,35,35,0.15)',
              background: 'none',
              color: 'rgba(35,35,35,0.45)',
              fontSize: 12,
              fontWeight: 500,
              padding: '6px 18px',
              borderRadius: 999,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'border-color .15s, color .15s',
            }}
          >
            Start over
          </button>
        )}
      </div>
    </div>
  )
}
