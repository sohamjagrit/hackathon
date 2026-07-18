import { useEffect, useRef, useState } from 'react'
import type { TripState, FlightOption, HotelOption, CarOption } from '../hooks/useSSE'
import { priceParts } from '../tripView'

interface PayPalButtons {
  render: (target: HTMLElement) => Promise<void>
  close?: () => Promise<void>
}

interface PayPalNamespace {
  Buttons: (options: {
    style?: Record<string, string | number | boolean>
    createOrder: () => Promise<string>
    onApprove: (data: { orderID: string }) => Promise<void>
    onCancel: () => void
    onError: (error: unknown) => void
  }) => PayPalButtons
}

declare global {
  interface Window {
    paypal?: PayPalNamespace
  }
}

interface CheckoutPageProps {
  trip: TripState
  onBack: () => void
  onPaid: (transactionId: string) => void
}

function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function LineItem({ label, sub, amount }: { label: string; sub?: string; amount: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid rgba(35,35,35,0.07)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13.5,
          fontWeight: 500,
          color: '#232323',
        }}>
          {label}
        </div>
        {sub && (
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: 'rgba(35,35,35,0.45)',
            marginTop: 1,
          }}>
            {sub}
          </div>
        )}
      </div>
      <div style={{
        fontFamily: "'Bricolage Grotesque', sans-serif",
        fontSize: 14,
        fontWeight: 600,
        color: '#232323',
        flexShrink: 0,
      }}>
        ${amount.toFixed(2)}
      </div>
    </div>
  )
}

export function CheckoutPage({ trip, onBack, onPaid }: CheckoutPageProps) {
  const [paying, setPaying] = useState(false)
  const [paid, setPaid] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [paypalReady, setPaypalReady] = useState(false)
  const paypalContainerRef = useRef<HTMLDivElement>(null)

  const flight = trip.flight.options.find((o) => (o as FlightOption).id === trip.flight.selectedId) as FlightOption | undefined
    ?? (trip.flight.options[0] as FlightOption | undefined)
  const hotel = trip.hotel.options.find((o) => (o as HotelOption).id === trip.hotel.selectedId) as HotelOption | undefined
    ?? (trip.hotel.options[0] as HotelOption | undefined)
  const car = trip.car.options.find((o) => (o as CarOption).id === trip.car.selectedId) as CarOption | undefined

  const { flightTotal, hotelTotal, fees } = priceParts(trip)
  const carTotal = car ? car.total_usd : 0
  const grandTotal = priceParts(trip).total + carTotal

  useEffect(() => {
    let active = true
    let buttons: PayPalButtons | undefined

    const errorMessage = async (response: Response): Promise<string> => {
      const body = await response.json().catch(() => ({}))
      return String(body.detail || body.error || `Payment request failed (${response.status})`)
    }

    const renderButtons = async () => {
      setPaymentError(null)
      setPaypalReady(false)
      const configResponse = await fetch('/api/paypal/config')
      if (!configResponse.ok) throw new Error(await errorMessage(configResponse))
      const config = await configResponse.json()
      if (!config.configured || !config.client_id) {
        throw new Error('PayPal sandbox credentials are not configured')
      }

      if (!window.paypal) {
        const existing = document.querySelector<HTMLScriptElement>('script[data-miles-paypal]')
        if (existing) {
          await new Promise<void>((resolve, reject) => {
            if (window.paypal) return resolve()
            existing.addEventListener('load', () => resolve(), { once: true })
            existing.addEventListener('error', () => reject(new Error('PayPal SDK failed to load')), { once: true })
          })
        } else {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.client_id)}&currency=USD&intent=capture`
            script.dataset.milesPaypal = 'true'
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('PayPal SDK failed to load'))
            document.head.appendChild(script)
          })
        }
      }

      if (!active || !window.paypal || !paypalContainerRef.current) return
      paypalContainerRef.current.replaceChildren()
      buttons = window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'pill',
          label: 'paypal',
          height: 48,
        },
        createOrder: async () => {
          setPaying(true)
          setPaymentError(null)
          const response = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: grandTotal,
              reference_id: trip.pnr || 'Miles trip',
            }),
          })
          if (!response.ok) {
            setPaying(false)
            throw new Error(await errorMessage(response))
          }
          const order = await response.json()
          return String(order.order_id)
        },
        onApprove: async ({ orderID }) => {
          const response = await fetch(`/api/paypal/capture-order/${encodeURIComponent(orderID)}`, {
            method: 'POST',
          })
          if (!response.ok) throw new Error(await errorMessage(response))
          const capture = await response.json()
          if (!capture.ok) throw new Error(`PayPal capture status: ${capture.status || 'unknown'}`)
          if (!active) return
          const capturedTransactionId = String(capture.transaction_id || orderID)
          setTransactionId(capturedTransactionId)
          setPaying(false)
          setPaid(true)
          window.setTimeout(() => onPaid(capturedTransactionId), 1200)
        },
        onCancel: () => {
          setPaying(false)
          setPaymentError('Payment was cancelled. Your PayPal sandbox account was not charged.')
        },
        onError: (error) => {
          setPaying(false)
          setPaymentError(error instanceof Error ? error.message : 'PayPal could not complete the payment')
        },
      })
      await buttons.render(paypalContainerRef.current)
      if (active) setPaypalReady(true)
    }

    void renderButtons().catch((error) => {
      if (!active) return
      setPaymentError(error instanceof Error ? error.message : 'PayPal checkout is unavailable')
    })

    return () => {
      active = false
      void buttons?.close?.()
    }
  }, [grandTotal, onPaid, trip.pnr])

  if (paid) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 20,
        background: '#FFF7E4',
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: '#2F6B4F',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeUp .4s ease',
        }}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{
          fontFamily: "'Bricolage Grotesque', sans-serif",
          fontSize: 24,
          fontWeight: 700,
          color: '#232323',
          animation: 'fadeUp .4s ease .1s both',
        }}>
          Payment confirmed!
        </div>
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          color: 'rgba(35,35,35,0.5)',
          animation: 'fadeUp .4s ease .2s both',
        }}>
          PNR{' '}
          <strong style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            color: '#2743F4',
          }}>
            {trip.pnr}
          </strong>
          {' '}— have a great trip ✈
        </div>
        {transactionId && (
          <div style={{
            padding: '7px 12px',
            borderRadius: 999,
            background: 'rgba(47,107,79,0.10)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11.5,
            color: '#2F6B4F',
          }}>
            Paid via PayPal sandbox · {transactionId}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      minHeight: 0,
      background: '#FFF7E4',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>

      {/* Top bar */}
      <div style={{
        padding: '14px 32px',
        borderBottom: '1px solid rgba(35,35,35,0.08)',
        background: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <button
          onClick={onBack}
          style={{
            border: '1px solid rgba(35,35,35,0.15)',
            background: 'none',
            borderRadius: 999,
            padding: '5px 14px',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12.5,
            fontWeight: 500,
            cursor: 'pointer',
            color: 'rgba(35,35,35,0.5)',
          }}
        >
          ← Back
        </button>
        <span style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          fontWeight: 600,
          color: '#232323',
          flex: 1,
        }}>
          Checkout
        </span>
        {trip.pnr && (
          <span style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12.5,
            color: 'rgba(35,35,35,0.45)',
          }}>
            PNR:{' '}
            <strong style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              color: '#2743F4',
              letterSpacing: '0.04em',
            }}>
              {trip.pnr}
            </strong>
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        padding: '32px',
        display: 'flex',
        gap: 32,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}>

        {/* Left: order summary */}
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: 26,
            fontWeight: 700,
            color: '#232323',
            marginBottom: 20,
          }}>
            Order summary
          </div>

          <div style={{
            background: '#FFFFFF',
            border: '1px solid rgba(35,35,35,0.09)',
            borderRadius: 16,
            padding: '6px 20px 16px',
          }}>
            {flight && (
              <LineItem
                label={`${flight.carrier} ${flight.flight_number}`}
                sub={`${flight.origin} → ${flight.destination} · ${fmtDate(flight.depart)}`}
                amount={flightTotal}
              />
            )}
            {hotel && (
              <LineItem
                label={hotel.name}
                sub={`${hotel.nights} nights · ${fmtDate(hotel.check_in)} – ${fmtDate(hotel.check_out)}`}
                amount={hotelTotal}
              />
            )}
            {car && (
              <LineItem
                label={`${car.vendor} ${car.category}`}
                sub={`${car.days} days · ${fmtDate(car.pickup)}`}
                amount={carTotal}
              />
            )}
            {fees > 0 && (
              <LineItem label="Taxes & fees" amount={fees} />
            )}
            {/* Total row */}
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: 14, marginTop: 4 }}>
              <div style={{
                flex: 1,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                fontWeight: 700,
                color: '#232323',
              }}>
                Total
              </div>
              <div style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 24,
                fontWeight: 800,
                color: '#232323',
              }}>
                ${grandTotal.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Right: payment */}
        <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: 26,
            fontWeight: 700,
            color: '#232323',
            marginBottom: 6,
          }}>
            Payment
          </div>

          {!paypalReady && !paymentError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              minHeight: 48,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              color: 'rgba(35,35,35,0.5)',
            }}>
              <div style={{
                width: 16,
                height: 16,
                border: '2px solid rgba(39,67,244,0.2)',
                borderTopColor: '#2743F4',
                borderRadius: '50%',
                animation: 'spin .7s linear infinite',
              }} />
              Connecting to PayPal sandbox…
            </div>
          )}
          <div
            ref={paypalContainerRef}
            style={{
              minHeight: paypalReady ? undefined : 0,
              opacity: paying ? 0.65 : 1,
              pointerEvents: paying ? 'none' : 'auto',
            }}
          />
          {paymentError && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(178,58,46,0.10)',
              border: '1px solid rgba(178,58,46,0.28)',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              lineHeight: 1.5,
              color: '#B23A2E',
            }}>
              {paymentError}
            </div>
          )}

          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11.5,
            color: 'rgba(35,35,35,0.42)',
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            Sandbox mode — no real charge.
            <br />
            Secured by 256-bit TLS encryption.
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
            {['🔒 Secure', '✓ Encrypted', '↩ Refundable'].map((label) => (
              <div key={label} style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10.5,
                padding: '3px 10px',
                borderRadius: 999,
                background: 'rgba(35,35,35,0.06)',
                color: 'rgba(35,35,35,0.45)',
              }}>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
