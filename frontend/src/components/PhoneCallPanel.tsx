interface PhoneCallPanelProps {
  pnr?: string
  hotelCallInProgress?: boolean
  recovered?: boolean
  onReset: () => void
}

/** Act 2 left rail — phone-only spectator. No web mic. */
export function PhoneCallPanel({
  pnr,
  hotelCallInProgress,
  recovered,
  onReset,
}: PhoneCallPanelProps) {
  const status = recovered
    ? 'Call ended — trip recovered'
    : hotelCallInProgress
      ? 'You are on hold — Miles is calling the hotel'
      : 'Miles is calling your phone'

  const detail = recovered
    ? 'Same confirmation number. Hang up when Miles says goodbye.'
    : hotelCallInProgress
      ? 'Stay on the line. The front desk call is nested inside this one.'
      : 'Answer on your phone. This screen is the live itinerary — not a web call.'

  return (
    <div style={{
      width: 380,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#FFFFFF',
      borderRight: '1px solid rgba(35,35,35,0.08)',
    }}>
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
          background: recovered ? '#2F6B4F' : '#2743F4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.7 2.35a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.75.34 1.54.57 2.35.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: 18,
            fontWeight: 700,
            color: '#232323',
            lineHeight: 1.1,
          }}>
            Miles
          </div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: 'rgba(35,35,35,0.45)',
            marginTop: 2,
          }}>
            Phone recovery · Act 2
          </div>
        </div>
        <button
          onClick={onReset}
          title="Reset session"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 6,
            color: 'rgba(35,35,35,0.35)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          Reset
        </button>
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 28px',
        gap: 20,
        textAlign: 'center',
      }}>
        <div style={{
          width: 88,
          height: 88,
          borderRadius: '50%',
          background: recovered
            ? 'rgba(47,107,79,0.12)'
            : 'rgba(39,67,244,0.10)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: recovered ? undefined : 'pulse 2s ease infinite',
        }}>
          <svg
            width={36}
            height={36}
            viewBox="0 0 24 24"
            fill="none"
            stroke={recovered ? '#2F6B4F' : '#2743F4'}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.7 2.35a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.75.34 1.54.57 2.35.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </div>

        <div>
          <div style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: 22,
            fontWeight: 600,
            color: '#232323',
            marginBottom: 8,
            lineHeight: 1.25,
          }}>
            {status}
          </div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13.5,
            color: 'rgba(35,35,35,0.48)',
            lineHeight: 1.6,
            maxWidth: 280,
          }}>
            {detail}
          </div>
        </div>

        {pnr && (
          <div style={{
            marginTop: 8,
            padding: '10px 16px',
            borderRadius: 12,
            background: '#FAFAF8',
            border: '1px solid rgba(35,35,35,0.08)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12.5,
            color: 'rgba(35,35,35,0.55)',
          }}>
            PNR <strong style={{ color: '#2743F4', letterSpacing: '0.04em' }}>{pnr}</strong>
          </div>
        )}

        <div style={{
          marginTop: 12,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'rgba(35,35,35,0.35)',
        }}>
          No web mic · phone only
        </div>
      </div>
    </div>
  )
}
