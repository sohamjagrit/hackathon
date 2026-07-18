import type { LegState, LegStatus, FlightOption, HotelOption } from '../hooks/useSSE'

export type CardKind = 'flight' | 'hotel'

interface TripCardProps {
  title: string
  icon: React.ReactNode
  kind: CardKind
  leg: LegState
}

const STATUS_BADGE: Record<LegStatus, { label: string; bg: string; color: string }> = {
  empty:          { label: '',              bg: 'transparent',              color: 'transparent' },
  loading:        { label: 'Searching…',    bg: 'rgba(200,134,46,0.12)',    color: '#C8862E' },
  options:        { label: 'Options',       bg: 'rgba(35,35,35,0.06)',      color: 'rgba(35,35,35,0.55)' },
  selected:       { label: 'Selected',      bg: 'rgba(39,67,244,0.10)',     color: '#2743F4' },
  confirmed:      { label: 'Confirmed ✓',   bg: 'rgba(47,107,79,0.12)',     color: '#2F6B4F' },
  conflict:       { label: 'Conflict',      bg: 'rgba(200,134,46,0.12)',    color: '#C8862E' },
  cancelled:      { label: 'Cancelled',     bg: 'rgba(178,58,46,0.10)',     color: '#B23A2E' },
  pending_change: { label: 'Updating…',     bg: 'rgba(200,134,46,0.12)',    color: '#C8862E' },
}

const CARD_BORDER: Record<LegStatus, string> = {
  empty:          'rgba(35,35,35,0.08)',
  loading:        'rgba(200,134,46,0.30)',
  options:        'rgba(35,35,35,0.10)',
  selected:       'rgba(39,67,244,0.35)',
  confirmed:      'rgba(47,107,79,0.40)',
  conflict:       'rgba(200,134,46,0.45)',
  cancelled:      'rgba(178,58,46,0.45)',
  pending_change: 'rgba(200,134,46,0.30)',
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
      <div style={{
        width: 16,
        height: 16,
        border: '2px solid rgba(39,67,244,0.2)',
        borderTopColor: '#2743F4',
        borderRadius: '50%',
        animation: 'spin .7s linear infinite',
        flexShrink: 0,
      }} />
      <span style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 13,
        color: 'rgba(35,35,35,0.45)',
      }}>
        Searching live inventory…
      </span>
    </div>
  )
}

function fmtTime(iso?: string): string {
  if (!iso) return '—'
  const t = iso.includes('T') ? (iso.split('T')[1] ?? iso) : iso
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  if (Number.isNaN(h)) return iso
  const m = (mStr ?? '00').slice(0, 2)
  return `${h % 12 || 12}:${m}${h < 12 ? 'am' : 'pm'}`
}

// -------------------------------------------------------------------------
// Flight rows
// -------------------------------------------------------------------------

function FlightRow({ opt, selectedId, locked }: { opt: FlightOption; selectedId?: string; locked: boolean }) {
  const isSelected = opt.id === selectedId || opt.offer_id === selectedId
  const numbers = String(opt.flight_number || '').split('/').map((value) => value.trim())
  const outboundNumber = numbers[0] || opt.flight_number
  const returnNumber = opt.return_flight_number || numbers[1]
  const hasReturn = Boolean(returnNumber || opt.return_depart)

  return (
    <div style={{
      padding: '10px 11px',
      borderRadius: 10,
      background: isSelected ? 'rgba(39,67,244,0.07)' : '#FAFAF8',
      border: `1px solid ${isSelected ? 'rgba(39,67,244,0.28)' : 'rgba(35,35,35,0.08)'}`,
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '8px',
      opacity: locked && !isSelected ? 0.4 : 1,
      transition: 'all .25s',
      animation: 'fadeUp .18s ease',
    }}>
      {/* Row 1: airline + price */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12.5,
          fontWeight: 700,
          color: isSelected ? '#2743F4' : '#232323',
        }}>
          {opt.airline_name || opt.carrier}
        </span>
        <span style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          color: 'rgba(35,35,35,0.45)',
          fontWeight: 400,
        }}>
          Round trip
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
        <span style={{
          fontFamily: "'Bricolage Grotesque', sans-serif",
          fontSize: 13.5,
          fontWeight: 700,
          color: isSelected ? '#2743F4' : '#232323',
        }}>
          ${Math.round(opt.price_usd)}
        </span>
        {isSelected && (
          <span style={{ fontSize: 12, color: '#2743F4', fontWeight: 700 }}>✓</span>
        )}
      </div>

      <div className="journey-stack">
        <div className="journey-leg">
          <span className="journey-label">Outbound</span>
          <span className="journey-route">
            {opt.origin} → {opt.destination} · {outboundNumber}
          </span>
          <span className="journey-time">
            {fmtTime(opt.depart)} → {fmtTime(opt.arrive)}
          </span>
        </div>
        {hasReturn && (
          <div className="journey-leg">
            <span className="journey-label">Return</span>
            <span className="journey-route">
              {opt.return_origin || opt.destination} → {opt.return_destination || opt.origin} · {returnNumber}
            </span>
            <span className="journey-time">
              {fmtTime(opt.return_depart)} → {fmtTime(opt.return_arrive)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Hotel rows
// -------------------------------------------------------------------------

function HotelRow({ opt, selectedId, locked }: { opt: HotelOption; selectedId?: string; locked: boolean }) {
  const isSelected = opt.id === selectedId || opt.property_id === selectedId
  const stars = Math.round(opt.rating || 0)

  return (
    <div style={{
      padding: '9px 11px',
      borderRadius: 10,
      background: isSelected ? 'rgba(39,67,244,0.07)' : '#FAFAF8',
      border: `1px solid ${isSelected ? 'rgba(39,67,244,0.28)' : 'rgba(35,35,35,0.08)'}`,
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '3px 8px',
      opacity: locked && !isSelected ? 0.4 : 1,
      transition: 'all .25s',
      animation: 'fadeUp .18s ease',
    }}>
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 600,
        fontSize: 12.5,
        color: isSelected ? '#2743F4' : '#232323',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {opt.name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
        <span style={{
          fontFamily: "'Bricolage Grotesque', sans-serif",
          fontSize: 13.5,
          fontWeight: 700,
          color: isSelected ? '#2743F4' : '#232323',
        }}>
          ${Math.round(opt.rate_usd)}
        </span>
        <span style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 10,
          color: 'rgba(35,35,35,0.42)',
        }}>/night</span>
        {isSelected && (
          <span style={{ fontSize: 12, color: '#2743F4', fontWeight: 700 }}>✓</span>
        )}
      </div>
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 11,
        color: 'rgba(35,35,35,0.45)',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
      }}>
        {stars > 0 && (
          <span style={{ color: '#C8862E' }}>{'★'.repeat(stars)}{'☆'.repeat(Math.max(0, 5 - stars))}</span>
        )}
        {opt.amenities && opt.amenities.length > 0 && (
          <span>{opt.amenities.slice(0, 2).join(' · ')}</span>
        )}
      </div>
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 11,
        color: 'rgba(35,35,35,0.42)',
        textAlign: 'right',
      }}>
        {opt.area}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Confirmed banner
// -------------------------------------------------------------------------

function ConfirmedBanner({ detail }: { detail?: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 10,
      background: 'rgba(47,107,79,0.10)',
      border: '1px solid rgba(47,107,79,0.35)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      animation: 'fadeUp .3s ease',
    }}>
      <div style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: '#2F6B4F',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <span style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 12.5,
        fontWeight: 500,
        color: '#2F6B4F',
        lineHeight: 1.4,
      }}>
        {detail || 'Booking confirmed'}
      </span>
    </div>
  )
}

// -------------------------------------------------------------------------
// Main card
// -------------------------------------------------------------------------

export function TripCard({ title, icon, kind, leg }: TripCardProps) {
  const badge = STATUS_BADGE[leg.status]
  const border = CARD_BORDER[leg.status]
  const locked = leg.status === 'selected' || leg.status === 'confirmed'
  const showOptions = ['options', 'selected', 'confirmed'].includes(leg.status)

  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid ${border}`,
      borderRadius: 16,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      overflow: 'hidden',
      transition: 'border-color .3s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13.5,
          fontWeight: 600,
          flex: 1,
          color: '#232323',
        }}>
          {title}
        </div>
        {badge.label && (
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 10.5,
            fontWeight: 600,
            padding: '2px 9px',
            borderRadius: 999,
            background: badge.bg,
            color: badge.color,
          }}>
            {badge.label}
          </div>
        )}
      </div>

      {leg.status === 'loading' && <Spinner />}

      {leg.status === 'confirmed' && (
        <ConfirmedBanner detail={leg.detail} />
      )}

      {showOptions && leg.status !== 'confirmed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 380, overflowY: 'auto' }}>
          {leg.options.slice(0, 15).map((opt) => {
            const o = opt as { id: string }
            if (kind === 'flight') {
              return <FlightRow key={o.id} opt={opt as FlightOption} selectedId={leg.selectedId} locked={locked} />
            }
            return <HotelRow key={o.id} opt={opt as HotelOption} selectedId={leg.selectedId} locked={locked} />
          })}
        </div>
      )}

      {showOptions && leg.status !== 'confirmed' && leg.options.length === 0 && leg.detail && (
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12.5,
          color: 'rgba(35,35,35,0.5)',
          lineHeight: 1.5,
        }}>
          {leg.detail}
        </div>
      )}
    </div>
  )
}
