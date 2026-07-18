import type { SeatState } from '../hooks/useSSE'

interface SeatMapCardProps {
  seats: SeatState
}

const ROWS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
// A=window, B=middle, C=aisle | D=aisle, E=middle, F=window
const LEFT_COLS = ['A', 'B', 'C'] as const
const RIGHT_COLS = ['D', 'E', 'F'] as const
const WINDOW_COLS = new Set(['A', 'F'])
const AISLE_COLS = new Set(['C', 'D'])

// Deterministic "taken" seats — chosen so 14A/14F (window) and 14C/14D (aisle) stay free
const TAKEN = new Set([
  '10A', '10B', '10D', '10F',
  '11C', '11E',
  '12A', '12D', '12F',
  '13B', '13E',
  '15B',
  '16D', '16E',
  '17A', '17C',
  '18B', '18E',
  '19D', '19E', '19F',
  '20A', '20C',
  '21B', '21D',
])

/**
 * Deterministic demand score in [0, 1] driving the heatmap tint.
 * Windows/aisles run hot, middles cold; demand decays toward the back,
 * with a small per-seat jitter so the map reads organically.
 */
function demandScore(row: number, col: string): number {
  const colScore = WINDOW_COLS.has(col) ? 0.9 : AISLE_COLS.has(col) ? 0.78 : 0.35
  const rowIndex = ROWS.indexOf(row)
  const rowScore = 1 - (rowIndex / Math.max(ROWS.length - 1, 1)) * 0.55
  const jitter = (((row * 31 + col.charCodeAt(0) * 17) % 13) / 13 - 0.5) * 0.14
  return Math.min(1, Math.max(0, colScore * 0.62 + rowScore * 0.38 + jitter))
}

/** Cool ink-blue at low demand → warm amber → hot red at peak demand. */
function heatColor(score: number, alpha: number): string {
  const stops: Array<[number, [number, number, number]]> = [
    [0, [39, 67, 244]],    // brand blue (cool)
    [0.55, [200, 134, 46]], // warning amber
    [1, [178, 58, 46]],    // error red (hot)
  ]
  let lower = stops[0]
  let upper = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i += 1) {
    if (score >= stops[i][0] && score <= stops[i + 1][0]) {
      lower = stops[i]
      upper = stops[i + 1]
      break
    }
  }
  const span = upper[0] - lower[0] || 1
  const t = (score - lower[0]) / span
  const mix = lower[1].map((channel, i) => Math.round(channel + (upper[1][i] - channel) * t))
  return `rgba(${mix[0]},${mix[1]},${mix[2]},${alpha})`
}

function seatStyle(
  row: number,
  col: string,
  preference: SeatState['preference'],
  assigned: string | undefined,
): React.CSSProperties {
  const key = `${row}${col}`
  const isAssigned = assigned === key
  const taken = !isAssigned && TAKEN.has(key)
  const preferred =
    (preference === 'window' && WINDOW_COLS.has(col)) ||
    (preference === 'aisle' && AISLE_COLS.has(col))

  if (isAssigned) {
    return {
      background: '#2743F4',
      border: '1px solid rgba(39,67,244,0.7)',
      color: '#fff',
    }
  }
  if (taken) {
    return {
      background: 'rgba(35,35,35,0.06)',
      border: '1px solid rgba(35,35,35,0.1)',
      color: 'rgba(35,35,35,0.3)',
    }
  }
  const score = demandScore(row, col)
  return {
    background: heatColor(score, 0.10 + score * 0.26),
    border: preferred
      ? '1.5px solid rgba(39,67,244,0.55)'
      : `1px solid ${heatColor(score, 0.28)}`,
    color: 'transparent',
  }
}

function SeatCell({ row, col, preference, assigned }: {
  row: number
  col: string
  preference: SeatState['preference']
  assigned: string | undefined
}) {
  const key = `${row}${col}`
  const isAssigned = assigned === key
  const taken = !isAssigned && TAKEN.has(key)

  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        fontWeight: 700,
        flexShrink: 0,
        transition: 'background .3s, border-color .3s',
        ...seatStyle(row, col, preference, assigned),
      }}
    >
      {isAssigned ? '✓' : taken ? '×' : null}
    </div>
  )
}

export function SeatMapCard({ seats }: SeatMapCardProps) {
  const { status, preference, assigned } = seats
  const prefLabel = preference === 'window' ? 'Window' : preference === 'aisle' ? 'Aisle' : ''

  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid ${status === 'assigned' ? 'rgba(47,107,79,0.40)' : 'rgba(200,134,46,0.35)'}`,
      borderRadius: 16,
      padding: '18px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      animation: 'fadeUp .25s ease',
      transition: 'border-color .3s',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.07em',
          color: 'rgba(35,35,35,0.42)',
          textTransform: 'uppercase',
          flex: 1,
        }}>
          Seat
        </div>
        {status === 'assigned' && assigned && (
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 10.5,
            fontWeight: 700,
            padding: '2px 10px',
            borderRadius: 999,
            background: 'rgba(47,107,79,0.12)',
            color: '#2F6B4F',
          }}>
            {assigned} · {prefLabel} ✓
          </div>
        )}
        {status === 'choosing' && (
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 10.5,
            fontWeight: 700,
            padding: '2px 10px',
            borderRadius: 999,
            background: 'rgba(200,134,46,0.12)',
            color: '#C8862E',
          }}>
            Choosing…
          </div>
        )}
      </div>

      {/* Two-column layout: grid left, legend right */}
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>

        {/* Cabin grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Column headers */}
          <div style={{ display: 'flex', gap: 2, marginLeft: 24 }}>
            {LEFT_COLS.map(c => (
              <div key={c} style={{
                width: 22,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 9,
                fontWeight: 700,
                color: 'rgba(35,35,35,0.38)',
                textAlign: 'center',
              }}>
                {c}
              </div>
            ))}
            <div style={{ width: 12 }} />
            {RIGHT_COLS.map(c => (
              <div key={c} style={{
                width: 22,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 9,
                fontWeight: 700,
                color: 'rgba(35,35,35,0.38)',
                textAlign: 'center',
              }}>
                {c}
              </div>
            ))}
          </div>

          {/* Rows */}
          {ROWS.map(row => (
            <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <div style={{
                width: 20,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 9,
                color: 'rgba(35,35,35,0.35)',
                textAlign: 'right',
                paddingRight: 4,
                flexShrink: 0,
              }}>
                {row}
              </div>
              {LEFT_COLS.map(col => (
                <SeatCell key={col} row={row} col={col} preference={preference} assigned={assigned} />
              ))}
              {/* Aisle gap */}
              <div style={{ width: 12, flexShrink: 0 }} />
              {RIGHT_COLS.map(col => (
                <SeatCell key={col} row={row} col={col} preference={preference} assigned={assigned} />
              ))}
            </div>
          ))}
        </div>

        {/* Legend + status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 20, minWidth: 120 }}>
          <LegendItem color="#2743F4" border="rgba(39,67,244,0.5)" label="Your seat" />
          {preference && (
            <LegendItem color="rgba(255,255,255,0.9)" border="rgba(39,67,244,0.55)" label={`${prefLabel} seats`} />
          )}
          <LegendItem color="rgba(35,35,35,0.06)" border="rgba(35,35,35,0.10)" label="Taken" />

          {/* Demand heatmap scale */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 10.5,
              color: 'rgba(35,35,35,0.45)',
            }}>
              Seat demand
            </span>
            <div style={{
              height: 8,
              borderRadius: 4,
              background: `linear-gradient(to right, ${heatColor(0, 0.35)}, ${heatColor(0.55, 0.5)}, ${heatColor(1, 0.6)})`,
              border: '1px solid rgba(35,35,35,0.08)',
            }} />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 9.5,
              color: 'rgba(35,35,35,0.4)',
            }}>
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          {status === 'assigned' && assigned && (
            <div style={{
              marginTop: 8,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              color: '#2F6B4F',
              fontWeight: 600,
              lineHeight: 1.4,
            }}>
              Seat {assigned}<br />
              <span style={{ fontWeight: 400, color: 'rgba(35,35,35,0.45)' }}>{prefLabel}, economy</span>
            </div>
          )}
          {status === 'choosing' && preference && (
            <div style={{
              marginTop: 8,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11.5,
              color: 'rgba(35,35,35,0.45)',
              lineHeight: 1.4,
            }}>
              Finding a {preference}<br />seat for you…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LegendItem({ color, border, label }: { color: string; border: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{
        width: 12,
        height: 12,
        borderRadius: 3,
        background: color,
        border: `1px solid ${border}`,
        flexShrink: 0,
      }} />
      <span style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 10.5,
        color: 'rgba(35,35,35,0.45)',
      }}>
        {label}
      </span>
    </div>
  )
}
