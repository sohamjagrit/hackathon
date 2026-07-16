import type { LegState, LegStatus, FlightOption, HotelOption, CarOption } from '../hooks/useSSE'

export type CardKind = 'flight' | 'hotel' | 'car'

interface TripCardProps {
  title: string
  icon: React.ReactNode
  kind: CardKind
  leg: LegState
  idleHint: string
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
  confirmed:      'oklch(0.7 0.12 165)',
  conflict:       'oklch(0.78 0.1 55)',
  cancelled:      'oklch(0.78 0.1 25)',
  pending_change: 'oklch(0.78 0.1 55)',
}

function Spinner() {
  return (
    <div style={{ width: 18, height: 18, border: '2px solid oklch(0.85 0.04 180)', borderTopColor: 'oklch(0.45 0.09 165)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
  )
}

function fmtTime(iso: string): string {
  const t = iso.split('T')[1] ?? iso
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const m = mStr ?? '00'
  const ampm = h < 12 ? 'am' : 'pm'
  return `${h % 12 || 12}:${m}${ampm}`
}

function fmtStops(n: number): string {
  return n === 0 ? 'Nonstop' : `${n} stop${n > 1 ? 's' : ''}`
}

function FlightRow({ opt, selected }: { opt: FlightOption; selected: boolean }) {
  return (
    <div style={{
      padding: '7px 10px',
      borderRadius: 8,
      background: selected ? 'oklch(0.93 0.08 165)' : 'oklch(0.975 0.005 75)',
      border: `1px solid ${selected ? 'oklch(0.72 0.12 165)' : 'oklch(0.91 0.01 75)'}`,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      transition: 'all .25s',
      animation: 'fadeUp .2s ease',
    }}>
      <span style={{ fontWeight: 700, fontSize: 11.5, minWidth: 52, color: selected ? 'oklch(0.28 0.09 165)' : 'oklch(0.4 0.01 75)', letterSpacing: '0.02em' }}>
        {opt.carrier} {opt.flight_number}
      </span>
      <span style={{ flex: 1, fontSize: 12, color: 'oklch(0.42 0.01 75)' }}>
        {fmtTime(opt.depart)} → {fmtTime(opt.arrive)}
      </span>
      <span style={{
        fontSize: 10.5, fontWeight: 500, padding: '1px 6px', borderRadius: 10,
        background: opt.stops === 0 ? 'oklch(0.92 0.06 165)' : 'oklch(0.93 0.02 75)',
        color: opt.stops === 0 ? 'oklch(0.38 0.09 165)' : 'oklch(0.5 0.01 75)',
      }}>
        {fmtStops(opt.stops)}
      </span>
      <span style={{ fontWeight: 700, fontSize: 12, color: selected ? 'oklch(0.3 0.09 165)' : 'oklch(0.3 0.01 75)', minWidth: 40, textAlign: 'right' }}>
        ${Math.round(opt.price_usd)}
      </span>
      {selected && <span style={{ fontSize: 12, color: 'oklch(0.45 0.09 165)' }}>✓</span>}
    </div>
  )
}

function HotelRow({ opt, selected }: { opt: HotelOption; selected: boolean }) {
  const stars = Math.round(opt.rating)
  return (
    <div style={{
      padding: '7px 10px',
      borderRadius: 8,
      background: selected ? 'oklch(0.93 0.08 165)' : 'oklch(0.975 0.005 75)',
      border: `1px solid ${selected ? 'oklch(0.72 0.12 165)' : 'oklch(0.91 0.01 75)'}`,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      transition: 'all .25s',
      animation: 'fadeUp .2s ease',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: selected ? 'oklch(0.28 0.09 165)' : 'oklch(0.3 0.01 75)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {opt.name}
        </div>
        <div style={{ fontSize: 10.5, color: 'oklch(0.58 0.01 75)', marginTop: 1 }}>
          {'★'.repeat(stars)}{'☆'.repeat(Math.max(0, 5 - stars))}
          {opt.amenities.length > 0 && <span style={{ marginLeft: 5 }}>{opt.amenities.slice(0, 2).join(' · ')}</span>}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: selected ? 'oklch(0.3 0.09 165)' : 'oklch(0.3 0.01 75)' }}>
          ${Math.round(opt.rate_usd)}<span style={{ fontSize: 10, fontWeight: 400 }}>/night</span>
        </div>
      </div>
      {selected && <span style={{ fontSize: 12, color: 'oklch(0.45 0.09 165)' }}>✓</span>}
    </div>
  )
}

function CarRow({ opt, selected }: { opt: CarOption; selected: boolean }) {
  return (
    <div style={{
      padding: '7px 10px',
      borderRadius: 8,
      background: selected ? 'oklch(0.93 0.08 165)' : 'oklch(0.975 0.005 75)',
      border: `1px solid ${selected ? 'oklch(0.72 0.12 165)' : 'oklch(0.91 0.01 75)'}`,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      transition: 'all .25s',
      animation: 'fadeUp .2s ease',
    }}>
      <span style={{ fontWeight: 600, fontSize: 12, color: selected ? 'oklch(0.28 0.09 165)' : 'oklch(0.38 0.01 75)', minWidth: 44 }}>
        {opt.vendor}
      </span>
      <span style={{ flex: 1, fontSize: 11.5, color: 'oklch(0.5 0.01 75)' }}>
        {opt.category} · {opt.model}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: selected ? 'oklch(0.3 0.09 165)' : 'oklch(0.3 0.01 75)' }}>
        ${opt.rate_usd_per_day.toFixed(0)}<span style={{ fontSize: 10, fontWeight: 400 }}>/day</span>
      </span>
      {selected && <span style={{ fontSize: 12, color: 'oklch(0.45 0.09 165)' }}>✓</span>}
    </div>
  )
}

function OptionsList({ kind, options, selectedId }: { kind: CardKind; options: unknown[]; selectedId?: string }) {
  if (options.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
      {options.slice(0, 4).map((opt) => {
        const o = opt as { id: string }
        const selected = o.id === selectedId
        if (kind === 'flight') return <FlightRow key={o.id} opt={opt as FlightOption} selected={selected} />
        if (kind === 'hotel') return <HotelRow key={o.id} opt={opt as HotelOption} selected={selected} />
        return <CarRow key={o.id} opt={opt as CarOption} selected={selected} />
      })}
    </div>
  )
}

export function TripCard({ title, icon, kind, leg, idleHint }: TripCardProps) {
  const badge = STATUS_BADGE[leg.status]
  const border = CARD_BORDER[leg.status]
  const showOptions = leg.status === 'options' || leg.status === 'selected' || leg.status === 'confirmed'

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${border}`,
      borderRadius: 16,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
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

      {/* Loading */}
      {leg.status === 'loading' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
          <Spinner />
          <span style={{ fontSize: 12.5, color: 'oklch(0.55 0.01 75)' }}>Searching…</span>
        </div>
      )}

      {/* Empty */}
      {leg.status === 'empty' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, color: 'oklch(0.65 0.01 75)', textAlign: 'center', padding: '8px 0' }}>
          {idleHint}
        </div>
      )}

      {/* Options / selected / confirmed */}
      {showOptions && (
        <OptionsList kind={kind} options={leg.options} selectedId={leg.selectedId} />
      )}

      {/* Fallback when no options but has status */}
      {showOptions && leg.options.length === 0 && leg.detail && (
        <div style={{ fontSize: 12.5, color: 'oklch(0.42 0.01 75)', lineHeight: 1.5 }}>
          {leg.detail}
        </div>
      )}
    </div>
  )
}
