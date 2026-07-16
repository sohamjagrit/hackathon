# /agent/query — Contract (FROZEN)

The single entry point into LangGraph. Both Act 1 (web relay) and Act 2 (phone
HTTP tools) terminate here. Nothing else reaches the graph.

## Request

```
POST /agent/query
Content-Type: application/json
```

```json
{
  "session_id": "string",   // UUIDv4; ties graph thread, SSE stream, and voice session
  "query": "string"         // the user's utterance, verbatim from VB onQuery
}
```

## Response

```
200 OK
Content-Type: application/json
```

```json
{
  "speech": "string"        // prose only — spoken by the VB agent as-is
}
```

## Rules

- `speech` is **prose only**. Never include structured data (options, prices,
  PNRs) — those go to the dashboard over SSE.
- Every booking decision happens inside the graph. The caller is a dumb relay.
- `session_id` must match the VB token's `session_id` and the SSE stream's
  `?session_id=` param. Mismatch = silent breakage.
- On graph error, return `{"speech": "Something went wrong — please try again."}`.
  Never 500 to the VB relay.

## Examples

### Turn 1 — user states intent
```json
// request
{ "session_id": "3fa85f64-5717", "query": "I want four days in Cancún, leaving Friday." }

// response (graph runs search_flights, emits SSE, interrupts)
{ "speech": "I found four flights out of Orlando Friday morning. The 10:30 nonstop is $284, or there's a cheaper 8:10 with a stop at $231. Which would you like?" }
```

### Turn 2 — user selects
```json
// request
{ "session_id": "3fa85f64-5717", "query": "The nonstop." }

// response (graph records choice, runs search_hotels, emits SSE, interrupts)
{ "speech": "Got it — nonstop at 10:30 for $284. Now for hotels: there are three near the beach under $200. The Fiesta Americana has a pool at $179. Interested?" }
```

### Turn N — confirm
```json
// request
{ "session_id": "3fa85f64-5717", "query": "Book it." }

// response (after commit_booking runs and emits booking_confirmed SSE)
{ "speech": "Done — you're confirmed on flight DL204, Fiesta Americana three nights, Hertz mid-size. Total $612. Confirmation is ABC123. Have a great trip." }
```
