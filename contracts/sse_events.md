# SSE Event Schema — Contract (FROZEN)

The dashboard subscribes to `GET /events?session_id=<id>` (text/event-stream).
Events are newline-delimited JSON, one per `data:` line. The dashboard is
**read-only** — it never sends events back.

## Connection

```
GET /events?session_id=3fa85f64-5717
Accept: text/event-stream
```

Server sends a heartbeat comment every 15s to keep the connection alive:
```
: heartbeat
```

## Event envelope

Every event has this shape:
```json
{
  "type": "string",
  "session_id": "string",
  "payload": { ... }
}
```

## Event types

### `flight_options`
Graph found available flights. Dashboard renders options in the flight card.
```json
{
  "type": "flight_options",
  "session_id": "3fa85f64-5717",
  "payload": {
    "options": [
      {
        "id": "f1",
        "carrier": "DL",
        "flight_number": "DL204",
        "depart": "2026-07-18T10:30:00",
        "arrive": "2026-07-18T14:15:00",
        "origin": "MCO",
        "destination": "CUN",
        "stops": 0,
        "price_usd": 284
      }
    ]
  }
}
```

### `hotel_options`
Graph found available hotels. Dashboard renders options in the hotel card.
```json
{
  "type": "hotel_options",
  "session_id": "3fa85f64-5717",
  "payload": {
    "options": [
      {
        "id": "h1",
        "name": "Fiesta Americana Coral Beach",
        "rate_usd": 179,
        "check_in": "2026-07-18",
        "check_out": "2026-07-22",
        "amenities": ["pool", "beach", "spa"]
      }
    ]
  }
}
```

### `car_options`
Graph found available cars.
```json
{
  "type": "car_options",
  "session_id": "3fa85f64-5717",
  "payload": {
    "options": [
      {
        "id": "c1",
        "vendor": "Hertz",
        "category": "mid-size",
        "rate_usd_per_day": 31,
        "pickup": "2026-07-18T15:00:00",
        "dropoff": "2026-07-22T12:00:00",
        "location": "CUN Airport"
      }
    ]
  }
}
```

### `leg_status`
A leg changed status. Card re-renders accordingly.
```json
{
  "type": "leg_status",
  "session_id": "3fa85f64-5717",
  "payload": {
    "leg": "flight",            // "flight" | "hotel" | "car"
    "status": "selected",       // see status values below
    "selected_id": "f1",        // present on "selected"
    "detail": "DL204, 10:30am nonstop, $284"  // human-readable summary
  }
}
```

**Status values:**
- `empty` — no data yet (initial)
- `loading` — search in progress
- `options` — options surfaced, awaiting pick
- `selected` — user chose one
- `confirmed` — booking committed (green)
- `conflict` — downstream conflict detected (amber) — Act 2 only
- `cancelled` — leg cancelled (red) — Act 2 only
- `pending_change` — change in progress (amber, pulsing) — Act 2 only

### `booking_confirmed`
`commit_booking` succeeded. Dashboard goes all-green.
```json
{
  "type": "booking_confirmed",
  "session_id": "3fa85f64-5717",
  "payload": {
    "pnr": "ABC123",
    "transaction_id": "PAYPAL-ORDER-XYZ",
    "total_usd": 612,
    "itinerary": {
      "flight": { "id": "f1", "detail": "DL204 18-Jul 10:30am nonstop" },
      "hotel":  { "id": "h1", "detail": "Fiesta Americana, 4 nights" },
      "car":    { "id": "c1", "detail": "Hertz mid-size, pickup 3pm" }
    }
  }
}
```

### `recovery_started`
Act 2: disruption job started. Dashboard shows cancelled/conflict states.
```json
{
  "type": "recovery_started",
  "session_id": "3fa85f64-5717",
  "payload": {
    "pnr": "ABC123",
    "cancelled_leg": "flight",
    "conflict_legs": ["hotel", "car"]
  }
}
```

### `hotel_call_status`
Act 2: the nested hotel call changed state.
```json
{
  "type": "hotel_call_status",
  "session_id": "3fa85f64-5717",
  "payload": {
    "status": "in_progress",    // "in_progress" | "completed" | "failed"
    "transcript_line": "Agent: I'm calling to modify reservation..."
  }
}
```

### `recovery_confirmed`
Act 2: `commit_itinerary` succeeded. Dashboard settles into new plan.
```json
{
  "type": "recovery_confirmed",
  "session_id": "3fa85f64-5717",
  "payload": {
    "pnr": "ABC123",
    "itinerary": {
      "flight": { "id": "f2", "detail": "DL206 19-Jul 6:05am" },
      "hotel":  { "id": "h1", "detail": "Fiesta Americana, 2 nights (modified)" },
      "car":    { "id": "c1", "detail": "Hertz mid-size, pickup Sunday noon" }
    }
  }
}
```
