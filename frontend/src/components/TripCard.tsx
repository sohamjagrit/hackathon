import type { LegState, LegStatus, FlightOption, HotelOption } from '../hooks/useSSE'

export type CardKind = 'flight' | 'hotel'

interface TripCardProps {
  title: string
  icon: React.ReactNode
  kind: CardKind
  leg: LegState
}

const STATUS_BADGE: Record<LegStatus, { label: string; bg: string; color: string }> = {
  empty:          { label: '',             bg: 'transparent',          color: 'transparent' },
  loading:        { label: 'Searching…',   bg: 'oklch(0.93 0.03 180)', color: 'oklch(0.35 0.09 180)' },
  options:        { label: 'Options',      bg: 'oklch(0.93 0.04 55)',  color: 'oklch(0.45 0.09 55)' },
  selected:       { label: 'Selected',     bg: 'oklch(0.93 0.06 165)', color: 'oklch(0.35 0.09 165)' },
  confirmed:      { label: 'Confirmed ✓',  bg: 'oklch(0.88 0.1 165)',  color: 'oklch(0.28 0.09 165)' },
  conflict:       { label: 'Conflict',     bg: 'oklch(0.92 0.08 55)',  color: 'oklch(0.45 0.12 55)' },
  cancelled:      { label: 'Cancelled',    bg: 'oklch(0.92 0.08 25)',  color: 'oklch(0.45 0.12 25)' },
  pending_change: { label: 'Updating…',    bg: 'oklch(0.93 0.04 55)',  color: 'oklch(0.45 0.09 55)' },
}

const CARD_BORDER: Record<LegStatus, string> = {
  empty:          'oklch(0.91 0.01 75)',
  loading:        'oklch(0.85 0.04 180)',
  options:        'oklch(0.85 0.06 55)',
  selected:       'oklch(0.75 0.09 165)',
  confirmed:      'oklch(0.65 0.14 165)',
  conflict:       'oklch(0.78 0.1 55)',
  cancelled:      'oklch(0.78 0.1 25)',
  pending_change: 'oklch(0.78 0.1 55)',
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
      <div style={{ width: 18, height: 18, border: '2px solid oklch(0.85 0.04 180)', borderTopColor: 'oklch(0.45 0.09 165)', borderRadius: '50%', animation: 'spin .7s linear infinite', flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, color: 'oklch(0.55 0.01 75)' }}>Searching live inventory…</span>
    </div>
  )
}

function fmtTime(iso: string): string {
  const t = iso.split('T')[1] ?? iso
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const m = mStr ?? '00'
  return `${h % 12 || 12}:${m}${h < 12 ? 'am' : 'pm'}`
}

// -------------------------------------------------------------------------
// Flight rows
// -------------------------------------------------------------------------

function FlightRow({ opt, selectedId, locked }: { opt: FlightOption; selectedId?: string; locked: boolean }) {
  const isSelected = opt.id === selectedId || opt.offer_id === selectedId

  return (
    <div style={{
      padding: '9px 11px',
      borderRadius: 10,
      background: isSelected
        ? 'oklch(0.91 0.1 165)'
        : locked ? 'oklch(0.97 0.003 75)' : 'oklch(0.976 0.005 75)',
      border: `1px solid ${isSelected ? 'oklch(0.68 0.14 165)' : 'oklch(0.91 0.01 75)'}`,
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '3px 8px',
      opacity: locked && !isSelected ? 0.45 : 1,
      transition: 'all .25s',
      animation: 'fadeUp .18s ease',
    }}>
      {/* Row 1: airline + price */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: isSelected ? 'oklch(0.25 0.1 165)' : 'oklch(0.28 0.01 75)' }}>
          {opt.airline_name || opt.carrier}
        </span>
        <span style={{ fontSize: 11, color: 'oklch(0.58 0.01 75)', fontWeight: 400 }}>
          {opt.flight_number}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: isSelected ? 'oklch(0.28 0.1 165)' : 'oklch(0.25 0.01 75)' }}>
          ${Math.round(opt.price_usd)}
        </span>
        {isSelected && (
          <span style={{ fontSize: 12, color: 'oklch(0.45 0.1 165)', fontWeight: 700 }}>✓</span>
        )}
      </div>

      {/* Row 2: times + stops badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'oklch(0.42 0.01 75)', fontVariantNumeric: 'tabular-nums' }}>
          {fmtTime(opt.depart)} → {fmtTime(opt.arrive)}
        </span>
        {opt.duration && (
          <span style={{ fontSize: 10.5, color: 'oklch(0.6 0.01 75)' }}>{opt.duration}</span>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
          background: opt.stops === 0 ? 'oklch(0.9 0.08 165)' : 'oklch(0.93 0.02 75)',
          color: opt.stops === 0 ? 'oklch(0.35 0.1 165)' : 'oklch(0.5 0.01 75)',
        }}>
          {opt.stops === 0 ? 'Nonstop' : `${opt.stops} stop${opt.stops > 1 ? 's' : ''}`}
        </span>
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
      background: isSelected ? 'oklch(0.91 0.1 165)' : 'oklch(0.976 0.005 75)',
      border: `1px solid ${isSelected ? 'oklch(0.68 0.14 165)' : 'oklch(0.91 0.01 75)'}`,
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '3px 8px',
      opacity: locked && !isSelected ? 0.45 : 1,
      transition: 'all .25s',
      animation: 'fadeUp .18s ease',
    }}>
      <div style={{ fontWeight: 600, fontSize: 12.5, color: isSelected ? 'oklch(0.25 0.1 165)' : 'oklch(0.28 0.01 75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {opt.name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: isSelected ? 'oklch(0.28 0.1 165)' : 'oklch(0.25 0.01 75)' }}>
          ${Math.round(opt.rate_usd)}
        </span>
        <span style={{ fontSize: 10, color: 'oklch(0.6 0.01 75)' }}>/night</span>
        {isSelected && <span style={{ fontSize: 12, color: 'oklch(0.45 0.1 165)', fontWeight: 700 }}>✓</span>}
      </div>
      <div style={{ fontSize: 11, color: 'oklch(0.56 0.01 75)', display: 'flex', alignItems: 'center', gap: 5 }}>
        {stars > 0 && <span>{'★'.repeat(stars)}{'☆'.repeat(Math.max(0, 5 - stars))}</span>}
        {opt.amenities && opt.amenities.length > 0 && (
          <span>{opt.amenities.slice(0, 2).join(' · ')}</span>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'oklch(0.6 0.01 75)', textAlign: 'right' }}>
        {opt.area}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Confirmed banner (locked state)
// -------------------------------------------------------------------------

function ConfirmedBanner({ detail }: { detail?: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 10,
      background: 'oklch(0.88 0.1 165)',
      border: '1px solid oklch(0.68 0.14 165)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      animation: 'fadeUp .3s ease',
    }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'oklch(0.45 0.12 165)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'oklch(0.25 0.1 165)', lineHeight: 1.4 }}>
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
      background: '#fff',
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
        <div style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{title}</div>
        {badge.label && (
          <div style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: badge.bg, color: badge.color }}>
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
          {leg.options.slice(0, 10).map((opt) => {
            const o = opt as { id: string }
            if (kind === 'flight') {
              return <FlightRow key={o.id} opt={opt as FlightOption} selectedId={leg.selectedId} locked={locked} />
            }
            return <HotelRow key={o.id} opt={opt as HotelOption} selectedId={leg.selectedId} locked={locked} />
          })}
        </div>
      )}

      {showOptions && leg.status !== 'confirmed' && leg.options.length === 0 && leg.detail && (
        <div style={{ fontSize: 12.5, color: 'oklch(0.42 0.01 75)', lineHeight: 1.5 }}>{leg.detail}</div>
      )}
    </div>
  )
}
